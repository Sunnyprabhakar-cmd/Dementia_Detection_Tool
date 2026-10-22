import json
import hashlib
import unittest
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "saturn-baseline-v0.1.0"
DATA = next((ROOT / "downloaded").glob("*SATURN*.csv"))
AUDIT = ROOT / "saturn_audit_report.json"
SCRIPT = ROOT / "train_saturn_baseline.py"
SCHEMA = ROOT / "feature_schema.json"
MANIFEST = ARTIFACTS / "split_manifest.json"
HASH_SEED = "saturn-baseline-participant-hash-v1"
EXPECTED_FEATURES = [
    "SATURN_SCORE_SIMPLE_ATTENTION_J",
    "SATURN_SCORE_SIMPLE_ATTENTION_FRUIT",
    "SATURN_SCORE_SIMPLE_ATTENTION_1239",
    "SATURN_SCORE_SPATIAL_1",
    "SATURN_SCORE_SPATIAL_2",
    "SATURN_SCORE_SPATIAL_3",
    "SATURN_SCORE_SPATIAL_4",
    "SATURN_SCORE_ORIENTATION_MONTH",
    "SATURN_SCORE_ORIENTATION_YEAR",
    "SATURN_SCORE_ORIENTATION_DAY_OF_WEEK",
    "SATURN_SCORE_ORIENTATION_STATE",
    "SATURN_SCORE_INCIDENTAL_MEMORY_PHRASE",
    "SATURN_SCORE_INCIDENTAL_MEMORY_J",
    "SATURN_SCORE_INCIDENTAL_MEMORY_NUMBER",
    "SATURN_SCORE_RECALL_FIVEWORDS",
    "SATURN_SCORE_MATH_ADD",
    "SATURN_SCORE_MATH_SUBTRACT",
    "SATURN_SCORE_STROOP_POINTS",
    "SATURN_SCORE_MINI_TRAILS_A",
    "SATURN_SCORE_MINI_TRAILS_B",
    "SATURN_TIME_STROOP_ERRORS",
    "SATURN_TIME_SIMPLE_ATTENTION_J_ms",
    "SATURN_TIME_SIMPLE_ATTENTION_FRUIT_ms",
    "SATURN_TIME_SIMPLE_ATTENTION_1239_ms",
    "SATURN_TIME_SPATIAL_1_ms",
    "SATURN_TIME_SPATIAL_2_ms",
    "SATURN_TIME_SPATIAL_3_ms",
    "SATURN_TIME_SPATIAL_4_ms",
    "SATURN_TIME_ORIENTATION_MONTH_ms",
    "SATURN_TIME_ORIENTATION_YEAR_ms",
    "SATURN_TIME_ORIENTATION_DAY_OF_WEEK_ms",
    "SATURN_TIME_ORIENTATION_STATE_ms",
    "SATURN_TIME_INCIDENTAL_MEMORY_PHRASE_ms",
    "SATURN_TIME_INCIDENTAL_MEMORY_J_ms",
    "SATURN_TIME_INCIDENTAL_MEMORY_NUMBER_ms",
    "SATURN_TIME_RECALL_FIVEWORDS_ms",
    "SATURN_TIME_MATH_ADD_ms",
    "SATURN_TIME_MATH_SUBTRACT_ms",
    "SATURN_TIME_STROOP_MEAN_ms",
    "SATURN_TIME_MINI_TRAILS_A_ms",
    "SATURN_TIME_MINI_TRAILS_B_ms",
    "SATURN_READING_SPEED_median_words_per_s",
    "SATURN_MOTOR_SPEED_ms_per_button",
    "SATURN_TOTAL_TIME_min",
]


def file_sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def participant_hash(value):
    return hashlib.sha256(f"{HASH_SEED}:{value}".encode("utf-8")).hexdigest()


