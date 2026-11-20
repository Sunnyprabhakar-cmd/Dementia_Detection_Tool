import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np
import pandas as pd

from Backend.ml.preprocessing.speech_features import (
    extract_speech_intelligence,
    get_language_capabilities,
)
from Backend.ml.training.voice_dataset_importer import import_voice_dataset_directory


def _write_wav(path: Path, samples: np.ndarray, sr: int = 16000) -> None:
    pcm = np.clip(samples * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


class Stage101ImporterTests(unittest.TestCase):
    def test_voice_dataset_importer_validates_audio_hashes_and_rejects_bad_rows(self):
        sr = 16000
        t = np.linspace(0, 0.7, int(sr * 0.7), endpoint=False)
        sig = 0.35 * np.sin(2 * np.pi * 150.0 * t)

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            audio_dir = root / "audio"
            audio_dir.mkdir()
            _write_wav(audio_dir / "p1.wav", sig, sr)
            _write_wav(audio_dir / "p2.wav", sig, sr)
            (audio_dir / "corrupt.wav").write_bytes(b"corrupt")

            meta_csv = root / "metadata.csv"
            pd.DataFrame([
                {"participant_id": "SUBJ-001", "audio_relpath": "audio/p1.wav", "label": "control", "language": "en"},
                {"participant_id": "SUBJ-002", "audio_relpath": "audio/p2.wav", "label": "ad", "language": "en"},
                {"participant_id": "SUBJ-003", "audio_relpath": "audio/corrupt.wav", "label": "ad", "language": "en"},
                {"participant_id": "SUBJ-004", "audio_relpath": "../escape.wav", "label": "control", "language": "en"},
                {"participant_id": "SUBJ-005", "audio_relpath": "audio/p1.wav", "label": "invalid_lbl", "language": "en"},
            ]).to_csv(meta_csv, index=False)

            out_dir = root / "imported"
            manifest = import_voice_dataset_directory(
                root,
                metadata_csv=meta_csv,
                dataset_version="test-import-v1",
                output_dir=out_dir,
            )
            self.assertEqual(manifest["valid_imported_recordings"], 2)
            self.assertEqual(manifest["rejected_recordings"], 3)
            self.assertEqual(manifest["unique_participants"], 2)
            self.assertTrue((out_dir / "dataset_manifest.json").is_file())
            self.assertEqual(len(manifest["features_sha256"]), 64)

            # Verify raw participant_id is not exposed in imported CSV
            imported_df = pd.read_csv(out_dir / manifest["features_file"])
            self.assertNotIn("participant_id", imported_df.columns)
            self.assertIn("participant_hash", imported_df.columns)

    def test_low_quality_audio_flagged_unreliable_and_language_inference_blocked(self):
        sr = 16000
        t = np.linspace(0, 0.6, int(sr * 0.6), endpoint=False)
        clipped = np.clip(2.0 * np.sin(2 * np.pi * 150.0 * t), -1.0, 1.0)
        with tempfile.TemporaryDirectory() as tmp:
            wav_path = Path(tmp) / "clipped.wav"
            _write_wav(wav_path, clipped, sr)
            res = extract_speech_intelligence(wav_path=wav_path, transcript="test speech", language="en")
            self.assertFalse(res["quality_reliable"])
            self.assertIn("clipping_detected", res["quality_warnings"])

        for lang in ("en", "hi", "pa", "si", "ta"):
            self.assertFalse(get_language_capabilities(lang)["dementia_inference_supported"])


if __name__ == "__main__":
    unittest.main()
