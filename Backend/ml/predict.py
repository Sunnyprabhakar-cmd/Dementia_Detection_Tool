"""Input-validated inference for trusted, versioned research model bundles."""

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

if __package__:
    from .model_contract import (
        BUNDLE_FORMAT,
        BUNDLE_SCHEMA_VERSION,
        DEFAULT_ARTIFACT_DIRECTORY,
        FEATURES_BY_MODALITY,
        MODELS,
    )
else:
    from model_contract import (
        BUNDLE_FORMAT,
        BUNDLE_SCHEMA_VERSION,
        DEFAULT_ARTIFACT_DIRECTORY,
        FEATURES_BY_MODALITY,
        MODELS,
    )


class InferenceInputError(ValueError):
    pass


def unavailable(
    reason: str,
    *,
    model_version: str | None = None,
    missing_inputs: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "code": "model_unavailable",
        "model_version": model_version,
        "output": None,
        "evaluation_status": "not_run",
        "missing_inputs": missing_inputs or [],
        "reason": reason,
        "limitations": [
            "Research/educational output only; not a diagnosis or clinical risk assessment.",
            "Class scores are uncalibrated and must not be interpreted as probabilities.",
        ],
    }


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_bundle(
    artifact_directory: Path,
    model_version: str,
    model_name: str,
) -> tuple[dict[str, Any], Any] | dict[str, Any]:
    metadata_path = artifact_directory / "metadata.json"
    if not metadata_path.is_file():
        return unavailable(
            "No compatible model artifact is installed.",
            model_version=model_version,
            missing_inputs=["compatible_trained_model"],
        )

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return unavailable("Model metadata is unreadable.", model_version=model_version)

    if metadata.get("format") != BUNDLE_FORMAT or metadata.get("schema_version") != BUNDLE_SCHEMA_VERSION:
        return unavailable("Model artifact schema is incompatible.", model_version=model_version)
    if metadata.get("model_version") != model_version:
        return unavailable("Requested model version is not installed.", model_version=model_version)
    dataset = metadata.get("dataset")
    if (
        not isinstance(dataset, dict)
        or dataset.get("authorization_confirmed") is not True
        or dataset.get("model_training_and_inference_authorized") is not True
        or not dataset.get("license_or_agreement")
        or not dataset.get("model_use_permission")
        or not isinstance(dataset.get("sha256"), str)
        or len(dataset["sha256"]) != 64
        or any(char not in "0123456789abcdefABCDEF" for char in dataset["sha256"])
    ):
        return unavailable(
            "Model source authorization or provenance is missing.",
            model_version=model_version,
            missing_inputs=["verified_model_provenance"],
        )
    if model_name not in MODELS:
        return unavailable("Requested model type is unsupported.", model_version=model_version)

    modality = metadata.get("modality")
    if modality not in FEATURES_BY_MODALITY:
        return unavailable("Model modality is incompatible.", model_version=model_version)

    model_entry = metadata.get("models", {}).get(model_name)
    filename = model_entry.get("file") if isinstance(model_entry, dict) else None
    if not isinstance(filename, str) or Path(filename).name != filename:
        return unavailable("Model artifact file is incompatible.", model_version=model_version)

    model_path = artifact_directory / filename
    if not model_path.is_file():
        return unavailable(
            "Model weights are missing.",
            model_version=model_version,
            missing_inputs=["model_weights"],
        )
    if _sha256(model_path).lower() != str(model_entry.get("sha256", "")).lower():
        return unavailable("Model artifact checksum does not match metadata.", model_version=model_version)

    schema = metadata.get("feature_schema")
    if not isinstance(schema, list) or not schema:
        return unavailable("Model feature schema is missing.", model_version=model_version)
    schema_names = [entry.get("name") for entry in schema if isinstance(entry, dict)]
    if (
        len(schema_names) != len(schema)
        or len(schema_names) != len(set(schema_names))
        or not set(schema_names).issubset(FEATURES_BY_MODALITY[modality])
    ):
        return unavailable("Model feature schema is incompatible.", model_version=model_version)

    try:
        model = joblib.load(model_path)
    except Exception:
        return unavailable("Model weights could not be loaded.", model_version=model_version)
    labels = metadata.get("labels")
    model_labels = (
        [str(label) for label in model.classes_]
        if hasattr(model, "classes_")
        else []
    )
    if (
        not isinstance(labels, list)
        or set(labels) != set(model_labels)
        or not hasattr(model, "predict_proba")
    ):
        return unavailable(
            "Model labels or output contract are incompatible.",
            model_version=model_version,
        )
    return metadata, model


