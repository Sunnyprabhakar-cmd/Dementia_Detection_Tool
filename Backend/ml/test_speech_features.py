import unittest

from Backend.ml.speech_features import extract_speech_features


class SpeechFeatureTests(unittest.TestCase):
    def test_valid_transcript_yields_duration_pause_and_rate_measures(self):
        result = extract_speech_features(
            {
                "status": "success",
                "model": "test-transcriber",
                "language": "en",
                "duration_seconds": 10.0,
                "transcript": "A person speaks. Then speaks again.",
                "segments": [
                    {"start": 0.5, "end": 2.5, "text": "A person speaks."},
                    {"start": 4.0, "end": 6.0, "text": "Then speaks again."},
                ],
            }
        )

        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["features"]["transcript_word_count"], 6)
        self.assertEqual(result["features"]["pause_count"], 1)
        self.assertEqual(result["features"]["mean_pause_seconds"], 1.5)
        self.assertEqual(result["features"]["speech_rate_words_per_minute"], 90.0)
        self.assertEqual(result["transcription_model"], "test-transcriber")

    def test_silence_does_not_invent_speech_metrics(self):
        result = extract_speech_features(
            {
                "status": "success",
                "duration_seconds": 8.0,
                "transcript": "",
                "segments": [],
            }
        )

        self.assertEqual(result["status"], "empty")
        self.assertIsNone(result["features"]["speaking_duration_seconds"])
        self.assertIsNone(result["features"]["speech_rate_words_per_minute"])
        self.assertIsNone(result["features"]["pause_count"])
        self.assertIn("non_empty_transcript", result["missing_inputs"])

    def test_short_recording_omits_unreliable_rate(self):
        result = extract_speech_features(
            {
                "status": "success",
                "duration_seconds": 1.0,
                "transcript": "Hello",
                "segments": [{"start": 0.0, "end": 1.0, "text": "Hello"}],
            }
        )

        self.assertEqual(result["status"], "partial")
        self.assertIsNone(result["features"]["speech_rate_words_per_minute"])
        self.assertIn(
            "at_least_2_seconds_of_speech_for_rate", result["missing_inputs"]
        )

    def test_invalid_timestamps_are_reported_as_missing(self):
        result = extract_speech_features(
            {
                "status": "success",
                "duration_seconds": 2.0,
                "transcript": "A phrase",
                "segments": [{"start": 0.5, "end": 3.0, "text": "A phrase"}],
            }
        )

        self.assertEqual(result["status"], "partial")
        self.assertIsNone(result["features"]["speaking_duration_seconds"])
        self.assertIn("some_segment_timestamps_invalid", result["missing_inputs"])

    def test_failed_transcription_is_unavailable(self):
        result = extract_speech_features({"status": "error"})

        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["features"], {})

    def test_extracts_english_fillers_repetitions_and_timing_ratio(self):
        result = extract_speech_features(
            {
                "status": "success",
                "language": "en",
                "duration_seconds": 10.0,
                "transcript": "Um, I think think the house is quiet.",
                "segments": [
                    {"start": 1.0, "end": 3.0, "text": "Um, I think think"},
                    {"start": 4.0, "end": 7.0, "text": "the house is quiet."},
                ],
            }
        )

        features = result["features"]
        self.assertEqual(features["filler_word_count"], 1)
        self.assertEqual(features["filler_word_ratio_percent"], 12.5)
        self.assertEqual(features["adjacent_repeated_word_count"], 1)
        self.assertEqual(features["estimated_non_speech_ratio"], 0.5)
        self.assertEqual(features["lexical_diversity"], 0.875)
        self.assertEqual(features["sentence_count"], 1)
        self.assertEqual(features["mean_sentence_length_words"], 8.0)
        self.assertIsNone(features["pitch_mean_hz"])
        self.assertIn("pitch_mean_hz", result["unavailable_features"])

    def test_non_english_filler_count_is_missing_not_assumed_zero(self):
        result = extract_speech_features(
            {
                "status": "success",
                "language": "ta",
                "duration_seconds": 4.0,
                "transcript": "வணக்கம்",
                "segments": [{"start": 0.0, "end": 3.0, "text": "வணக்கம்"}],
            }
        )

        self.assertIsNone(result["features"]["filler_word_count"])
        self.assertIsNone(result["features"]["filler_word_ratio_percent"])
        self.assertIn(
            "english_language_required_for_filler_count",
            result["missing_inputs"],
        )


if __name__ == "__main__":
    unittest.main()
