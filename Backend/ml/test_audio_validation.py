import importlib.util
import math
import struct
import tempfile
import unittest
import wave
from pathlib import Path

from Backend.ml.audio_validation import AudioValidationError, inspect_audio_file


DECODER_AVAILABLE = importlib.util.find_spec("av") is not None


@unittest.skipUnless(DECODER_AVAILABLE, "PyAV is available in the configured audio environment.")
class AudioValidationTests(unittest.TestCase):
    def _write_wav(self, directory, *, duration, tone):
        path = Path(directory) / "fixture.wav"
        sample_rate = 16000
        with wave.open(str(path), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(sample_rate)
            count = int(sample_rate * duration)
            if tone:
                frames = b"".join(
                    struct.pack(
                        "<h",
                        int(8000 * math.sin(2 * math.pi * 220 * index / sample_rate)),
                    )
                    for index in range(count)
                )
            else:
                frames = bytes(count * 2)
            output.writeframes(frames)
        return path

    def test_decodes_non_silent_audio_and_measures_duration(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = self._write_wav(directory, duration=1.25, tone=True)
            result = inspect_audio_file(audio)
        self.assertAlmostEqual(result["duration_seconds"], 1.25, places=2)
        self.assertEqual(result["sample_rate_hz"], 16000)
        self.assertGreater(result["rms_amplitude"], 0.01)

    def test_rejects_digital_silence(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = self._write_wav(directory, duration=1, tone=False)
            with self.assertRaises(AudioValidationError) as context:
                inspect_audio_file(audio)
        self.assertEqual(context.exception.code, "silent_audio")
        self.assertEqual(context.exception.duration_seconds, 1.0)

    def test_rejects_too_short_and_too_long_clips(self):
        with tempfile.TemporaryDirectory() as directory:
            short = self._write_wav(directory, duration=0.1, tone=True)
            with self.assertRaises(AudioValidationError) as context:
                inspect_audio_file(short)
            self.assertEqual(context.exception.code, "audio_too_short")

        with tempfile.TemporaryDirectory() as directory:
            long = self._write_wav(directory, duration=2, tone=True)
            with self.assertRaises(AudioValidationError) as context:
                inspect_audio_file(long, maximum_duration_seconds=1)
            self.assertEqual(context.exception.code, "audio_too_long")

    def test_rejects_undecodable_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = Path(directory) / "invalid.wav"
            audio.write_bytes(b"not audio")
            with self.assertRaises(AudioValidationError) as context:
                inspect_audio_file(audio)
        self.assertEqual(context.exception.code, "invalid_audio")


if __name__ == "__main__":
    unittest.main()
