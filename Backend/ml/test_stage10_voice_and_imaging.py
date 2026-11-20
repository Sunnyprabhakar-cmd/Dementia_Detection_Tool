import gzip
import struct
import tempfile
import unittest
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from Backend.ml.imaging.imaging_pipeline import (
    ImagingValidationError,
    analyze_imaging_file,
    validate_dicom_bytes,
    validate_dicom_zip,
)
from Backend.ml.preprocessing.audio_preprocessing import extract_acoustic_features
from Backend.ml.preprocessing.speech_features import get_language_capabilities
from Backend.ml.training.voice_pipeline import run_voice_model_comparison


def _make_nifti1_header(nx: int, ny: int, nz: int) -> bytes:
    buf = bytearray(348)
    struct.pack_into("<i", buf, 0, 348)
    struct.pack_into("<8h", buf, 40, 3, nx, ny, nz, 1, 0, 0, 0)
    struct.pack_into("<h", buf, 70, 16)
    struct.pack_into("<8f", buf, 76, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0)
    buf[344:348] = b"n+1\x00"
    return bytes(buf)


class Stage10VoiceAndImagingTests(unittest.TestCase):
    def test_extended_acoustic_and_language_registry(self):
        sr = 16000
        t = np.linspace(0, 0.8, int(sr * 0.8), endpoint=False)
        sig = 0.4 * np.sin(2 * np.pi * 155.0 * t)
        feats = extract_acoustic_features(sig, sr)
        self.assertIn("jitter_local", feats)
        self.assertIn("shimmer_local", feats)
        self.assertIn("hnr_mean_db", feats)
        self.assertIn("pitch_median_hz", feats)
        self.assertIn("voiced_unvoiced_ratio", feats)

        si_cap = get_language_capabilities("si")
        self.assertFalse(si_cap["linguistic_rules_supported"])
        self.assertFalse(si_cap["dementia_inference_supported"])
        en_cap = get_language_capabilities("en")
        self.assertTrue(en_cap["linguistic_rules_supported"])
        self.assertFalse(en_cap["dementia_inference_supported"])

    def test_voice_comparison_pipeline_non_clinical_smoke(self):
        rng = np.random.default_rng(7)
        rows = []
        for spk in range(30):
            label = spk % 2
            for _ in range(2):
                rows.append({
                    "speaker_id": f"spk_{spk}",
                    "target": label,
                    "mfcc_1_mean": float(rng.normal(label * 0.5, 1.0)),
                    "pitch_mean_hz": float(rng.normal(150 + label * 10, 15.0)),
                    "word_count": float(rng.integers(20, 60)),
                    "lexical_diversity": float(rng.uniform(0.4, 0.9)),
                    "pause_count": float(rng.integers(0, 6)),
                })
        df = pd.DataFrame(rows)
        with tempfile.TemporaryDirectory() as tmp:
            rep = run_voice_model_comparison(
                df,
                speaker_col="speaker_col" if False else "speaker_id",
                target_col="target",
                acoustic_cols=["mfcc_1_mean", "pitch_mean_hz"],
                linguistic_cols=["word_count", "lexical_diversity"],
                silence_control_cols=["pause_count"],
                output_dir=Path(tmp),
                model_version="voice-smoke-v1",
            )
            self.assertIn("acoustic_only", rep["comparison"])
            self.assertIn("linguistic_only", rep["comparison"])
            self.assertIn("combined", rep["comparison"])
            self.assertIn("silence_control", rep["comparison"])
            self.assertTrue((Path(tmp) / "voice-smoke-v1" / "metadata.json").is_file())

    def test_nifti_mri_ct_separation_and_invalid_volume_rejection(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Valid .nii.gz MRI & CT
            nii_gz = Path(tmp) / "brain.nii.gz"
            with gzip.open(nii_gz, "wb") as gz:
                gz.write(_make_nifti1_header(64, 64, 32) + b"\x00" * 64)

            mri_res = analyze_imaging_file(nii_gz, declared_modality="mri")
            self.assertEqual(mri_res["modality"], "mri")
            self.assertEqual(mri_res["model_output"]["code"], "mri_model_unavailable")

            ct_res = analyze_imaging_file(nii_gz, declared_modality="ct")
            self.assertEqual(ct_res["modality"], "ct")
            self.assertEqual(ct_res["model_output"]["code"], "ct_model_unavailable")
            self.assertEqual(ct_res["preprocessing_summary"]["applied_to"], "ct_only")

            # Reject 2D screenshot / invalid dimensions
            bad_nii = Path(tmp) / "screenshot.nii"
            bad_nii.write_bytes(_make_nifti1_header(64, 64, 1))
            with self.assertRaises(ImagingValidationError):
                analyze_imaging_file(bad_nii, declared_modality="mri")

    def test_dicom_and_zip_path_traversal_rejection(self):
        valid_dcm = b"\x00" * 128 + b"DICM" + b"\x00" * 16
        meta = validate_dicom_bytes(valid_dcm)
        self.assertEqual(meta["format"], "dicom")

        with tempfile.TemporaryDirectory() as tmp:
            evil_zip = Path(tmp) / "evil.zip"
            with zipfile.ZipFile(evil_zip, "w") as zf:
                zf.writestr("../escape.dcm", valid_dcm)
            with self.assertRaises(ImagingValidationError) as ctx:
                validate_dicom_zip(evil_zip)
            self.assertEqual(ctx.exception.code, "path_traversal_rejected")


if __name__ == "__main__":
    unittest.main()
