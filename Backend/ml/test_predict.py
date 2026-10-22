import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from Backend.ml.predict import InferenceInputError, predict_from_record
from Backend.ml.train_model import save_model_bundle, train_models


class PredictionSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        root = Path(self.temporary_directory.name)
        rows = []
        for participant in range(24):
            label = "group_a" if participant % 2 == 0 else "group_b"
            for repeat in range(2):
                rows.append(
                    {
                        "participant_id": f"p-{participant}",
                        "label": label,
                        "memory_recall_count": float(participant % 2 + repeat),
                        "memory_presented_count": 5.0,
                    }
                )
        self.features = {
            "memory_recall_count": 1.0,
            "memory_presented_count": 5.0,
        }
        models, metadata = train_models(
            pd.DataFrame(rows),
            "label",
            "participant_id",
            list(self.features),
            ["group_a", "group_b"],
            "cognitive_tasks",
        )

        dataset_path = root / "test-only-fixture.csv"
        dataset_path.write_text("test-only fixture\n", encoding="utf-8")
        provenance = {
            "dataset_name": "non-clinical inference fixture",
            "release": "unit-test-only",
            "source_url": "https://example.invalid",
            "authorization_reference": "generated-in-test",
            "license_or_agreement": "test fixture only",
            "model_use_permission": "test fixture only",
            "model_training_and_inference_authorized": True,
            "authorization_confirmed": True,
        }
        self.artifact_directory = root / "bundle"
        self.metadata_path = save_model_bundle(
            self.artifact_directory,
            models,
            metadata,
            model_version="test-1.0.0",
            provenance=provenance,
            data_path=dataset_path,
        )

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_compatible_real_fitted_test_artifact_returns_research_output(self):
        result = predict_from_record(
            {
                "model_version": "test-1.0.0",
                "model_name": "logistic_regression",
                "features": self.features,
            },
            self.artifact_directory,
        )

        self.assertEqual(result["status"], "available_research_only")
        self.assertEqual(result["model_version"], "test-1.0.0")
        self.assertIn(result["output"]["predicted_label"], {"group_a", "group_b"})
        self.assertFalse(result["output"]["scores_are_calibrated_probabilities"])
        self.assertEqual(
            set(result["output"]["class_scores"]), {"group_a", "group_b"}
        )

    def test_missing_model_returns_explicit_unavailable(self):
        result = predict_from_record(
            {
                "model_version": "test-1.0.0",
                "model_name": "logistic_regression",
                "features": self.features,
            },
            self.artifact_directory / "missing",
        )

        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["output"])
        self.assertIn("compatible_trained_model", result["missing_inputs"])

    def test_incompatible_model_version_or_schema_is_unavailable(self):
        wrong_version = predict_from_record(
            {
                "model_version": "wrong-version",
                "model_name": "logistic_regression",
                "features": self.features,
            },
            self.artifact_directory,
        )
        self.assertEqual(wrong_version["status"], "unavailable")
        self.assertIsNone(wrong_version["output"])

        metadata = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        metadata["schema_version"] = 999
        self.metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
        try:
            result = predict_from_record(
                {
                    "model_version": "test-1.0.0",
                    "model_name": "logistic_regression",
                    "features": self.features,
                },
                self.artifact_directory,
            )
            self.assertEqual(result["status"], "unavailable")
            self.assertIsNone(result["output"])
        finally:
            metadata["schema_version"] = 1
            self.metadata_path.write_text(json.dumps(metadata), encoding="utf-8")

    def test_missing_and_invalid_features_are_not_defaulted(self):
        missing = predict_from_record(
            {
                "model_version": "test-1.0.0",
                "model_name": "logistic_regression",
                "features": {"memory_recall_count": 1.0},
            },
            self.artifact_directory,
        )
        self.assertEqual(missing["status"], "unavailable")
        self.assertEqual(missing["missing_inputs"], ["memory_presented_count"])
        self.assertIsNone(missing["output"])

        with self.assertRaises(InferenceInputError):
            predict_from_record(
                {
                    "model_version": "test-1.0.0",
                    "model_name": "logistic_regression",
                    "features": {
                        **self.features,
                        "memory_recall_count": float("nan"),
                    },
                },
                self.artifact_directory,
            )
        with self.assertRaises(InferenceInputError):
            predict_from_record(
                {
                    "model_version": "test-1.0.0",
                    "model_name": "logistic_regression",
                    "features": {**self.features, "Age": 70},
                },
                self.artifact_directory,
            )

    def test_artifact_checksum_is_verified_before_loading(self):
        metadata = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        model_path = self.artifact_directory / metadata["models"]["logistic_regression"]["file"]
        model_path.write_bytes(model_path.read_bytes() + b"tampered")

        result = predict_from_record(
            {
                "model_version": "test-1.0.0",
                "model_name": "logistic_regression",
                "features": self.features,
            },
            self.artifact_directory,
        )
        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["output"])

    def test_model_use_permission_is_required_at_inference(self):
        metadata = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        metadata["dataset"]["model_training_and_inference_authorized"] = False
        self.metadata_path.write_text(json.dumps(metadata), encoding="utf-8")

        result = predict_from_record(
            {
                "model_version": "test-1.0.0",
                "model_name": "logistic_regression",
                "features": self.features,
            },
            self.artifact_directory,
        )

        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["output"])
        self.assertIn("verified_model_provenance", result["missing_inputs"])


if __name__ == "__main__":
    unittest.main()
