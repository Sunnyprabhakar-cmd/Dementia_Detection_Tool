# Stage 14 — Brain MRI/CT Integration Report

**Date:** 2026-11-20  
**Status:** MRI Experimental Inference Integrated & Verified; CT Inference Explicitly Disabled

---

## 1. Integration Summary

1. **Python Imaging Pipeline (`Backend/ml/imaging/imaging_pipeline.py`):**
   - Added `classify_mri_volume()` using `nibabel` + `joblib` (`volumetric_logreg.joblib`) with SHA-256 verification against `metadata.json`.
   - When `analyze_imaging_file()` receives a valid 3D `.nii` or `.nii.gz` MRI scan, it extracts the 27 3D morphometric/intensity features and returns `model_output` (`status: "available_experimental_poc"`, `predicted_label`, uncalibrated `class_scores`, `scores_are_calibrated_probabilities: false`, and the required disclaimer).
   - DICOM (`.dcm` / `.zip`) MRI uploads remain metadata-validated (`status: "unavailable"`, `code: "nifti_3d_required_for_mri_inference"`).
   - **CT Isolation Preserved:** `declared_modality="ct"` always returns `status: "unavailable"`, `code: "ct_model_unavailable"`, never routing CT scans into the MRI model.
2. **Backend & PDF (`Backend/services/riskAssessmentService.js`, `Backend/services/pdfReportService.js`):**
   - Preserved `mri.modelOutput` independently without modifying `Assessment Performance Score` or `Experimental Speech Model Prediction`.
   - Added experimental MRI label and disclaimer to PDF Section 7 (`BRAIN IMAGING (OPTIONAL)`).
3. **Frontend (`Frontend/src/components/BrainImagingUpload.jsx`):**
   - Displays `Experimental MRI Research Label`, uncalibrated decimal relative scores, model version (`radiata-oasis-mri-v1.0.0`), and the required non-diagnostic disclaimer.

---

## 2. Verification Results

- **Live `.venv-audio` CLI Test (`analyze_imaging.py` on real `OASIS-1` scan `msub-OASIS10001_ses-M000_T1w_brain_affine_mni.nii.gz`):** Exited `0`, returned `status: "validated"`, `model_output.status: "available_experimental_poc"`, `predicted_label: "cognitively_normal"`, `class_scores: {"cognitively_normal": 0.636519, "Alzheimers_disease": 0.363481}`.
- **Python Unit & Integration Tests (`Backend/ml/test_radiata_mri_poc.py` & `test_stage10_voice_and_imaging.py`):** Verified MRI bundle integrity, 3D NIfTI inference, CT isolation (`ct_model_unavailable`), invalid 2D screenshot rejection, and missing-bundle fallback.
- **Node & Frontend Regression (`npm test` & `vite build`):** `75/75` Backend tests passed, `16/16` Frontend tests passed, `vite build` transformed `32` modules in `261ms` (`0` errors).
