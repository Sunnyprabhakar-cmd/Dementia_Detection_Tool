import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parent
DATA_PATH = next((ROOT / "downloaded").glob("*SATURN*.csv"))
SCRIPT_PATH = Path(__file__).resolve()
TARGET = "AUTO_DEMENTIA_INITIAL_VISIT_1yes_0no"
GROUP = "PATIENT"
VERSION = "saturn-baseline-v0.1.0"
DRYAD_VERSION = 3
OUTCOME_SEED = "saturn-baseline-participant-hash-v1"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def participant_hash(value):
    return hashlib.sha256(
        f"{OUTCOME_SEED}:{value}".encode("utf-8")
    ).hexdigest()


def choose_features(frame):
    score_columns = [
        column for column in frame.columns
        if column.startswith("SATURN_SCORE_")
        and column not in {"SATURN_TOTAL_SCORE", "SATURN_POSSIBLE_SCORE"}
    ]
    timing_columns = [
        column for column in frame.columns if column.startswith("SATURN_TIME_")
    ]
    additional_columns = [
        "SATURN_READING_SPEED_median_words_per_s",
        "SATURN_MOTOR_SPEED_ms_per_button",
        "SATURN_TOTAL_TIME_min",
    ]
    return score_columns + timing_columns + [
        column for column in additional_columns if column in frame.columns
    ]


def split_by_subject(frame):
    labels = set(frame[TARGET].astype(int))
    outer = GroupShuffleSplit(n_splits=100, test_size=0.2, random_state=42)
    inner = GroupShuffleSplit(n_splits=100, test_size=0.25, random_state=43)
    for train_validation, test in outer.split(frame, frame[TARGET], frame[GROUP]):
        train_validation_frame = frame.iloc[train_validation]
        for train_relative, validation_relative in inner.split(
            train_validation_frame,
            train_validation_frame[TARGET],
            train_validation_frame[GROUP],
        ):
            train = train_validation[train_relative]
            validation = train_validation[validation_relative]
            partitions = [train, validation, test]
            if all(set(frame.iloc[index][TARGET].astype(int)) == labels for index in partitions):
                groups = [set(frame.iloc[index][GROUP]) for index in partitions]
                if (
                    groups[0].isdisjoint(groups[1])
                    and groups[0].isdisjoint(groups[2])
                    and groups[1].isdisjoint(groups[2])
                ):
                    return partitions
    raise RuntimeError("Could not create subject-disjoint stratified partitions.")


def wilson_interval(successes, trials, z=1.959963984540054):
    proportion = successes / trials
    denominator = 1 + (z**2 / trials)
    center = (proportion + (z**2 / (2 * trials))) / denominator
    margin = (
        z
        * np.sqrt(
            (proportion * (1 - proportion) / trials)
            + (z**2 / (4 * trials**2))
        )
        / denominator
    )
    return [float(center - margin), float(center + margin)]


def evaluate(model, features, target, include_confidence_intervals=False):
    predicted = model.predict(features)
    probabilities = model.predict_proba(features)[:, 1]
    matrix = confusion_matrix(target, predicted, labels=[0, 1])
    tn, fp, fn, tp = matrix.ravel()
    result = {
        "rows": int(len(target)),
        "class_counts": {str(label): int((target == label).sum()) for label in [0, 1]},
        "accuracy": float(accuracy_score(target, predicted)),
        "sensitivity_recall_positive": float(recall_score(target, predicted, pos_label=1, zero_division=0)),
        "specificity_recall_negative": float(recall_score(target, predicted, pos_label=0, zero_division=0)),
        "precision_positive": float(precision_score(target, predicted, pos_label=1, zero_division=0)),
        "f1_positive": float(f1_score(target, predicted, pos_label=1, zero_division=0)),
        "roc_auc": float(roc_auc_score(target, probabilities)),
        "confusion_matrix_labels_0_1": matrix.tolist(),
        "true_negative": int(tn),
        "false_positive": int(fp),
        "false_negative": int(fn),
        "true_positive": int(tp),
    }
    if include_confidence_intervals:
        result["confidence_intervals_95_wilson_sampling_uncertainty"] = {
            "accuracy": wilson_interval(int((predicted == target).sum()), len(target)),
            "sensitivity_recall_positive": wilson_interval(int(tp), int(tp + fn)),
            "specificity_recall_negative": wilson_interval(int(tn), int(tn + fp)),
        }
    return result