def _validate_features(
    features: Any,
    metadata: dict[str, Any],
) -> tuple[pd.DataFrame | None, list[str]]:
    if not isinstance(features, dict):
        raise InferenceInputError("features must be a JSON object.")

    allowed = set().union(*FEATURES_BY_MODALITY.values())
    unknown = sorted(set(features) - allowed)
    if unknown:
        raise InferenceInputError(
            "Unsupported feature name(s): " + ", ".join(unknown)
        )

    schema = metadata["feature_schema"]
    missing = [
        item["name"]
        for item in schema
        if item["name"] not in features
        or (features[item["name"]] is None and item.get("required", True))
    ]
    if missing:
        return None, missing

    row: dict[str, Any] = {}
    for item in schema:
        name = item["name"]
        value = features.get(name)
        if value is None:
            row[name] = None
            continue
        if item.get("type") == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise InferenceInputError(f"Feature '{name}' must be numeric or null.")
            if not math.isfinite(value):
                raise InferenceInputError(f"Feature '{name}' must be finite.")
            if value < item["minimum"] or value > item["maximum"]:
                raise InferenceInputError(
                    f"Feature '{name}' is outside its training range."
                )
            row[name] = float(value)
        elif item.get("type") == "category":
            if not isinstance(value, str) or value not in item.get("allowed_values", []):
                raise InferenceInputError(
                    f"Feature '{name}' is not an allowed training category."
                )
            row[name] = value
        else:
            raise InferenceInputError(
                f"Feature schema for '{name}' has an unsupported type."
            )

    return pd.DataFrame([row], columns=[item["name"] for item in schema]), []


def predict_from_record(
    request: dict[str, Any],
    artifact_directory: Path | str,
) -> dict[str, Any]:
    if not isinstance(request, dict):
        raise InferenceInputError("Request must be a JSON object.")
    model_version = request.get("model_version")
    model_name = request.get("model_name")
    if not isinstance(model_version, str) or not model_version.strip():
        raise InferenceInputError("model_version is required.")
    if model_name not in MODELS:
        raise InferenceInputError("model_name must identify a supported model.")

    artifact_directory = Path(artifact_directory).expanduser()
    loaded = _load_bundle(artifact_directory, model_version, model_name)
    if isinstance(loaded, dict):
        return loaded
    metadata, model = loaded

    frame, missing = _validate_features(request.get("features"), metadata)
    if missing:
        return unavailable(
            "Required model features are missing.",
            model_version=model_version,
            missing_inputs=missing,
        )
    assert frame is not None

    try:
        prediction = str(model.predict(frame)[0])
        if not hasattr(model, "predict_proba"):
            return unavailable(
                "The installed model does not provide class scores.",
                model_version=model_version,
            )
        probabilities = model.predict_proba(frame)[0]
        classes = [str(label) for label in model.classes_]
    except Exception:
        return unavailable(
            "Model inference failed.",
            model_version=model_version,
        )

    evaluation = metadata.get("evaluation", {})
    return {
        "status": "available_research_only",
        "model_version": metadata["model_version"],
        "model_name": model_name,
        "modality": metadata["modality"],
        "labels": classes,
        "output": {
            "predicted_label": prediction,
            "class_scores": {
                label: round(float(score), 6)
                for label, score in zip(classes, probabilities, strict=True)
            },
            "scores_are_calibrated_probabilities": False,
        },
        "evaluation_status": evaluation.get("status", "not_recorded"),
        "evaluation_summary": evaluation.get("models", {}).get(model_name),
        "missing_inputs": [],
        "limitations": [
            "Research/educational output only; not a diagnosis or clinical risk assessment.",
            "Class scores are uncalibrated and must not be interpreted as probabilities.",
            "Participant-grouped holdout evaluation does not establish external or clinical validity.",
        ],
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run validated research-model inference.")
    parser.add_argument("--artifact-dir", required=True)
    parser.add_argument("--model-version", required=True)
    parser.add_argument("--model-name", required=True, choices=MODELS)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        request = json.load(sys.stdin)
        request["model_version"] = args.model_version
        request["model_name"] = args.model_name
        result = predict_from_record(request, args.artifact_dir)
        print(json.dumps(result, allow_nan=False))
        return 0 if result["status"] == "available_research_only" else 3
    except (json.JSONDecodeError, InferenceInputError) as error:
        print(
            json.dumps({"status": "invalid_input", "message": str(error)}),
            file=sys.stdout,
        )
        return 2
    except Exception:
        print(
            json.dumps(
                unavailable(
                    "Inference could not be completed.",
                    model_version=args.model_version,
                ),
                allow_nan=False,
            ),
            file=sys.stdout,
        )
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
