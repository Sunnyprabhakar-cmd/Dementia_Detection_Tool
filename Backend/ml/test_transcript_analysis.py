import unittest

from Backend.ml.transcript_analysis import analyze_transcript


class TranscriptAnalysisTests(unittest.TestCase):
    def test_normal_speech_counts_words_sentences_and_varied_lengths(self):
        result = analyze_transcript(
            {
                "status": "success",
                "language": "en",
                "transcript": "A bird flies. The bright bird crosses the quiet garden.",
            }
        )

        observations = result["observations"]
        self.assertEqual(result["status"], "complete")
        self.assertEqual(observations["word_count"], 10)
        self.assertEqual(observations["sentence_count"], 2)
        self.assertEqual(observations["average_words_per_sentence"], 5.0)
        self.assertEqual(observations["unique_word_ratio"], 0.8)

    def test_fillers_match_whole_words_and_are_configurable(self):
        result = analyze_transcript(
            {
                "status": "success",
                "language": "en",
                "transcript": "Um, the umbrella is there, um.",
            },
            filler_words=("um", "uh"),
        )

        self.assertEqual(result["observations"]["filler_word_counts"], {"um": 2})

    def test_adjacent_words_and_short_phrases_are_counted_literally(self):
        result = analyze_transcript(
            {
                "status": "success",
                "language": "en",
                "transcript": "I think, think the blue car. The blue car is parked.",
            }
        )

        self.assertEqual(result["observations"]["repeated_adjacent_word_count"], 1)
        self.assertEqual(result["observations"]["repeated_short_phrase_count"], 1)

    def test_punctuation_case_and_apostrophes_are_normalized(self):
        result = analyze_transcript(
            {
                "status": "success",
                "language": "en",
                "transcript": "I mean, it's a tree! It's not a shrub?",
            }
        )

        self.assertEqual(result["observations"]["sentence_count"], 2)
        self.assertEqual(
            result["observations"]["self_correction_marker_counts"]["i mean"],
            1,
        )

    def test_vague_expressions_and_self_correction_are_literal_counts(self):
        result = analyze_transcript(
            {
                "status": "success",
                "language": "en",
                "transcript": "Some kind of thing is here. Sorry, I mean that stuff.",
            }
        )

        self.assertEqual(
            result["observations"]["selected_vague_expression_counts"]["some kind of"],
            1,
        )
        self.assertEqual(
            result["observations"]["selected_vague_expression_counts"]["thing"],
            1,
        )
        self.assertEqual(
            result["observations"]["self_correction_marker_counts"]["sorry"],
            1,
        )
        self.assertEqual(
            result["observations"]["self_correction_marker_counts"]["i mean"],
            1,
        )

    def test_empty_and_very_short_transcripts_are_not_scored_as_impairment(self):
        empty = analyze_transcript(
            {"status": "success", "language": "en", "transcript": " ... "}
        )
        short = analyze_transcript(
            {"status": "success", "language": "en", "transcript": "A tree."}
        )

        self.assertEqual(empty["status"], "empty")
        self.assertIsNone(empty["observations"]["unique_word_ratio"])
        self.assertEqual(short["status"], "very_short")
        self.assertEqual(short["observations"]["word_count"], 2)
        self.assertEqual(short["observations"]["filler_word_counts"], {})

    def test_transcription_errors_and_non_english_rules_are_unavailable(self):
        failed = analyze_transcript(
            {"status": "error", "error": {"code": "transcription_unavailable"}}
        )
        non_english = analyze_transcript(
            {"status": "success", "language": "ta", "transcript": "sample phrase here"}
        )

        self.assertEqual(failed["status"], "transcription_error")
        self.assertEqual(failed["observations"], {})
        self.assertIsNone(non_english["observations"]["filler_word_counts"])
        self.assertIn("english_filler_counts", non_english["unavailable_observations"])

    def test_ordinary_repetition_and_vague_words_are_not_judged(self):
        result = analyze_transcript(
            {
                "status": "success",
                "language": "en",
                "transcript": "That thing is a thing, and things happen sometimes.",
            }
        )

        self.assertEqual(
            result["observations"]["selected_vague_expression_counts"]["thing"],
            2,
        )
        self.assertTrue(any("do not imply impairment" in item for item in result["limitations"]))


if __name__ == "__main__":
    unittest.main()