def main():
    frame = pd.read_csv(DATA_PATH, encoding="cp1252", na_values=["NA", "na", ""])
    frame = frame[
        frame["INDEX_EVENT"].astype("string").str.upper().eq("SATURN")
        & frame["SATURN_TOTAL_SCORE"].notna()
        & frame[TARGET].notna()
    ].copy()
    features = choose_features(frame)
    if not features:
        raise RuntimeError("No SATURN component/timing features were found.")
    x = frame[features].apply(pd.to_numeric, errors="coerce")
    y = frame[TARGET].astype(int)
    if y.nunique() != 2:
        raise RuntimeError("SATURN target does not contain two classes.")

    train_indices, validation_indices, test_indices = split_by_subject(frame)
    models = {
        "logistic_regression": Pipeline([
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
        ]),
        "random_forest": Pipeline([
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("classifier", RandomForestClassifier(
                n_estimators=500,
                class_weight="balanced",
                random_state=42,
                n_jobs=1,
            )),
        ]),
    }
    output = ROOT / "artifacts" / VERSION
    output.mkdir(parents=True, exist_ok=True)
    feature_schema = {
        "version": VERSION,
        "dryad_version": DRYAD_VERSION,
        "dataset_sha256": sha256(DATA_PATH),
        "target": TARGET,
        "feature_count": len(features),
        "features": features,
        "excluded_columns": [
            TARGET,
            "AUTO_ALZHEIMERS_INITIAL_VISIT_1yes_0no",
            "INDEX_EVENT",
            "PATIENT",
            "SATURN_TOTAL_SCORE",
            "SATURN_POSSIBLE_SCORE",
        ],
    }
    feature_schema_path = ROOT / "feature_schema.json"
    feature_schema_path.write_text(
        json.dumps(feature_schema, indent=2) + "\n",
        encoding="utf-8",
    )
    partitions = {
        "train": train_indices,
        "validation": validation_indices,
        "test": test_indices,
    }
    split_manifest = {
        "version": VERSION,
        "dryad_version": DRYAD_VERSION,
        "dataset_sha256": sha256(DATA_PATH),
        "participant_hash_algorithm": OUTCOME_SEED,
        "feature_count": len(features),
        "features": features,
        "split_seeds": {"outer": 42, "inner": 43},
        "partitions": {},
    }
    for name, indices in partitions.items():
        split_manifest["partitions"][name] = {
            "row_indices": [int(index) for index in indices],
            "participant_hashes": sorted(
                participant_hash(frame.iloc[index][GROUP]) for index in indices
            ),
            "rows": int(len(indices)),
            "subjects": int(frame.iloc[indices][GROUP].nunique()),
            "class_counts": {
                str(label): int((y.iloc[indices] == label).sum())
                for label in [0, 1]
            },
        }
    manifest_path = output / "split_manifest.json"
    manifest_path.write_text(
        json.dumps(split_manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    metadata = {
        "version": VERSION,
        "dataset": {
            "doi": "10.5061/dryad.j9kd51cq4",
            "dryad_version": DRYAD_VERSION,
            "file": DATA_PATH.name,
            "sha256": sha256(DATA_PATH),
        },
        "target": TARGET,
        "feature_count": len(features),
        "label_mapping": {"0": "no automated dementia ICD code at initial visit", "1": "automated dementia ICD code at initial visit"},
        "features": features,
        "excluded_columns": [
            TARGET,
            "AUTO_ALZHEIMERS_INITIAL_VISIT_1yes_0no",
            "INDEX_EVENT",
            "PATIENT",
            "SATURN_TOTAL_SCORE",
            "SATURN_POSSIBLE_SCORE",
        ],
        "subset": {
            "selection": "INDEX_EVENT == SATURN, nonmissing SATURN_TOTAL_SCORE and target",
            "rows": int(len(frame)),
            "subjects": int(frame[GROUP].nunique()),
        },
        "split": {},
        "metrics": {},
        "limitations": [
            "SATURN is not the MindScan task protocol.",
            "The target is an automated ICD-code proxy from retrospective records, not an adjudicated diagnosis.",
            "The dataset is from a single dementia clinic and has substantial missingness.",
            "Scores are research outputs and are not calibrated clinical probabilities.",
            "These artifacts must not be configured for the production API.",
            "No voice features or multimodal fusion were used.",
        ],
        "software": {"python": "3.14", "pandas": pd.__version__, "scikit_learn": sklearn.__version__},
    }
    for name, indices in partitions.items():
        metadata["split"][name] = {
            "rows": int(len(indices)),
            "subjects": int(frame.iloc[indices][GROUP].nunique()),
            "class_counts": {str(label): int((y.iloc[indices] == label).sum()) for label in [0, 1]},
        }

    for name, model in models.items():
        model.fit(x.iloc[train_indices], y.iloc[train_indices])
        metadata["metrics"][name] = {
            "validation": evaluate(model, x.iloc[validation_indices], y.iloc[validation_indices]),
            "test": evaluate(
                model,
                x.iloc[test_indices],
                y.iloc[test_indices],
                include_confidence_intervals=True,
            ),
        }
        joblib.dump(model, output / f"{name}.joblib")

    metadata["provenance"] = {
        "training_script_sha256": sha256(SCRIPT_PATH),
        "feature_schema_sha256": sha256(feature_schema_path),
        "split_manifest_sha256": sha256(manifest_path),
        "model_artifact_sha256": {
            name: sha256(output / f"{name}.joblib") for name in models
        },
    }
    (output / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({
        "status": "success",
        "output": str(output),
        "rows": len(frame),
        "features": len(features),
        "metrics": metadata["metrics"],
    }))


if __name__ == "__main__":
    main()
