import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


OUTPUT_MODEL_PATH = Path(__file__).resolve().parent / "models" / "dementia_model.joblib"


def build_synthetic_dataset(rows=300):
    rng = np.random.default_rng(42)
    age = rng.integers(50, 95, size=rows)
    education = rng.integers(4, 20, size=rows)
    mmse = rng.integers(12, 30, size=rows)
    memory = rng.integers(20, 100, size=rows)
    attention = rng.integers(25, 100, size=rows)
    language = rng.integers(25, 100, size=rows)
    orientation = rng.integers(35, 100, size=rows)
    hypertension = rng.integers(0, 2, size=rows)
    diabetes = rng.integers(0, 2, size=rows)
    gender = rng.choice(["M", "F"], size=rows)

    dementia_prob = (
        (age - 50) * 0.02
        + (100 - mmse) * 0.04
        + (100 - memory) * 0.015
        + (100 - attention) * 0.012
        + (100 - language) * 0.01
        + (100 - orientation) * 0.01
        + hypertension * 4
        + diabetes * 3
    )
    diagnosis = (rng.random(rows) < (1 / (1 + np.exp(-dementia_prob / 15))))
    data = pd.DataFrame({
        "age": age,
        "education": education,
        "mmse": mmse,
        "memory_score": memory,
        "attention_score": attention,
        "language_score": language,
        "orientation_score": orientation,
        "hypertension": hypertension,
        "diabetes": diabetes,
        "gender": gender,
        "diagnosis": diagnosis.astype(int),
    })
    return data


def load_dataset(path: str | None):
    if path and os.path.exists(path):
        ext = str(path).lower()
        if ext.endswith(".csv"):
            df = pd.read_csv(path)
        elif ext.endswith((".xlsx", ".xls")):
            df = pd.read_excel(path)
        else:
            raise ValueError("Unsupported dataset format. Use CSV or Excel.")
        return df

    return build_synthetic_dataset()


def prepare_model_and_metrics(df: pd.DataFrame, target_col: str):
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataset.")

    label_column = target_col
    feature_columns = [col for col in df.columns if col != label_column]
    X = df[feature_columns]
    y = df[label_column]

    numeric_features = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = [col for col in X.columns if col not in numeric_features]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric_features),
            ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]), categorical_features),
        ]
    )

    model = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(max_iter=2000, class_weight="balanced"))
    ])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "f1_score": round(float(f1_score(y_test, predictions, average="weighted")), 4),
        "classification_report": classification_report(y_test, predictions, zero_division=0, output_dict=True),
        "classes": [int(value) for value in sorted(np.unique(y))],
        "features": feature_columns,
        "rows": int(len(df)),
    }

    return model, metrics


def save_model(model, dest: Path):
    try:
        import joblib
    except ImportError:
        raise RuntimeError("joblib is required to save the trained model.")

    dest.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, dest)


def parse_args():
    parser = argparse.ArgumentParser(description="Train a dementia risk model.")
    parser.add_argument("--data", type=str, default=None, help="Path to CSV/XLSX dataset. If omitted, a synthetic dataset is used.")
    parser.add_argument("--target", type=str, default="diagnosis", help="Target column name for dementia label.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        df = load_dataset(args.data)
        model, metrics = prepare_model_and_metrics(df, args.target)
        save_model(model, OUTPUT_MODEL_PATH)

        output = {
            "status": "success",
            "model_path": str(OUTPUT_MODEL_PATH),
            "metrics": metrics,
            "message": "Baseline dementia classifier trained successfully."
        }
        print(json.dumps(output))
    except Exception as exc:
        error = {"status": "error", "message": str(exc)}
        print(json.dumps(error))
        sys.exit(1)
