"""Shared constants for versioned MindScan research model bundles."""

from pathlib import Path
import json

BUNDLE_FORMAT = "mindscan-research-model"
BUNDLE_SCHEMA_VERSION = 2

_FEATURE_SCHEMA_PATH = Path(__file__).with_name("feature_schema.json")
_FEATURE_SCHEMA = json.loads(_FEATURE_SCHEMA_PATH.read_text(encoding="utf-8"))
FEATURES_BY_MODALITY = {
    modality: {
        item["name"] for item in definition["features"]
    }
    for modality, definition in _FEATURE_SCHEMA["modalities"].items()
}
TASK_FEATURES = FEATURES_BY_MODALITY["cognitive_tasks"]
SPEECH_FEATURES = FEATURES_BY_MODALITY["speech"]
MODELS = ("logistic_regression", "random_forest")
DEFAULT_ARTIFACT_DIRECTORY = (
    Path(__file__).resolve().parents[2]
    / "artifacts"
    / "models"
    / "research"
)
