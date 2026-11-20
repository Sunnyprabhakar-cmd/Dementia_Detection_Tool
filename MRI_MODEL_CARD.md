# MRI Model Card — MindScan AI (`MRI_MODEL_CARD.md`)

- **Model Status:** **`mri_model_unavailable`** (blocked pending user OASIS-1/ADNI DUA approval and authorized download).
- **Supported Input Validation & Preprocessing (`Backend/ml/imaging/imaging_pipeline.py`):** `.nii`, `.nii.gz`, `.dcm`, `.zip` (DICOM series). Validates 3D dimensions, voxel spacing, slice count; rejects 2D screenshots/photos and ZIP path-traversal attacks.
- **Intended Use:** Research validation and preprocessing only; never diagnoses dementia.
