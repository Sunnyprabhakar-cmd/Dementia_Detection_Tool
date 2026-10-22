import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from Backend.ml.audio_validation import AudioValidationError
from Backend.ml.transcribe_audio import transcribe_audio


class TranscribeAudioTests(unittest.TestCase):
    def test_success_returns_transcript_features_and_no_classifier(self):
        class Segment:
            start = 0.0
            end = 3.0
            text = "A small test."

        class Info:
            language = "en"
            language_probability = 0.99
            duration = 3.5

        class FakeWhisperModel:
            def __init__(self, model_name, device, compute_type):
                self.configuration = (model_name, device, compute_type)

            def transcribe(self, path, **kwargs):
                return iter([Segment()]), Info()

        fake_module = types.ModuleType("faster_whisper")
        fake_module.WhisperModel = FakeWhisperModel

        with tempfile.TemporaryDirectory() as directory:
            audio_path = Path(directory) / "fixture.webm"
            audio_path.write_bytes(b"private test fixture")
            with (
                patch.dict(sys.modules, {"faster_whisper": fake_module}),
                patch(
                    "Backend.ml.transcribe_audio.inspect_audio_file",
                    return_value={
                        "duration_seconds": 3.5,
                        "sample_rate_hz": 16000,
                        "decoded_samples": 56000,
                    },
                ),
            ):
                result = transcribe_audio(audio_path)

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["processing_status"], "completed")
        self.assertEqual(result["transcript"], "A small test.")
        self.assertEqual(result["speech_features"]["features"]["transcript_word_count"], 3)
        self.assertEqual(result["transcript_analysis"]["status"], "very_short")
        self.assertEqual(result["transcript_analysis"]["observations"]["word_count"], 3)
        self.assertIn("semantic comparison", result["transcript_analysis"]["context"]["observation"])
        self.assertFalse(result["provenance"]["source_audio_persisted"])
        self.assertEqual(result["classifier"]["status"], "unavailable")

    def test_missing_audio_returns_structured_error(self):
        result = transcribe_audio(Path("missing-audio-fixture.webm"))

        self.assertEqual(result["status"], "error")
        self.assertEqual(result["error"]["code"], "audio_not_found")
        self.assertNotIn("missing-audio-fixture", result["error"]["message"])

    def test_transcriber_failure_does_not_leak_exception_details(self):
        class FakeWhisperModel:
            def __init__(self, *args, **kwargs):
                raise RuntimeError("private model path and transcript")

        fake_module = types.ModuleType("faster_whisper")
        fake_module.WhisperModel = FakeWhisperModel

        with tempfile.TemporaryDirectory() as directory:
            audio_path = Path(directory) / "fixture.wav"
            audio_path.write_bytes(b"fixture")
            with (
                patch.dict(sys.modules, {"faster_whisper": fake_module}),
                patch(
                    "Backend.ml.transcribe_audio.inspect_audio_file",
                    return_value={
                        "duration_seconds": 3,
                        "sample_rate_hz": 16000,
                        "decoded_samples": 48000,
                    },
                ),
            ):
                result = transcribe_audio(audio_path)

        self.assertEqual(result["status"], "error")
        self.assertEqual(result["error"]["code"], "transcription_unavailable")
        self.assertNotIn("private model path", str(result))
        self.assertNotIn("private transcript", str(result))

    def test_invalid_audio_returns_sanitized_processing_error(self):
        class FakeWhisperModel:
            def __init__(self, *args, **kwargs):
                pass

            def transcribe(self, path, **kwargs):
                raise RuntimeError("decoder failed for private recording")

        fake_module = types.ModuleType("faster_whisper")
        fake_module.WhisperModel = FakeWhisperModel

        with tempfile.TemporaryDirectory() as directory:
            audio_path = Path(directory) / "invalid.wav"
            audio_path.write_bytes(b"not a valid audio stream")
            with (
                patch.dict(sys.modules, {"faster_whisper": fake_module}),
                patch(
                    "Backend.ml.transcribe_audio.inspect_audio_file",
                    side_effect=AudioValidationError(
                        "invalid_audio",
                        "The uploaded audio could not be decoded.",
                    ),
                ),
            ):
                result = transcribe_audio(audio_path)

        self.assertEqual(result["status"], "error")
        self.assertEqual(result["processing_status"], "rejected")
        self.assertEqual(result["error"]["code"], "invalid_audio")
        self.assertNotIn("decoder failed", str(result))

    def test_classifier_failure_does_not_discard_successful_transcription(self):
        class Segment:
            start = 0.0
            end = 3.0
            text = "A short test sentence."

        class Info:
            language = "en"
            language_probability = 0.9
            duration = 3.0

        class FakeWhisperModel:
            def __init__(self, *args, **kwargs):
                pass

            def transcribe(self, path, **kwargs):
                return iter([Segment()]), Info()

        fake_module = types.ModuleType("faster_whisper")
        fake_module.WhisperModel = FakeWhisperModel

        with tempfile.TemporaryDirectory() as directory:
            audio_path = Path(directory) / "fixture.wav"
            audio_path.write_bytes(b"synthetic audio fixture")
            with (
                patch.dict(sys.modules, {"faster_whisper": fake_module}),
                patch(
                    "Backend.ml.transcribe_audio.classify_configured_audio",
                    side_effect=RuntimeError("private model error"),
                ),
                patch(
                    "Backend.ml.transcribe_audio.inspect_audio_file",
                    return_value={
                        "duration_seconds": 3,
                        "sample_rate_hz": 16000,
                        "decoded_samples": 48000,
                    },
                ),
            ):
                result = transcribe_audio(audio_path)

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["transcript"], "A short test sentence.")
        self.assertEqual(result["classifier"]["status"], "unavailable")


if __name__ == "__main__":
    unittest.main()
