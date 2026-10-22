import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

import pandas as pd

from Backend.ml.audio_classifier import classify_speech_features
from Backend.ml.train_model import save_model_bundle, train_models


class AudioClassifierTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.artifact_directory = Path(self.temporary_directory.name)
        (self.artifact_directory / "metadata.json").write_text("{}", encoding="utf-8")
        self.features = {
            "status": "complete",
            "features": {
                "audio_duration_seconds": 10.0,
                "speaking_duration_seconds": 8.0,
                "transcript_word_count": 20,
                "transcript_character_count": 80,
                "speech_rate_words_per_minute": 150.0,
                "pause_count": 2,
                "mean_pause_seconds": 0.5,
                "maximum_pause_seconds": 0.8,
                "estimated_non_speech_ratio": 0.2,
                "filler_word_count": 1,
                "adjacent_repeated_word_count": 0,
                "lexical_diversity": 0.8,
                "sentence_count": 3,
                "mean_sentence_length_words": 6.67,
                "pitch_mean_hz": None,
                "pitch_std_hz": None,
            },
        }

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_missing_artifact_returns_unavailable_without_running_inference(self):
        runner = Mock()
        result = classify_speech_features(
            self.features,
            artifact_directory=self.artifact_directory / "missing",
            model_version="audio-1.0.0",
            runner=runner,
        )

        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["prediction"])
        self.assertIn("compatible_trained_audio_model", result["missing_inputs"])
        runner.assert_not_called()

    def test_feature_schema_mismatch_returns_unavailable(self):
        mismatched = {
            **self.features,
            "features": {**self.features["features"], "unexpected_feature": 1.0},
        }
        result = classify_speech_features(
            mismatched,
            artifact_directory=self.artifact_directory,
            model_version="audio-1.0.0",
            runner=Mock(),
        )

        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["prediction"])
        self.assertIn("compatible_speech_feature_schema", result["missing_inputs"])

    def test_available_prediction_requires_research_contract_and_valid_scores(self):
        expected_prediction = {
            "predicted_label": "class_a",
            "class_scores": {"class_a": 0.7, "class_b": 0.3},
            "scores_are_calibrated_probabilities": False,
        }
        predictor_result = {
            "status": "available_research_only",
            "model_version": "audio-1.0.0",
            "model_name": "logistic_regression",
            "modality": "speech",
            "evaluation_status": "participant_grouped_train_validation_test",
            "labels": ["class_a", "class_b"],
            "output": expected_prediction,
        }
        runner = Mock(
            return_value=subprocess.CompletedProcess(
                args=[],
                returncode=0,
                stdout=json.dumps(predictor_result),
                stderr="",
            )
        )

        result = classify_speech_features(
            self.features,
            artifact_directory=self.artifact_directory,
            model_version="audio-1.0.0",
            runner=runner,
        )

        self.assertEqual(result["status"], "available_research_only")
        self.assertEqual(result["prediction"], expected_prediction)
        sent_record = json.loads(runner.call_args.kwargs["input"])
        self.assertEqual(sent_record["features"]["voice_audio_duration_seconds"], 10.0)
        self.assertEqual(sent_record["features"]["voice_filler_word_count"], 1)
        self.assertEqual(
            set(sent_record["features"]),
            {
                "voice_audio_duration_seconds",
                "voice_speaking_duration_seconds",
                "voice_transcript_word_count",
                "voice_transcript_character_count",
                "voice_speech_rate_words_per_minute",
                "voice_pause_count",
                "voice_mean_pause_seconds",
                "voice_maximum_pause_seconds",
                "voice_estimated_non_speech_ratio",
                "voice_filler_word_count",
                "voice_adjacent_repeated_word_count",
                "voice_lexical_diversity",
                "voice_mean_sentence_length_words",
            },
        )

    def test_trained_test_fixture_runs_through_the_audio_inference_contract(self):
        rows = []
        for participant in range(40):
            label = "control_fixture" if participant % 2 == 0 else "case_fixture"
            for session in range(2):
                rows.append(
                    {
                        "participant_key": f"fixture-{participant}",
                        "label": label,
                        "voice_audio_duration_seconds": 8.0 + (participant % 2) * 4,
                        "voice_transcript_word_count": 15 + (participant % 2) * 15,
                    }
                )
        models, metadata = train_models(
            pd.DataFrame(rows),
            target_column="label",
            group_column="participant_key",
            feature_columns=[
                "voice_audio_duration_seconds",
                "voice_transcript_word_count",
            ],
            labels=["control_fixture", "case_fixture"],
            modality="speech",
        )
        data_path = self.artifact_directory / "test-only-features.csv"
        data_path.write_text("test fixture only\n", encoding="utf-8")
        bundle = self.artifact_directory / "trained-test-bundle"
        save_model_bundle(
            bundle,
            models,
            metadata,
            model_version="audio-test-1.0.0",
            provenance={
                "dataset_name": "generated unit-test fixture",
                "release": "unit-test-only",
                "source_url": "https://example.invalid",
                "authorization_reference": "not participant data",
                "license_or_agreement": "test fixture only",
                "model_use_permission": "test fixture only",
                "model_training_and_inference_authorized": True,
                "authorization_confirmed": True,
            },
            data_path=data_path,
        )
        result = classify_speech_features(
            {
                "status": "complete",
                "features": {
                    "audio_duration_seconds": 12.0,
                    "speaking_duration_seconds": 10.0,
                    "transcript_word_count": 30,
                    "transcript_character_count": 100,
                    "speech_rate_words_per_minute": 180.0,
                    "pause_count": 1,
                    "mean_pause_seconds": 1.0,
                    "maximum_pause_seconds": 1.0,
                    "estimated_non_speech_ratio": 0.16,
                    "filler_word_count": 0,
                    "adjacent_repeated_word_count": 0,
                    "lexical_diversity": 0.8,
                    "mean_sentence_length_words": 10.0,
                },
            },
            artifact_directory=bundle,
            model_version="audio-test-1.0.0",
            python_executable=sys.executable,
        )

        self.assertEqual(result["status"], "available_research_only")
        self.assertIn(
            result["prediction"]["predicted_label"],
            {"control_fixture", "case_fixture"},
        )
        self.assertFalse(
            result["prediction"]["scores_are_calibrated_probabilities"]
        )

    def test_invalid_prediction_output_is_not_returned_as_available(self):
        invalid_result = {
            "status": "available_research_only",
            "model_version": "audio-1.0.0",
            "model_name": "logistic_regression",
            "modality": "speech",
            "evaluation_status": "participant_grouped_train_validation_test",
            "labels": ["class_a", "class_b"],
            "output": {
                "predicted_label": "class_c",
                "class_scores": {"class_a": 0.7, "class_b": 0.3},
                "scores_are_calibrated_probabilities": False,
            },
        }
        runner = Mock(
            return_value=subprocess.CompletedProcess(
                args=[], returncode=0, stdout=json.dumps(invalid_result), stderr=""
            )
        )

        result = classify_speech_features(
            self.features,
            artifact_directory=self.artifact_directory,
            model_version="audio-1.0.0",
            runner=runner,
        )

        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["prediction"])

    def test_empty_or_unavailable_audio_features_do_not_invoke_model(self):
        runner = Mock()
        result = classify_speech_features(
            {"status": "empty", "features": {}},
            artifact_directory=self.artifact_directory,
            model_version="audio-1.0.0",
            runner=runner,
        )

        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["prediction"])
        runner.assert_not_called()


if __name__ == "__main__":
    unittest.main()
