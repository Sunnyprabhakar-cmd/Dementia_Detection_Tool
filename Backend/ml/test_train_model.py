import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from Backend.ml.model_contract import BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION
from Backend.ml.model_contract import FEATURES_BY_MODALITY
from Backend.ml.train_model import (
    build_parser,
    grouped_split,
    grouped_train_validation_test_split,
    load_dataset,
    train_models,
    validate_feature_selection,
    validate_provenance,
)


class TrainingSafetyTests(unittest.TestCase):
    def test_shared_feature_schema_is_nonempty_and_modality_specific(self):
        self.assertEqual(set(FEATURES_BY_MODALITY), {"cognitive_tasks", "speech"})
        self.assertEqual(len(FEATURES_BY_MODALITY["cognitive_tasks"]), 10)
        self.assertIn("voice_lexical_diversity", FEATURES_BY_MODALITY["speech"])
        self.assertNotIn("CDR", FEATURES_BY_MODALITY["cognitive_tasks"])
        self.assertNotIn("MMSE", FEATURES_BY_MODALITY["cognitive_tasks"])

    def test_training_arguments_require_explicit_data_and_labels(self):
        with self.assertRaises(SystemExit):
            build_parser().parse_args([])

    def test_missing_data_does_not_fall_back_to_generated_rows(self):
        with self.assertRaisesRegex(ValueError, "authorized dataset"):
            load_dataset(None)

    def test_grouped_split_keeps_participants_separate_and_labels_present(self):
        groups = pd.Series(
            [f"participant-{subject}" for subject in range(20) for _ in range(2)]
        )
        target = pd.Series(
            [str(subject % 2) for subject in range(20) for _ in range(2)]
        )
        features = pd.DataFrame({"memory_recall_count": range(len(groups))})

        train_indices, test_indices = grouped_split(features, target, groups)

        self.assertTrue(
            set(groups.iloc[train_indices]).isdisjoint(groups.iloc[test_indices])
        )
        self.assertEqual(set(target.iloc[train_indices]), {"0", "1"})
        self.assertEqual(set(target.iloc[test_indices]), {"0", "1"})

    def test_train_validation_test_split_keeps_groups_and_labels_separate(self):
        groups = pd.Series(
            [f"participant-{subject}" for subject in range(40) for _ in range(2)]
        )
        target = pd.Series(
            [str(subject % 2) for subject in range(40) for _ in range(2)]
        )
        features = pd.DataFrame({"memory_recall_count": range(len(groups))})
        partitions = grouped_train_validation_test_split(features, target, groups)
        participant_sets = [set(groups.iloc[indices]) for indices in partitions]

        self.assertTrue(participant_sets[0].isdisjoint(participant_sets[1]))
        self.assertTrue(participant_sets[0].isdisjoint(participant_sets[2]))
        self.assertTrue(participant_sets[1].isdisjoint(participant_sets[2]))
        for indices in partitions:
            self.assertEqual(set(target.iloc[indices]), {"0", "1"})

    def test_manifest_must_be_authorized_and_match_dataset_checksum(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            data_path = root / "dataset.csv"
            manifest_path = root / "provenance.json"
            data_path.write_text(
                "memory_recall_count,label,participant_id\n1,a,p1\n",
                encoding="utf-8",
            )
            digest = hashlib.sha256(data_path.read_bytes()).hexdigest()
            manifest = {
                "dataset_name": "test-only behavioral fixture",
                "release": "local test fixture",
                "source_url": "https://example.invalid",
                "authorization_reference": "test-only",
                "license_or_agreement": "test fixture only",
                "model_use_permission": "test fixture only",
                "model_training_and_inference_authorized": True,
                "authorization_confirmed": True,
                "sha256": digest,
            }
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

            self.assertEqual(
                validate_provenance(str(data_path), str(manifest_path))["sha256"],
                digest,
            )
            manifest["authorization_confirmed"] = False
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "authorize"):
                validate_provenance(str(data_path), str(manifest_path))

    def test_training_rejects_target_group_and_demographic_or_mri_features(self):
        for forbidden in ("label", "participant_id", "Age", "MMSE", "CDR", "eTIV"):
            with self.subTest(feature=forbidden):
                with self.assertRaises(ValueError):
                    validate_feature_selection(
                        ["memory_recall_count", forbidden],
                        "participant_id",
                        "label",
                        "cognitive_tasks",
                    )

    def test_speech_training_rejects_features_not_produced_by_live_audio_path(self):
        validate_feature_selection(
            [
                "voice_audio_duration_seconds",
                "voice_lexical_diversity",
                "voice_mean_sentence_length_words",
            ],
            "participant_key",
            "label",
            "speech",
        )
        for unsupported in ("voice_pitch_mean_hz", "mfcc_1_mean", "subject"):
            with self.subTest(feature=unsupported):
                with self.assertRaises(ValueError):
                    validate_feature_selection(
                        ["voice_audio_duration_seconds", unsupported],
                        "participant_key",
                        "label",
                        "speech",
                    )

    def test_training_preprocessing_is_inside_each_model_pipeline(self):
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
        frame = pd.DataFrame(rows)

        models, metadata = train_models(
            frame,
            target_column="label",
            group_column="participant_id",
            feature_columns=["memory_recall_count", "memory_presented_count"],
            labels=["group_a", "group_b"],
            modality="cognitive_tasks",
        )

        self.assertEqual(set(models), {"logistic_regression", "random_forest"})
        for model in models.values():
            self.assertIn("preprocessor", model.named_steps)
            self.assertIn("classifier", model.named_steps)
        self.assertEqual(metadata["format"], BUNDLE_FORMAT)
        self.assertEqual(metadata["schema_version"], BUNDLE_SCHEMA_VERSION)
        evaluation = metadata["evaluation"]
        self.assertEqual(
            sum(evaluation["participant_counts"][key] for key in ("train", "validation", "test")),
            24,
        )
        self.assertEqual(
            evaluation["status"],
            "participant_grouped_train_validation_test",
        )
        self.assertEqual(set(evaluation["models"]), {"logistic_regression", "random_forest"})
        self.assertIn("balanced_accuracy", evaluation["models"]["logistic_regression"])
        self.assertIn("roc_auc", evaluation["models"]["logistic_regression"])


if __name__ == "__main__":
    unittest.main()
