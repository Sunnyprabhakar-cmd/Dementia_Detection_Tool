"""Unit and integration tests for the experimental DementiaNet acoustic PoC classifier."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from Backend.ml.audio_classifier import DEFAULT_ACOUSTIC_POC_DIR, classify_acoustic_poc

ACOUSTIC_FEATURE_COLS = [
    "voiced_frame_ratio", "voiced_unvoiced_ratio",
    "energy_rms_mean", "energy_rms_std", "zcr_mean",
    "spectral_centroid_hz", "spectral_bandwidth_hz", "spectral_rolloff_hz",
    "pitch_mean_hz", "pitch_median_hz", "pitch_std_hz", "pitch_range_hz",
    "jitter_local", "shimmer_local", "hnr_mean_db",
    "waveform_silence_ratio", "waveform_pause_count", "waveform_mean_pause_seconds",
    *[f"mfcc_{i}_mean" for i in range(1, 14)],
    *[f"mfcc_{i}_std" for i in range(1, 14)],
]


def _build_temp_poc_bundle(root: Path, tamper_sha: bool = False) -> Path:
    bundle = root / "poc-bundle"
    bundle.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    x = rng.normal(size=(24, len(ACOUSTIC_FEATURE_COLS)))
    y = np.array([0] * 12 + [1] * 12)
    pipe = Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression())])
    pipe.fit(x, y)
    model_path = bundle / "logistic_regression.joblib"
    joblib.dump(pipe, model_path)
    sha = hashlib.sha256(model_path.read_bytes()).hexdigest()
    if tamper_sha:
        sha = "0" * 64
    metadata = {
        "format": "mindscan-research-model",
        "schema_version": 2,
        "model_version": "dementianet-acoustic-test-v1",
        "modality": "speech_acoustic_poc",
        "labels": ["0", "1"],
        "label_mapping": {"0": "nodementia", "1": "dementia"},
        "feature_schema": [{"name": col, "type": "number"} for col in ACOUSTIC_FEATURE_COLS],
        "models": {
            "logistic_regression": {
                "artifact": "logistic_regression.joblib",
                "sha256": sha,
            }
        },
        "limitations": [
            "Experimental speech-based research screening output — not a clinical diagnosis.",
        ],
    }
    (bundle / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
    return bundle


def _sample_speech_intelligence(language: str = "en", quality_reliable: bool = True) -> dict:
    return {
        "language": language,
        "quality_reliable": quality_reliable,
        "acoustic_features": {col: float(idx + 1) * 0.1 for idx, col in enumerate(ACOUSTIC_FEATURE_COLS)},
    }


class DementiaNetPocTests(unittest.TestCase):
    def test_valid_english_reliable_audio_scores(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = _build_temp_poc_bundle(Path(tmp))
            result = classify_acoustic_poc(
                _sample_speech_intelligence(language="en", quality_reliable=True),
                artifact_directory=bundle,
                model_name="logistic_regression",
            )
            self.assertEqual(result["status"], "available_experimental_poc")
            self.assertIn(result["classification_outcome"], {"Dementia", "Non-dementia"})
            self.assertEqual(result["decision_threshold"]["cutoff"], 0.50)
            self.assertFalse(result["decision_threshold"]["clinically_validated"])
            self.assertEqual(result["model_version"], "dementianet-acoustic-test-v1")
            self.assertIn(result["prediction"]["predicted_label"], {"nodementia", "dementia"})
            self.assertEqual(set(result["prediction"]["class_scores"].keys()), {"nodementia", "dementia"})
            self.assertFalse(result["prediction"]["scores_are_calibrated_probabilities"])

    def test_non_english_speech_is_gated_out(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = _build_temp_poc_bundle(Path(tmp))
            result = classify_acoustic_poc(
                _sample_speech_intelligence(language="hi", quality_reliable=True),
                artifact_directory=bundle,
            )
            self.assertEqual(result["status"], "unavailable")
            self.assertEqual(result["classification_outcome"], "Inconclusive")
            self.assertIn("english_speech_required", result["missing_inputs"])

    def test_unreliable_audio_quality_is_gated_out(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = _build_temp_poc_bundle(Path(tmp))
            result = classify_acoustic_poc(
                _sample_speech_intelligence(language="en", quality_reliable=False),
                artifact_directory=bundle,
            )
            self.assertEqual(result["status"], "unavailable")
            self.assertIn("reliable_audio_quality", result["missing_inputs"])

    def test_missing_or_nan_feature_never_fabricated(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = _build_temp_poc_bundle(Path(tmp))
            si = _sample_speech_intelligence()
            si["acoustic_features"]["pitch_mean_hz"] = None
            result = classify_acoustic_poc(si, artifact_directory=bundle)
            self.assertEqual(result["status"], "unavailable")
            self.assertIn("pitch_mean_hz", result["missing_inputs"])

    def test_sha256_tampering_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = _build_temp_poc_bundle(Path(tmp), tamper_sha=True)
            result = classify_acoustic_poc(_sample_speech_intelligence(), artifact_directory=bundle)
            self.assertEqual(result["status"], "unavailable")
            self.assertEqual(result["classification_outcome"], "Model unavailable")
            self.assertIn("integrity", result["message"].lower())

    @unittest.skipUnless((DEFAULT_ACOUSTIC_POC_DIR / "metadata.json").is_file(), "Trained DementiaNet bundle not yet present")
    def test_trained_dementianet_bundle_integrity_and_inference(self):
        result = classify_acoustic_poc(_sample_speech_intelligence())
        self.assertEqual(result["status"], "available_experimental_poc")
        self.assertEqual(result["model_version"], "dementianet-acoustic-v1.0.0")
        self.assertIn(result["prediction"]["predicted_label"], {"nodementia", "dementia"})


if __name__ == "__main__":
    unittest.main()
