"""Run the optional, versioned speech model through the project's inference contract."""

import json
import math
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

try:
    from .model_contract import MODELS, SPEECH_FEATURES
except ImportError:
    from model_contract import MODELS, SPEECH_FEATURES


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PREDICT_SCRIPT = Path(__file__).resolve().with_name("predict.py")
_FEATURE_NAME_MAP = {
    "voice_audio_duration_seconds": "audio_duration_seconds",
    "voice_speaking_duration_seconds": "speaking_duration_seconds",
    "voice_transcript_word_count": "transcript_word_count",
    "voice_transcript_character_count": "transcript_character_count",
    "voice_speech_rate_words_per_minute": "speech_rate_words_per_minute",
    "voice_pause_count": "pause_count",
    "voice_mean_pause_seconds": "mean_pause_seconds",
    "voice_maximum_pause_seconds": "maximum_pause_seconds",
    "voice_estimated_non_speech_ratio": "estimated_non_speech_ratio",
    "voice_filler_word_count": "filler_word_count",
    "voice_adjacent_repeated_word_count": "adjacent_repeated_word_count",
    "voice_lexical_diversity": "lexical_diversity",
    "voice_mean_sentence_length_words": "mean_sentence_length_words",
}


def _unavailable(
    message: str = "Research analysis only — classifier unavailable.",
    *,
    model_version: str | None = None,
    missing_inputs: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "model_version": model_version,
        "prediction": None,
        "message": message,
        "missing_inputs": missing_inputs or [],
        "limitations": [
            "Research-only output; not a clinical diagnosis or risk estimate.",
            "The model must be trained and evaluated on authorized, participant-labelled speech data.",
        ],
    }


def _model_features(speech_features: dict[str, Any]) -> dict[str, Any]:
    extracted = speech_features.get("features")
    if not isinstance(extracted, dict):
        raise ValueError("Speech feature extraction did not return a feature object.")
    unknown = set(extracted) - set(_FEATURE_NAME_MAP.values()) - {
        "pitch_mean_hz",
        "pitch_std_hz",
        "sentence_count",
    }
    if unknown:
        raise ValueError("Unexpected speech feature schema.")
    return {
        model_name: extracted.get(extracted_name)
        for model_name, extracted_name in _FEATURE_NAME_MAP.items()
        if model_name in SPEECH_FEATURES
    }


def _validated_prediction(
    result: Any,
    *,
    model_version: str,
    model_name: str,
) -> dict[str, Any]:
    if not isinstance(result, dict) or result.get("status") != "available_research_only":
        return _unavailable(model_version=model_version)
    if (
        result.get("model_version") != model_version
        or result.get("model_name") != model_name
        or result.get("modality") != "speech"
        or result.get("evaluation_status") != "participant_grouped_train_validation_test"
    ):
        return _unavailable("The installed audio model output is incompatible.", model_version=model_version)

    output = result.get("output")
    labels = result.get("labels")
    if not isinstance(output, dict):
        return _unavailable("The installed audio model output is invalid.", model_version=model_version)
    predicted_label = output.get("predicted_label")
    scores = output.get("class_scores")
    if (
        not isinstance(predicted_label, str)
        or not isinstance(labels, list)
        or len(labels) < 2
        or any(not isinstance(label, str) for label in labels)
        or len(labels) != len(set(labels))
        or not isinstance(scores, dict)
        or set(scores) != set(labels)
        or predicted_label not in scores
        or output.get("scores_are_calibrated_probabilities") is not False
        or any(
            not isinstance(label, str)
            or isinstance(score, bool)
            or not isinstance(score, (int, float))
            or not math.isfinite(score)
            or score < 0
            or score > 1
            for label, score in scores.items()
        )
    ):
        return _unavailable("The installed audio model output is invalid.", model_version=model_version)

    return {
        "status": "available_research_only",
        "model_version": model_version,
        "prediction": {
            "predicted_label": predicted_label,
            "class_scores": {
                label: round(float(score), 6) for label, score in scores.items()
            },
            "scores_are_calibrated_probabilities": False,
        },
        "message": "Research analysis only — not a diagnosis or clinical risk estimate.",
        "evaluation_status": result["evaluation_status"],
        "limitations": result.get("limitations", []),
    }


def classify_speech_features(
    speech_features: Any,
    *,
    artifact_directory: str | Path | None = None,
    model_version: str | None = None,
    model_name: str = "logistic_regression",
    python_executable: str | None = None,
    runner: Callable[..., Any] = subprocess.run,
) -> dict[str, Any]:
    if not isinstance(speech_features, dict) or speech_features.get("status") not in {
        "complete",
        "partial",
    }:
        return _unavailable(
            missing_inputs=["usable_speech_features"],
            model_version=model_version,
        )
    if model_name not in MODELS:
        return _unavailable("The configured audio model type is unsupported.", model_version=model_version)
    if not isinstance(model_version, str) or not model_version.strip():
        return _unavailable(missing_inputs=["configured_audio_model_version"])
    if not artifact_directory:
        return _unavailable(
            model_version=model_version,
            missing_inputs=["configured_audio_model_artifact"],
        )

    artifact_path = Path(artifact_directory).expanduser()
    if not (artifact_path / "metadata.json").is_file():
        return _unavailable(
            model_version=model_version,
            missing_inputs=["compatible_trained_audio_model"],
        )
    try:
        features = _model_features(speech_features)
    except (TypeError, ValueError):
        return _unavailable(
            "Speech features do not match the trained model contract.",
            model_version=model_version,
            missing_inputs=["compatible_speech_feature_schema"],
        )

    default_python = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
    executable = python_executable or (
        str(default_python) if default_python.is_file() else sys.executable
    )
    try:
        process = runner(
            [
                executable,
                str(PREDICT_SCRIPT),
                "--artifact-dir",
                str(artifact_path),
                "--model-version",
                model_version,
                "--model-name",
                model_name,
            ],
            input=json.dumps({"features": features}, allow_nan=False),
            capture_output=True,
            text=True,
            timeout=30,
            cwd=PROJECT_ROOT,
            check=False,
        )
        result = json.loads(process.stdout)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError, TypeError, ValueError):
        return _unavailable("Audio model inference could not be completed.", model_version=model_version)
    return _validated_prediction(
        result,
        model_version=model_version,
        model_name=model_name,
    )


def classify_configured_audio(speech_features: Any) -> dict[str, Any]:
    model_version = os.environ.get("MINDSCAN_AUDIO_MODEL_VERSION")
    try:
        return classify_speech_features(
            speech_features,
            artifact_directory=os.environ.get("MINDSCAN_AUDIO_MODEL_DIR"),
            model_version=model_version,
            model_name=os.environ.get(
                "MINDSCAN_AUDIO_MODEL_NAME", "logistic_regression"
            ),
            python_executable=os.environ.get("MINDSCAN_AUDIO_MODEL_PYTHON"),
        )
    except Exception:
        return _unavailable(
            "Audio model inference could not be completed.",
            model_version=model_version,
        )
