import tempfile
import unittest
from pathlib import Path

from Backend.ml.predict import predict_from_record
from Backend.ml.training.infer_tabular import TabularInferenceError, predict_tabular_bundle
from Backend.ml.training.pipeline import (
    ZENODO_13378346_FEATURES,
    load_zenodo_13378346,
    run_training_and_evaluation,
)


ROOT = Path(__file__).resolve().parents[2]
ZENODO_13378346 = ROOT / "research-data" / "open_zenodo" / "zenodo_13378346_dataset.xlsx"


class TrainingPipelineTests(unittest.TestCase):
    @unittest.skipUnless(ZENODO_13378346.is_file(), "Zenodo 13378346 dataset not present")
    def test_dataset_loading_reproducible_training_and_bundle_inference(self):
        df, _ = load_zenodo_13378346(ZENODO_13378346)
        self.assertEqual(len(df), 283)
        self.assertEqual(df["Nr"].nunique(), 283)

        with tempfile.TemporaryDirectory() as tmp:
            run_training_and_evaluation(
                ZENODO_13378346,
                Path(tmp),
                model_version="zenodo-test-v1",
                random_state=42,
            )
            bundle = Path(tmp) / "zenodo-test-v1"
            self.assertTrue((bundle / "metadata.json").is_file())
            self.assertTrue((bundle / "logistic_regression.joblib").is_file())
            self.assertTrue((bundle / "random_forest.joblib").is_file())

            sample_record = {
                col: (float(df[col].median()) if df[col].notna().any() else None)
                for col in ZENODO_13378346_FEATURES
            }
            pred = predict_tabular_bundle(
                sample_record,
                artifact_directory=bundle,
                model_version="zenodo-test-v1",
                model_name="random_forest",
            )
            self.assertEqual(pred["status"], "available_research_only")
            self.assertIn(pred["output"]["predicted_label"], ("0", "1"))

            # Live predict.py must reject isolated clinical_tabular_research modality
            live_check = predict_from_record(
                {
                    "model_version": "zenodo-test-v1",
                    "model_name": "random_forest",
                    "features": sample_record,
                },
                bundle,
            )
            self.assertEqual(live_check["status"], "unavailable")

            # Unknown feature rejected
            bad_record = dict(sample_record)
            bad_record["unknown_col"] = 1.0
            with self.assertRaises(TabularInferenceError):
                predict_tabular_bundle(
                    bad_record,
                    artifact_directory=bundle,
                    model_version="zenodo-test-v1",
                    model_name="random_forest",
                )

            # All-missing features rejected
            empty_record = {col: None for col in ZENODO_13378346_FEATURES}
            with self.assertRaises(TabularInferenceError):
                predict_tabular_bundle(
                    empty_record,
                    artifact_directory=bundle,
                    model_version="zenodo-test-v1",
                    model_name="random_forest",
                )


if __name__ == "__main__":
    unittest.main()
