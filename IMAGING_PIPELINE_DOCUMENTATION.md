# Imaging Pipeline Documentation — Stage 10 (`IMAGING_PIPELINE_DOCUMENTATION.md`)

- **Database Table:** `brain_imaging_scans` (`Backend/database/migrations/006_brain_imaging_scans.sql`).
- **Python Validator & CLI (`Backend/ml/imaging/imaging_pipeline.py`, `Backend/ml/analyze_imaging.py`):**
  - NIfTI-1 (`.nii`, `.nii.gz`) header/magic/dimension/spacing validation (rejects 2D screenshots).
  - DICOM (`.dcm`) & ZIP (`.zip`) validation with path-traversal rejection, file-count limit (`512`), size limit (`256 MB`), and PII tag redaction summary.
- **Backend APIs (`Backend/routes/imagingRoutes.js`, `imagingController.js`, `imagingService.js`):**
  - `POST /api/imaging/upload` (`<= 50 MB`, UUID storage outside `Frontend/`)
  - `GET /api/imaging/screening/:id` (patient owner or assigned clinician)
  - `DELETE /api/imaging/:scanId` (patient owner)
- **Frontend UI:** `Frontend/src/components/BrainImagingUpload.jsx` ("Brain Imaging (Optional)").
