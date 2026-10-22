"""Train versioned research models from explicitly authorized participant data."""

import argparse
import hashlib
import json
import math
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

if __package__:
    from .speech_features import FEATURE_EXTRACTOR_VERSION
    from .model_contract import (
        BUNDLE_FORMAT,
        BUNDLE_SCHEMA_VERSION,
        FEATURES_BY_MODALITY,
        MODELS,
    )
else:
    from speech_features import FEATURE_EXTRACTOR_VERSION
    from model_contract import (
        BUNDLE_FORMAT,
        BUNDLE_SCHEMA_VERSION,
        FEATURES_BY_MODALITY,
        MODELS,
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_dataset(path: str | None) -> pd.DataFrame:
    if not path:
        raise ValueError("Provide an authorized dataset with --data.")
    dataset_path = Path(path).expanduser()
    if not dataset_path.is_file():
        raise FileNotFoundError(f"Dataset file does not exist: {dataset_path}")
    if dataset_path.suffix.lower() != ".csv":
        raise ValueError("Only CSV datasets are supported.")
    return pd.read_csv(dataset_path)


def validate_provenance(dataset_path: str, manifest_path: str) -> dict[str, Any]:
    data_file = Path(dataset_path).expanduser()
    manifest_file = Path(manifest_path).expanduser()
    if not data_file.is_file():
        raise FileNotFoundError(f"Dataset file does not exist: {data_file}")
    if not manifest_file.is_file():
        raise FileNotFoundError("A dataset provenance manifest is required.")

    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    required = (
        "dataset_name",
        "release",
        "source_url",
        "authorization_reference",
        "license_or_agreement",
        "model_use_permission",
        "sha256",
    )
    missing = [field for field in required if not manifest.get(field)]
    if missing:
        raise ValueError("Provenance manifest is missing: " + ", ".join(missing))
    if manifest.get("authorization_confirmed") is not True:
        raise ValueError(
            "Confirm that the dataset's terms authorize the intended research use."
        )
    if manifest.get("model_training_and_inference_authorized") is not True:
        raise ValueError(
            "The source terms must explicitly authorize model training and local inference."
        )
    if sha256_file(data_file).lower() != str(manifest["sha256"]).strip().lower():
        raise ValueError("Dataset checksum does not match the provenance manifest.")
    return manifest


def validate_feature_selection(
    feature_columns: list[str],
    group_column: str,
    target_column: str,
    modality: str,
) -> None:
    if modality not in FEATURES_BY_MODALITY:
        raise ValueError("Modality must be cognitive_tasks or speech.")
    if not feature_columns or len(feature_columns) != len(set(feature_columns)):
        raise ValueError("Provide a non-empty list of unique feature columns.")
    if target_column == group_column or target_column in feature_columns:
        raise ValueError("Target and group columns cannot be model features.")
    if group_column in feature_columns:
        raise ValueError("The participant/group identifier cannot be a feature.")
    unsupported = sorted(set(feature_columns) - FEATURES_BY_MODALITY[modality])
    if unsupported:
        raise ValueError(
            f"Unsupported {modality} feature(s): " + ", ".join(unsupported)
        )


def grouped_split(
    features: pd.DataFrame,
    target: pd.Series,
    groups: pd.Series,
) -> tuple[np.ndarray, np.ndarray]:
    if groups.isna().any():
        raise ValueError("The subject/group column cannot contain missing values.")
    if target.isna().any():
        raise ValueError("The target column cannot contain missing values.")
    if target.nunique() < 2:
        raise ValueError("The target must contain at least two classes.")
    if groups.nunique() < 4:
        raise ValueError("At least four distinct participants are required.")

    splitter = GroupShuffleSplit(n_splits=50, test_size=0.25, random_state=42)
    for train_indices, test_indices in splitter.split(features, target, groups):
        train_labels = set(target.iloc[train_indices])
        test_labels = set(target.iloc[test_indices])
        train_groups = set(groups.iloc[train_indices])
        test_groups = set(groups.iloc[test_indices])
        if (
            train_groups.isdisjoint(test_groups)
            and train_labels == set(target)
            and test_labels == set(target)
        ):
            return train_indices, test_indices

    raise ValueError(
        "Could not create a participant-separated holdout containing every label. "
        "No row-wise split was attempted."
    )


def grouped_train_validation_test_split(
    features: pd.DataFrame,
    target: pd.Series,
    groups: pd.Series,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if groups.isna().any():
        raise ValueError("The subject/group column cannot contain missing values.")
    if target.isna().any():
        raise ValueError("The target column cannot contain missing values.")
    labels = set(target.astype(str))
    if len(labels) < 2:
        raise ValueError("The target must contain at least two classes.")
    if groups.nunique() < 10:
        raise ValueError(
            "At least ten distinct participants are required for a grouped "
            "train/validation/test split."
        )

    outer = GroupShuffleSplit(n_splits=100, test_size=0.2, random_state=42)
    inner = GroupShuffleSplit(n_splits=100, test_size=0.25, random_state=43)
    for train_validation, test_indices in outer.split(features, target, groups):
        if set(target.iloc[test_indices].astype(str)) != labels:
            continue
        train_validation_groups = groups.iloc[train_validation]
        for train_relative, validation_relative in inner.split(
            features.iloc[train_validation],
            target.iloc[train_validation],
            train_validation_groups,
        ):
            train_indices = train_validation[train_relative]
            validation_indices = train_validation[validation_relative]
            partitions = (train_indices, validation_indices, test_indices)
            if any(
                set(target.iloc[index].astype(str)) != labels
                for index in partitions
            ):
                continue
            participant_sets = [
                set(groups.iloc[index]) for index in partitions
            ]
            if (
                participant_sets[0].isdisjoint(participant_sets[1])
                and participant_sets[0].isdisjoint(participant_sets[2])
                and participant_sets[1].isdisjoint(participant_sets[2])
            ):
                return train_indices, validation_indices, test_indices

    raise ValueError(
        "Could not create participant-separated train, validation, and test "
        "partitions containing every label. No row-wise split was attempted."
    )


def _evaluate_classifier(
    model: Pipeline,
    features: pd.DataFrame,
    target: pd.Series,
    labels: list[str],
) -> dict[str, Any]:
    predictions = model.predict(features)
    metrics: dict[str, Any] = {
        "balanced_accuracy": float(balanced_accuracy_score(target, predictions)),
        "precision_macro": float(
            precision_score(target, predictions, labels=labels, average="macro", zero_division=0)
        ),
        "recall_macro": float(
            recall_score(target, predictions, labels=labels, average="macro", zero_division=0)
        ),
        "f1_macro": float(
            f1_score(target, predictions, labels=labels, average="macro", zero_division=0)
        ),
        "accuracy": float(accuracy_score(target, predictions)),
        "classification_report": classification_report(
            target,
            predictions,
            labels=labels,
            target_names=labels,
            zero_division=0,
            output_dict=True,
        ),
        "confusion_matrix": confusion_matrix(target, predictions, labels=labels).tolist(),
        "row_count": int(len(target)),
        "class_counts": {
            label: int((target == label).sum()) for label in labels
        },
    }
    if len(labels) == 2 and hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(features)
        class_names = [str(label) for label in model.classes_]
        positive_index = class_names.index(labels[1])
        binary_target = (target.to_numpy() == labels[1]).astype(int)
        metrics["roc_auc"] = float(
            roc_auc_score(binary_target, probabilities[:, positive_index])
        )
        metrics["pr_auc"] = float(
            average_precision_score(binary_target, probabilities[:, positive_index])
        )
        metrics["roc_auc_positive_label"] = labels[1]
        metrics["pr_auc_positive_label"] = labels[1]
    else:
        metrics["roc_auc"] = None
        metrics["pr_auc"] = None
    return metrics


def _feature_schema(
    train_features: pd.DataFrame,
    feature_columns: list[str],
) -> list[dict[str, Any]]:
    schema = []
    for column in feature_columns:
        values = train_features[column]
        observed = values.dropna()
        if observed.empty:
            raise ValueError(f"Feature '{column}' has no observed training values.")
        numeric = pd.api.types.is_numeric_dtype(observed.dtype)
        if numeric:
            minimum = float(observed.min())
            maximum = float(observed.max())
            if not math.isfinite(minimum) or not math.isfinite(maximum):
                raise ValueError(f"Feature '{column}' has non-finite training values.")
            schema.append(
                {
                    "name": column,
                    "type": "number",
                    "required": not values.isna().any(),
                    "minimum": minimum,
                    "maximum": maximum,
                }
            )
        else:
            allowed_values = sorted({str(value) for value in observed})
            schema.append(
                {
                    "name": column,
                    "type": "category",
                    "required": not values.isna().any(),
                    "allowed_values": allowed_values,
                }
            )
    return schema


def _build_pipeline(
    train_features: pd.DataFrame,
    feature_columns: list[str],
    model_name: str,
) -> Pipeline:
    categorical = train_features.select_dtypes(
        include=["object", "category", "string"]
    ).columns.tolist()
    numeric = [column for column in feature_columns if column not in categorical]
    transformers = []
    if numeric:
        transformers.append(
            (
                "num",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric,
            )
        )
    if categorical:
        transformers.append(
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical,
            )
        )
    classifier = (
        LogisticRegression(max_iter=2000, class_weight="balanced")
        if model_name == "logistic_regression"
        else RandomForestClassifier(
            n_estimators=300,
            class_weight="balanced",
            random_state=42,
            n_jobs=1,
        )
    )
    return Pipeline(
        [
            ("preprocessor", ColumnTransformer(transformers=transformers)),
            ("classifier", classifier),
        ]
    )


def train_models(
    frame: pd.DataFrame,
    target_column: str,
    group_column: str,
    feature_columns: list[str],
    labels: list[str],
    modality: str,
) -> tuple[dict[str, Pipeline], dict[str, Any]]:
    validate_feature_selection(feature_columns, group_column, target_column, modality)
    if len(labels) < 2 or len(labels) != len(set(labels)):
        raise ValueError("Provide at least two unique target labels explicitly.")

    required = [target_column, group_column, *feature_columns]
    missing = sorted(set(required) - set(frame.columns))
    if missing:
        raise ValueError("Dataset is missing columns: " + ", ".join(missing))

    target = frame[target_column].astype("string")
    observed_labels = set(target.dropna().astype(str))
    if observed_labels != set(labels):
        raise ValueError(
            "Observed target labels do not exactly match --labels; "
            "review label mapping explicitly before training."
        )

    features = frame[feature_columns]
    groups = frame[group_column]
    train_indices, validation_indices, test_indices = (
        grouped_train_validation_test_split(features, target, groups)
    )
    train_features = features.iloc[train_indices]
    validation_features = features.iloc[validation_indices]
    test_features = features.iloc[test_indices]
    train_target = target.iloc[train_indices].astype(str)
    validation_target = target.iloc[validation_indices].astype(str)
    test_target = target.iloc[test_indices].astype(str)
    schema = _feature_schema(train_features, feature_columns)

    models: dict[str, Pipeline] = {}
    validation_evaluation: dict[str, Any] = {}
    test_evaluation: dict[str, Any] = {}
    for model_name in MODELS:
        model = _build_pipeline(train_features, feature_columns, model_name)
        model.fit(train_features, train_target)
        models[model_name] = model
        validation_evaluation[model_name] = _evaluate_classifier(
            model, validation_features, validation_target, labels
        )
        test_evaluation[model_name] = _evaluate_classifier(
            model, test_features, test_target, labels
        )

    selected_model = max(
        MODELS,
        key=lambda name: validation_evaluation[name]["balanced_accuracy"],
    )

    metadata = {
        "format": BUNDLE_FORMAT,
        "schema_version": BUNDLE_SCHEMA_VERSION,
        "modality": modality,
        "target_definition": {
            "column": target_column,
            "labels": labels,
            "participant_group_column": group_column,
        },
        "labels": labels,
        "feature_schema": schema,
        "training_config": {
            "random_state": {"outer_split": 42, "inner_split": 43},
            "candidate_models": list(MODELS),
            "logistic_regression": {
                "max_iter": 2000,
                "class_weight": "balanced",
            },
            "random_forest": {
                "n_estimators": 300,
                "class_weight": "balanced",
                "random_state": 42,
            },
            "preprocessing": (
                "Median imputation and standard scaling for numeric features; "
                "most-frequent imputation and one-hot encoding for categorical "
                "features. Fitted only on the training partition."
            ),
        },
        "evaluation": {
            "status": "participant_grouped_train_validation_test",
            "split_method": "GroupShuffleSplit",
            "fractions": {"train": 0.6, "validation": 0.2, "test": 0.2},
            "random_state": {"outer": 42, "inner": 43},
            "model_selection_metric": "validation_balanced_accuracy",
            "selected_model": selected_model,
            "participant_counts": {
                "total": int(groups.nunique()),
                "train": int(groups.iloc[train_indices].nunique()),
                "validation": int(groups.iloc[validation_indices].nunique()),
                "test": int(groups.iloc[test_indices].nunique()),
            },
            "row_counts": {
                "total": int(len(frame)),
                "train": int(len(train_indices)),
                "validation": int(len(validation_indices)),
                "test": int(len(test_indices)),
            },
            "class_counts": {
                "train": {
                    label: int((train_target == label).sum()) for label in labels
                },
                "validation": {
                    label: int((validation_target == label).sum()) for label in labels
                },
                "test": {
                    label: int((test_target == label).sum()) for label in labels
                },
            },
            "validation_metrics": validation_evaluation,
            "models": test_evaluation,
            "limitations": [
                "Participant-grouped validation and test samples are small and exploratory.",
                "The held-out test set is not used for model selection.",
                "No calibration, fairness, prospective, or clinical validation is implied.",
            ],
        },
    }
    if modality == "speech":
        metadata["feature_extraction"] = {
            "name": "MindScan transcript and ASR segment-timing features",
            "version": FEATURE_EXTRACTOR_VERSION,
            "acoustic_features_available": False,
        }
    return models, metadata


def save_model_bundle(
    output_directory: Path,
    models: dict[str, Pipeline],
    metadata: dict[str, Any],
    *,
    model_version: str,
    provenance: dict[str, Any],
    data_path: Path,
) -> Path:
    if not model_version or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_" for char in model_version):
        raise ValueError("Model version may contain only letters, digits, dot, hyphen, underscore.")
    if (
        provenance.get("authorization_confirmed") is not True
        or provenance.get("model_training_and_inference_authorized") is not True
        or not provenance.get("license_or_agreement")
        or not provenance.get("model_use_permission")
    ):
        raise ValueError(
            "A model bundle requires explicit source terms and model-use authorization."
        )
    output_directory = output_directory.expanduser()
    output_directory.mkdir(parents=True, exist_ok=False)

    model_files = {}
    for model_name, model in models.items():
        filename = f"{model_name}.joblib"
        model_path = output_directory / filename
        joblib.dump(model, model_path)
        model_files[model_name] = {
            "file": filename,
            "sha256": sha256_file(model_path),
        }

    metadata.update(
        {
            "model_version": model_version,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "training_status": "research_only",
            "dataset": {
                "name": provenance["dataset_name"],
                "release": provenance["release"],
                "source_url": provenance["source_url"],
                "authorization_reference": provenance["authorization_reference"],
                "license_or_agreement": provenance["license_or_agreement"],
                "model_use_permission": provenance["model_use_permission"],
                "model_training_and_inference_authorized": provenance[
                    "model_training_and_inference_authorized"
                ],
                "authorization_confirmed": provenance["authorization_confirmed"],
                "sha256": sha256_file(data_path),
            },
            "training_software": {
                "python": platform.python_version(),
                "numpy": np.__version__,
                "pandas": pd.__version__,
                "scikit_learn": sklearn.__version__,
                "joblib": joblib.__version__,
            },
            "models": model_files,
        }
    )
    metadata_path = output_directory / "metadata.json"
    metadata_path.write_text(
        json.dumps(metadata, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    return metadata_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Train Logistic Regression and Random Forest research baselines."
    )
    parser.add_argument("--data", required=True, help="Authorized CSV path.")
    parser.add_argument("--provenance", required=True, help="Dataset manifest JSON.")
    parser.add_argument("--target", required=True, help="Explicit target column.")
    parser.add_argument("--labels", required=True, help="Comma-separated exact target labels.")
    parser.add_argument("--group", required=True, help="Participant identifier column.")
    parser.add_argument(
        "--modality",
        required=True,
        choices=sorted(FEATURES_BY_MODALITY),
        help="Train one modality only; no multimodal fusion is supported.",
    )
    parser.add_argument(
        "--features",
        required=True,
        help="Comma-separated supported feature columns; no demographics or MRI fields.",
    )
    parser.add_argument("--version", required=True, help="Unique model version.")
    parser.add_argument("--output", required=True, help="New output directory.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        data_path = Path(args.data).expanduser()
        provenance = validate_provenance(args.data, args.provenance)
        frame = load_dataset(args.data)
        feature_columns = [column.strip() for column in args.features.split(",")]
        labels = [label.strip() for label in args.labels.split(",")]
        if any(not column for column in feature_columns + labels):
            raise ValueError("Feature names and labels cannot be empty.")

        models, metadata = train_models(
            frame,
            args.target,
            args.group,
            feature_columns,
            labels,
            args.modality,
        )
        metadata_path = save_model_bundle(
            Path(args.output),
            models,
            metadata,
            model_version=args.version,
            provenance=provenance,
            data_path=data_path,
        )
        print(
            json.dumps(
                {
                    "status": "success",
                    "training_status": "research_only",
                    "metadata_path": str(metadata_path),
                    "models": sorted(models),
                },
                allow_nan=False,
            )
        )
        return 0
    except Exception as error:
        print(
            json.dumps({"status": "error", "message": str(error)}),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
