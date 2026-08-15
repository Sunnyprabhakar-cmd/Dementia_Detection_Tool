import json
import pickle
from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "dementia_dataset.csv"
ARTIFACT_DIR = Path(__file__).resolve().parent.parent.parent / "artifacts" / "models" / "tabular" / "baseline_v1"
MODEL_PATH = ARTIFACT_DIR / "model.pkl"
PREPROCESSOR_PATH = ARTIFACT_DIR / "preprocessor.pkl"
METADATA_PATH = ARTIFACT_DIR / "metadata.json"


def build_tabular_baseline():
    df = pd.read_csv(DATASET_PATH)
    df = df.copy()
    df["target"] = df["Group"].map({"Nondemented": 0, "Demented": 1, "Converted": 1})

    subject_column = "Subject ID"
    feature_columns = [
        c for c in df.columns
        if c not in {"Subject ID", "MRI ID", "Group", "target"}
    ]

    X = df[feature_columns]
    y = df["target"]
    groups = df[subject_column]

    categorical = X.select_dtypes(include=["object", "category", "string"]).columns.tolist()
    numeric = [c for c in X.columns if c not in categorical]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler())
            ]), numeric),
            ("cat", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore"))
            ]), categorical)
        ]
    )

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))

    X_train = X.iloc[train_idx].reset_index(drop=True)
    X_test = X.iloc[test_idx].reset_index(drop=True)
    y_train = y.iloc[train_idx].reset_index(drop=True)
    y_test = y.iloc[test_idx].reset_index(drop=True)

    model = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(max_iter=2000, class_weight="balanced"))
    ])

    model.fit(X_train, y_train)
    prob = model.predict_proba(X_test)[:, 1]
    pred = model.predict(X_test)

    prfs = precision_recall_fscore_support(y_test, pred, labels=[0, 1], zero_division=0)
    metrics = {
        "accuracy": float((pred == y_test).mean()),
        "f1_weighted": float(f1_score(y_test, pred, average="weighted")),
        "f1_binary": float(f1_score(y_test, pred, average="binary", zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, prob)),
        "precision_recall_fscore_support": {
            "precision": prfs[0].tolist(),
            "recall": prfs[1].tolist(),
            "f1": prfs[2].tolist(),
            "support": prfs[3].tolist()
        },
        "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
        "classification_report": classification_report(y_test, pred, target_names=["Nondemented", "Dementia_or_Converted"], zero_division=0, output_dict=True),
        "support": {
            "train": int(len(y_train)),
            "test": int(len(y_test)),
            "positive_test": int(y_test.sum()),
            "negative_test": int((1 - y_test).sum())
        }
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(PREPROCESSOR_PATH, "wb") as f:
        pickle.dump(preprocessor, f)

    metadata = {
        "dataset_path": str(DATASET_PATH),
        "target": "Group -> {Nondemented:0, Demented:1, Converted:1}",
        "subject_split": "GroupShuffleSplit with Subject ID grouping",
        "feature_columns": feature_columns,
        "model_type": "LogisticRegression",
        "train_test_counts": {"train": int(len(y_train)), "test": int(len(y_test))},
        "metrics": metrics,
        "limitations": [
            "This is a research prototype baseline using an OASIS-style longitudinal cohort.",
            "The task classifies a cohort-level observation without validating clinical deployment thresholds.",
            "Audio and tabular data are not linked by subject and therefore cannot be fused with methodological validity in this dataset."
        ]
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(json.dumps({
        "status": "success",
        "model_path": str(MODEL_PATH),
        "metrics": metrics,
        "test_rows": int(len(y_test))
    }, indent=2))


if __name__ == "__main__":
    build_tabular_baseline()
