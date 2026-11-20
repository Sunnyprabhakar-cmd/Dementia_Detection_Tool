import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np

from Backend.ml.preprocessing.audio_preprocessing import validate_wav_audio
from Backend.ml.preprocessing.speech_features import (
    analyze_multilingual_transcript,
    extract_speech_intelligence,
)


def _write_wav(
    path: Path,
    samples: np.ndarray,
    sample_rate: int = 16000,
    channels: int = 1,
) -> None:
    if channels == 2 and samples.ndim == 1:
        data = np.column_stack([samples, samples]).reshape(-1)
    else:
        data = samples
    pcm = np.clip(data * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())


class SpeechPipelineTests(unittest.TestCase):
    def test_sample_rates_and_mono_stereo_audio(self):
        for sr in (8000, 16000, 44100):
            t = np.linspace(0, 0.8, int(sr * 0.8), endpoint=False)
            sig = 0.35 * np.sin(2 * np.pi * 160.0 * t)
            for ch in (1, 2):
                with tempfile.TemporaryDirectory() as tmp:
                    wav_path = Path(tmp) / f"test_{sr}_{ch}.wav"
                    _write_wav(wav_path, sig, sample_rate=sr, channels=ch)
                    res = extract_speech_intelligence(
                        wav_path=wav_path,
                        transcript="Hello world this is a clear speech sample.",
                        language="en",
                    )
                    ac = res["acoustic_features"]
                    self.assertIn("mfcc_1_mean", ac)
                    self.assertIn("spectral_centroid_hz", ac)
                    self.assertIsNotNone(ac["pitch_mean_hz"])
                    self.assertGreater(ac["pitch_mean_hz"], 120.0)
                    self.assertLess(ac["pitch_mean_hz"], 210.0)
                    self.assertIsNotNone(res["timing_summary"]["speaking_rate_wpm"])

    def test_empty_silent_corrupted_and_clipped_audio(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Silent audio
            silent = Path(tmp) / "silent.wav"
            _write_wav(silent, np.zeros(16000))
            with self.assertRaises(ValueError):
                validate_wav_audio(silent)

            # Corrupted file
            corrupt = Path(tmp) / "corrupt.wav"
            corrupt.write_bytes(b"not-a-valid-wav-file")
            with self.assertRaises(Exception):
                validate_wav_audio(corrupt)

            # Clipped audio
            t = np.linspace(0, 0.6, 9600, endpoint=False)
            clipped_sig = np.clip(1.8 * np.sin(2 * np.pi * 150.0 * t), -1.0, 1.0)
            clipped = Path(tmp) / "clipped.wav"
            _write_wav(clipped, clipped_sig)
            decoded = validate_wav_audio(clipped)
            self.assertIn("clipping_detected", decoded["quality_warnings"])

    def test_pauses_and_response_latency(self):
        sr = 16000
        lead_silence = np.zeros(int(sr * 0.3))
        t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
        tone = 0.4 * np.sin(2 * np.pi * 140.0 * t)
        mid_pause = np.zeros(int(sr * 0.6))
        sig = np.concatenate([lead_silence, tone, mid_pause, tone])
        with tempfile.TemporaryDirectory() as tmp:
            wav_path = Path(tmp) / "pauses.wav"
            _write_wav(wav_path, sig, sample_rate=sr)
            res = extract_speech_intelligence(
                wav_path=wav_path,
                transcript="One two three four five six.",
                language="en",
                stimulus_offset_seconds=0.1,
            )
            ts = res["timing_summary"]
            self.assertGreaterEqual(ts["pause_count"], 1)
            self.assertGreaterEqual(ts["long_pause_count"], 1)
            self.assertGreater(ts["response_latency_seconds"], 0.1)

    def test_multilingual_hindi_punjabi_empty_and_unsupported(self):
        # Empty transcript
        empty = analyze_multilingual_transcript("", "en")
        self.assertEqual(empty["status"], "empty")
        self.assertIsNone(empty["features"]["total_spoken_words"])

        # Hindi transcript with Hindi filler (must not use English fillers)
        hi = analyze_multilingual_transcript("मैं आज सुबह उम्म घर से निकला।", "hi")
        self.assertEqual(hi["language_supported"], True)
        self.assertEqual(hi["filler_analysis_status"], "available")
        self.assertEqual(hi["features"]["filled_pause_count"], 1)

        # Punjabi transcript
        pa = analyze_multilingual_transcript("ਅੱਜ ਸਵੇਰੇ ਉਮ ਮੌਸਮ ਵਧੀਆ ਹੈ।", "pa")
        self.assertEqual(pa["language_supported"], True)
        self.assertEqual(pa["filler_analysis_status"], "available")
        self.assertEqual(pa["features"]["filled_pause_count"], 1)

        # Unsupported language (French) must report unavailable, not 0 English fillers
        fr = analyze_multilingual_transcript("Bonjour le monde um", "fr")
        self.assertEqual(fr["language_supported"], False)
        self.assertEqual(fr["filler_analysis_status"], "unavailable_for_language:fr")
        self.assertIsNone(fr["features"]["filled_pause_count"])


if __name__ == "__main__":
    unittest.main()
