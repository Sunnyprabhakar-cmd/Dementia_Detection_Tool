import argparse
import json
import pickle
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = PROJECT_ROOT / "artifacts" / "models" / "tabular" / "baseline_v1" / "model.pkl"
METADATA_PATH = PROJECT_ROOT / "artifacts" / "models" / "tabular" / "baseline_v1" / "metadata.json"


def load_model(model_path: str | Path | None = None):
    chosen = Path(model_path) if model_path else MODEL_PATH
    if not chosen.exists():
        raise FileNotFoundError(f"Trained model not found at {chosen}. Run Backend/ml/tabular_baseline.py first.")
    with open(chosen, "rb") as f:
        return pickle.load(f)


def load_metadata():
    if not METADATA_PATH.exists():
        return {"feature_columns": [
            "Visit","MR Delay","M/F","Hand","Age","EDUC","SES","MMSE","CDR","eTIV","nWBV","ASF"
        ]}
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_record(record: dict):
    metadata = load_metadata()
    features = metadata.get("feature_columns", [])
    normalized = {}

    for field in features:
        if field in record:
            normalized[field] = record[field]

    if "M/F" in record and isinstance(record["M/F"], str):
        normalized["M/F"] = record["M/F"].strip().upper()
    if "Hand" in record and isinstance(record["Hand"], str):
        normalized["Hand"] = record["Hand"].strip().upper()

    for key, value in normalized.items():
        if isinstance(value, str):
            if value.strip() == "":
                normalized[key] = None
        if key in {"Visit", "MR Delay", "Age", "EDUC", "SES", "MMSE", "CDR", "eTIV", "nWBV", "ASF"}:
            try:
                normalized[key] = float(value)
            except (TypeError, ValueError):
                normalized[key] = None

    return normalized


def predict_from_record(record: dict, model_path: str | Path | None = None):
    model = load_model(model_path)
    normalized = normalize_record(record)
    df = pd.DataFrame([normalized])
    prediction = int(model.predict(df)[0])
    probability = model.predict_proba(df)[0]
    risk = float(probability[1]) if len(probability) > 1 else float(probability[0])

    return {
        "prediction": prediction,
        "risk_probability": round(risk, 4),
        "label": "Dementia_or_Converted" if prediction == 1 else "Nondemented",
        "model_version": "tabular/baseline_v1",
        "input_fields": list(normalized.keys()),
        "status": "success"
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Run the trained tabular dementia baseline model.")
    parser.add_argument("--record", type=str, default=None, help="JSON string containing the record to score.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        sample = {
            "Visit": 1,
            "MR Delay": 0,
            "M/F": "M",
            "Hand": "R",
            "Age": 75,
            "EDUC": 12,
            "SES": 2,
            "MMSE": 23,
            "CDR": 0.5,
            "eTIV": 1678,
            "nWBV": 0.736,
            "ASF": 1.046,
        }
        record = json.loads(args.record) if args.record else sample
        print(json.dumps(predict_from_record(record)))
    except Exception as exc:
        print(json.dumps({"status": "error", "message": str(exc)}))
        sys.exit(1)
