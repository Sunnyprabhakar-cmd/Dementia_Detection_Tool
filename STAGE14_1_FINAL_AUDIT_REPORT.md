# Stage 14.1 — MRI Model Scientific, Licensing & End-to-End Audit Report

**Date:** 2026-11-20  
**Repository:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`

---

## A. Dataset & Licensing Audit

- **Source & Terms:** `radiata-ai/brain-structure` (`ODC-By v1.0` compilation) containing preprocessed `OASIS-1` and `OASIS-2` T1-weighted MRI volumes (`https://sites.wustl.edu/oasisbrains/`).
- **OASIS DUA Obligations:** Anonymization/skull-stripping does **not** remove OASIS DUA obligations. OASIS prohibits redistributing raw or decodable OASIS data to third parties without permission and prohibits facial reconstruction or re-identification.
- **Licensing Decision:**
  - Local download, academic research training, and local academic demonstration are **permitted** with proper OASIS attribution.
  - Raw `.nii.gz` volumes remain strictly local and gitignored (`research-data/radiata_mri/.gitignore`).
  - Model weights (`artifacts/models/imaging/radiata-oasis-mri-v1.0.0/`) are gitignored (`artifacts/models/` in `.gitignore`) and **will not be redistributed publicly** without confirming OASIS DUA compliance.

---

## B. Data Leakage Audit

1. **`participant_hash` & Longitudinal Deduplication:** Verified `file_sha256` is unique across all **`787 / 787`** scans (`0` duplicates). Verified `participant_level_split(..., random_state=42)` grouped by `participant_hash` produced **`0` participant overlap** across Train (`339` participants / `472` scans), Validation (`113` participants / `157` scans), and Test (`112` participants / `158` scans) — keeping all longitudinal `OASIS-2` sessions of a subject in the same split.
2. **Preprocessing Isolation:** `SimpleImputer` and `StandardScaler` are fit strictly on the training split inside `sklearn.pipeline.Pipeline`; test-set statistics are never used.
3. **Model Selection & Untouched Test Set:** `metadata.json` selection and `0.50` cutoff were evaluated without tuning on the test set. Independent recomputation on the untouched `test` split (`n = 158`) matched `metadata.json` exactly: `Acc: 0.7911`, `Prec: 0.6615`, `Rec: 0.7963`, `Spec: 0.7885`, `F1: 0.7227`, `ROC-AUC: 0.8770`, `PR-AUC: 0.7404`, `CM: [[82, 22], [11, 43]]`.

---

## C. Scientific Evaluation & Confounders

1. **Demographic & Study Confounders Observed:**
   - `cognitively_normal` (`522` scans / `400` subjects): Age **`57.98 ± 24.77`** (`18–97`), Sex `female: 338, male: 184` (`64.8%` female), Study `OASIS-1: 314, OASIS-2: 208`.
   - `Alzheimers_disease` (`265` scans / `178` subjects): Age **`76.77 ± 7.09`** (`61–98`), Sex `male: 135, female: 130` (`50.9%` male), Study `OASIS-2: 165, OASIS-1: 100`.
   - **Critical Finding:** Controls are on average **18.8 years younger** than AD subjects (including young adults aged 18–59 in OASIS-1). Therefore, volumetric separation (`0.8770` ROC-AUC) partly reflects **normal age-related atrophy** alongside AD-associated atrophy, not purely age-matched AD pathology.
2. **Why `volumetric_logreg` Outperformed Both CNNs:** With `472` training scans (`339` participants), the 27-feature `StandardScaler + LogisticRegression` has low parameter count (`28` weights) and strong L2 regularization, resisting overfitting; both PyTorch CNNs (`triplanar_2d_cnn`, `lightweight_3d_cnn`) suffered probability shift from `BCEWithLogitsLoss(pos_weight=neg/pos)` at cutoff `0.50`.
3. **Label Limitations:** Covers `cognitively_normal` vs `Alzheimers_disease` only (no MCI or non-AD dementias), and uses skull-stripped MNI152-aligned (`113×137×113`, `1.5 mm³`) volumes.

---

## D. Live Application E2E Evidence (`http://localhost:5173/` -> `http://localhost:3001/`)

- **Defect Found & Fixed:** Live browser E2E initially failed at CORS preflight (`Access-Control-Allow-Headers` lacked `x-screening-id`, `x-imaging-modality`, `x-file-name`). Fixed `Backend/server.js` `corsOptions.allowedHeaders`, restarted Backend, and re-verified on Screening `#18` (`stage14_1_audit@example.com`):
  1. **Structural MRI + `oasis_mri.nii.gz`:** `POST /api/imaging/upload` -> **`201`**; UI displayed `Experimental MRI Research Label: cognitively_normal (uncalibrated relative scores: Alzheimers_disease: 0.363 · cognitively_normal: 0.637)`, `radiata-oasis-mri-v1.0.0 (volumetric_logreg)`, and the non-diagnostic disclaimer.
  2. **Brain CT + `oasis_mri.nii.gz`:** `POST /api/imaging/upload` -> **`201`**; UI displayed `AI status: unavailable — No authorized labelled brain CT dementia dataset is available; CT AI inference is disabled.`
  3. **Structural MRI + `corrupt.nii`:** `POST /api/imaging/upload` -> **`400`** (`File is too small to be a valid NIfTI-1 volume.`); UI remained stable.
  4. **Console/Page Errors:** `0` console/page errors.

---

## E. Regression & Security Results (Run After Final CORS Edit)

- **Backend Node Tests (`npm test`):** `75/75` passed (`0` failures; includes `imagingRoutes require authentication (401)` and score/speech isolation tests).
- **Frontend Unit Tests (`npm test`) & Build (`vite build`):** `16/16` passed; `vite build` transformed `32` modules in `280ms` (`0` errors).
- **`.venv-audio` Audio, Speech PoC & MRI PoC Tests:** `17/17` passed (`test_audio_validation`, `test_transcribe_audio`, `test_dementianet_poc`, `test_radiata_mri_poc`).
- **Full Python ML Suite (`Backend/ml/test_*.py`):** `79` tests run — `74` passed, `5` skipped (`4` optional `faster-whisper` outside `.venv-audio`, `1` legacy `baseline_v1`), `0` failures.
- **Unverified in Live Browser:** Generating a PDF report for Screening `#18` with the MRI scan attached was not clicked in the browser (PDF Section 7 MRI rendering is verified in `Backend/services/pdfReportService.js` unit logic).