class SaturnBaselineTests(unittest.TestCase):
    def test_artifacts_have_expected_contract_and_predictions(self):
        metadata = json.loads((ARTIFACTS / "metadata.json").read_text(encoding="utf-8"))
        frame = pd.read_csv(DATA, encoding="cp1252", na_values=["NA", "na", ""])
        frame = frame[
            frame["INDEX_EVENT"].astype("string").str.upper().eq("SATURN")
            & frame["SATURN_TOTAL_SCORE"].notna()
            & frame[metadata["target"]].notna()
        ]
        features = metadata["features"]
        self.assertEqual(len(frame), 144)
        self.assertEqual(features, EXPECTED_FEATURES)
        self.assertEqual(metadata["feature_count"], 44)
        self.assertNotIn(metadata["target"], features)
        self.assertNotIn("SATURN_TOTAL_SCORE", features)
        self.assertNotIn("SATURN_POSSIBLE_SCORE", features)
        self.assertNotIn("PATIENT", features)
        self.assertNotIn("INDEX_EVENT", features)
        self.assertNotIn("AUTO_ALZHEIMERS_INITIAL_VISIT_1yes_0no", features)

        values = frame[features].apply(pd.to_numeric, errors="coerce")
        for model_name in ("logistic_regression", "random_forest"):
            model = joblib.load(ARTIFACTS / f"{model_name}.joblib")
            predictions = model.predict(values.iloc[:3])
            scores = model.predict_proba(values.iloc[:3])
            self.assertEqual(len(predictions), 3)
            self.assertEqual(scores.shape, (3, 2))
            self.assertIn(model_name, metadata["metrics"])

    def test_split_manifest_is_disjoint_and_covers_cohort(self):
        metadata = json.loads((ARTIFACTS / "metadata.json").read_text(encoding="utf-8"))
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        frame = pd.read_csv(DATA, encoding="cp1252", na_values=["NA", "na", ""])
        frame = frame[
            frame["INDEX_EVENT"].astype("string").str.upper().eq("SATURN")
            & frame["SATURN_TOTAL_SCORE"].notna()
            & frame[metadata["target"]].notna()
        ].copy()
        partitions = manifest["partitions"]
        sets = [set(partitions[name]["participant_hashes"]) for name in ("train", "validation", "test")]
        self.assertTrue(sets[0].isdisjoint(sets[1]))
        self.assertTrue(sets[0].isdisjoint(sets[2]))
        self.assertTrue(sets[1].isdisjoint(sets[2]))
        cohort = {participant_hash(value) for value in frame["PATIENT"]}
        self.assertEqual(set.union(*sets), cohort)
        self.assertEqual([len(values) for values in sets], [86, 29, 29])
        self.assertEqual(manifest["features"], metadata["features"])
        self.assertEqual(manifest["feature_count"], 44)

    def test_provenance_hashes_and_training_only_preprocessing(self):
        metadata = json.loads((ARTIFACTS / "metadata.json").read_text(encoding="utf-8"))
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        frame = pd.read_csv(DATA, encoding="cp1252", na_values=["NA", "na", ""])
        frame = frame[
            frame["INDEX_EVENT"].astype("string").str.upper().eq("SATURN")
            & frame["SATURN_TOTAL_SCORE"].notna()
            & frame[metadata["target"]].notna()
        ].copy()
        values = frame[metadata["features"]].apply(pd.to_numeric, errors="coerce")
        training_medians = values.iloc[
            manifest["partitions"]["train"]["row_indices"]
        ].median().to_numpy()
        self.assertEqual(metadata["provenance"]["training_script_sha256"], file_sha256(SCRIPT))
        self.assertEqual(metadata["provenance"]["feature_schema_sha256"], file_sha256(SCHEMA))
        self.assertEqual(metadata["provenance"]["split_manifest_sha256"], file_sha256(MANIFEST))
        for model_name in ("logistic_regression", "random_forest"):
            model_path = ARTIFACTS / f"{model_name}.joblib"
            self.assertEqual(
                metadata["provenance"]["model_artifact_sha256"][model_name],
                file_sha256(model_path),
            )
            model = joblib.load(model_path)
            self.assertEqual(model.named_steps["imputer"].n_features_in_, 44)
            self.assertEqual(len(model.named_steps["imputer"].statistics_), 44)
            self.assertTrue(
                np.allclose(
                    model.named_steps["imputer"].statistics_,
                    training_medians,
                    equal_nan=True,
                )
            )
            self.assertEqual(model.named_steps["classifier"].n_features_in_, 88)

    def test_audit_json_matches_dataset_and_feature_schema(self):
        metadata = json.loads((ARTIFACTS / "metadata.json").read_text(encoding="utf-8"))
        audit = json.loads(AUDIT.read_text(encoding="utf-8"))
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        self.assertEqual(audit["dataset"]["sha256"], metadata["dataset"]["sha256"])
        self.assertEqual(audit["dataset"]["dryad_version"], metadata["dataset"]["dryad_version"])
        self.assertEqual(metadata["dataset"]["dryad_version"], schema["dryad_version"])
        self.assertEqual(audit["saturn_subset"]["candidate_component_features"], metadata["features"])
        self.assertEqual(len(audit["saturn_subset"]["candidate_component_features"]), 44)
        source = pd.read_csv(DATA, encoding="cp1252", na_values=["NA", "na", ""])
        saturn = source[source["INDEX_EVENT"].astype("string").str.upper().eq("SATURN")]
        for feature in (
            "SATURN_READING_SPEED_median_words_per_s",
            "SATURN_MOTOR_SPEED_ms_per_button",
            "SATURN_TOTAL_TIME_min",
        ):
            self.assertEqual(
                int(saturn[feature].isna().sum()),
                audit["saturn_subset"]["feature_missingness"][feature],
            )


if __name__ == "__main__":
    unittest.main()
