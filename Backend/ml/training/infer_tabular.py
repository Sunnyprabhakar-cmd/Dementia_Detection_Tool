"""Isolated inference loader for versioned clinical_tabular_research bundles."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from Backend.ml.model_contract import BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION, MODELS


class TabularInferenceError(ValueError):
    pass


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def predict_tabular_bundle(
    features: dict[str, Any],
    *,
    artifact_directory: Path,
    model_version: str,
    model_name: str = "random_forest",
) -> dict[str, Any]:
    """Validate bundle integrity and feature schema, then return structured prediction."""
    if model_name not in MODELS:
        raise TabularInferenceError(f"Unsupported model_name: {model_name}")

    metadata_path = artifact_directory / "metadata.json"
    if not metadata_path.is_file():
        return {"status": "unavailable", "reason": "Bundle metadata.json not found."}

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("format") != BUNDLE_FORMAT or metadata.get("schema_version") != BUNDLE_SCHEMA_VERSION:
        return {"status": "unavailable", "reason": "Incompatible bundle schema."}
    if metadata.get("model_version") != model_version:
        return {"status": "unavailable", "reason": "Requested model_version mismatch."}
    if metadata.get("modality") != "clinical_tabular_research":
        return {"status": "unavailable", "reason": "Unsupported bundle modality."}

    entry = metadata.get("models", {}).get(model_name, {})
    model_path = artifact_directory / str(entry.get("file", ""))
    if not model_path.is_file():
        return {"status": "unavailable", "reason": "Model weights file missing."}
    if _sha256_file(model_path).lower() != str(entry.get("sha256", "")).lower():
        return {"status": "unavailable", "reason": "Model SHA-256 checksum mismatch."}

    if not isinstance(features, dict):
        raise TabularInferenceError("features must be a dict.")

    schema_cols = [item["name"] for item in metadata.get("feature_schema", [])]
    unknown = sorted(set(features) - set(schema_cols))
    if unknown:
        raise TabularInferenceError(f"Unsupported feature(s): {', '.join(unknown)}")

    row: dict[str, Any] = {}
    non_null_count = 0
    for col in schema_cols:
        val = features.get(col)
        if val is None:
            row[col] = None
            continue
        if isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val):
            raise TabularInferenceError(f"Feature '{col}' must be a finite number or null.")
        row[col] = float(val)
        non_null_count += 1

    if non_null_count == 0:
        raise TabularInferenceError("At least one valid feature value is required.")

    model = joblib.load(model_path)
    frame = pd.DataFrame([row], columns=schema_cols)
    pred = str(model.predict(frame)[0])
    probs = model.predict_proba(frame)[0]
    labels = [str(c) for c in model.classes_]
    return {
        "status": "available_research_only",
        "model_version": model_version,
        "model_name": model_name,
        "modality": "clinical_tabular_research",
        "missing_feature_count": len(schema_cols) - non_null_count,
        "output": {
            "predicted_label": pred,
            "class_scores": {lbl: round(float(p), 4) for lbl, p in zip(labels, probs)},
        },
        "limitations": metadata.get("limitations", []),
    }
