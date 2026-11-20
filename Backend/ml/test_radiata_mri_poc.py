"""Unit and integration tests for the experimental Radiata/OASIS 3D MRI classifier."""

import gzip
import struct
import tempfile
import unittest
from pathlib import Path

from Backend.ml.imaging.imaging_pipeline import (
    DEFAULT_MRI_ARTIFACT_DIR,
    analyze_imaging_file,
    classify_mri_volume,
)


def _write_synthetic_3d_nifti(path: Path, nx: int = 32, ny: int = 32, nz: int = 24) -> None:
    import nibabel as nib
    import numpy as np

    rng = np.random.default_rng(11)
    vol = np.zeros((nx, ny, nz), dtype=np.float32)
    vol[4:-4, 4:-4, 3:-3] = rng.uniform(50.0, 180.0, size=(nx - 8, ny - 8, nz - 6)).astype(np.float32)
    img = nib.Nifti1Image(vol, np.diag([1.5, 1.5, 1.5, 1.0]))
    nib.save(img, str(path))


class RadiataMriPocTests(unittest.TestCase):
    @unittest.skipUnless((DEFAULT_MRI_ARTIFACT_DIR / "metadata.json").is_file(), "Trained MRI bundle not present")
    def test_mri_bundle_integrity_and_inference_and_ct_isolation(self):
        with tempfile.TemporaryDirectory() as tmp:
            scan = Path(tmp) / "test_brain.nii.gz"
            _write_synthetic_3d_nifti(scan)

            mri_res = analyze_imaging_file(scan, declared_modality="mri")
            self.assertEqual(mri_res["status"], "validated")
            out = mri_res["model_output"]
            self.assertEqual(out["status"], "available_experimental_poc")
            self.assertEqual(out["model_version"], "radiata-oasis-mri-v1.0.0")
            self.assertIn(out["prediction"]["predicted_label"], {"cognitively_normal", "Alzheimers_disease"})
            self.assertFalse(out["prediction"]["scores_are_calibrated_probabilities"])
            self.assertIn("not intended for clinical diagnosis", out["disclaimer"])

            # CT must never route into MRI model
            ct_res = analyze_imaging_file(scan, declared_modality="ct")
            self.assertEqual(ct_res["model_output"]["status"], "unavailable")
            self.assertEqual(ct_res["model_output"]["code"], "ct_model_unavailable")

    def test_missing_bundle_returns_unavailable(self):
        with tempfile.TemporaryDirectory() as tmp:
            scan = Path(tmp) / "test_brain.nii.gz"
            _write_synthetic_3d_nifti(scan)
            out = classify_mri_volume(scan, artifact_directory=Path(tmp) / "nonexistent")
            self.assertEqual(out["status"], "unavailable")
            self.assertEqual(out["code"], "mri_model_unavailable")


if __name__ == "__main__":
    unittest.main()
