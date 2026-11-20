# Stage 15 — Documentation & Viva PDF Update Report

**Date:** 2026-11-20  
**Repository:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`

---

## 1. Deliverables Updated / Created

1. **`README.md`** (updated in place)
2. **`DEMENTIA_DETECTION_TOOL_VIVA_GUIDE.pdf`** (updated in place — **`38` pages**)
3. **`STAGE15_DOCUMENTATION_UPDATE_REPORT.md`** (this report)

---

## 2. Sections Updated in `README.md`

- **Project Overview & Introduction (Section 1 & Features Section 2):** Added experimental structural Brain MRI analysis (`radiata-oasis-mri-v1.0.0`, `volumetric_logreg`), clarified that the app supports cognitive tasks, speech analysis, optional physical examination observations, and experimental structural MRI analysis, and explicitly stated that Brain CT AI inference is `unavailable`.
- **System Architecture (Section 4):** Updated the high-level Mermaid diagram and added a dedicated MRI/CT upload & inference Mermaid flowchart covering the Frontend MRI upload component, Node.js `imagingController.js`/`imagingService.js`, Python `imaging_pipeline.py` validation & 27 3D features, `volumetric_logreg`, `brain_imaging_scans` Neon PostgreSQL persistence, and PDF Section 7 reporting—explicitly isolated from cognitive scoring and speech classification.
- **Experimental MRI Dataset, Model & Age Confounding (Section 10):**
  - Dataset: `radiata-ai/brain-structure` (`OASIS-1` + `OASIS-2` subset), `787` 3D T1-weighted MRI scans, `564` unique participants, `522` `cognitively_normal`, `265` `Alzheimers_disease`, participant-disjoint split (`472` train / `157` val / `158` test).
  - Evaluated architectures: `volumetric_logreg` (selected), `triplanar_2d_cnn`, `lightweight_3d_cnn`.
  - Untouched test metrics (`n = 158`): Accuracy `79.11%` (`[0.7212, 0.8472]`), ROC-AUC `0.8770`, Precision `66.15%`, Recall `79.63%`, Specificity `78.85%`, F1 `72.27%`, PR-AUC `0.7404`.
  - Stage 14.2 Age Confounding: CN mean age `57.98` vs AD mean age `76.77` (`~18.8`-year gap), Age-Only baseline ROC-AUC `0.6868` (full test) vs `0.4384` (`test[age >= 60]`) vs `0.4819` (fresh age-matched `age >= 60`), while MRI retains `0.7842` (`test[age >= 60]`) and `0.7754` (fresh age-matched `age >= 60`).
- **Testing & Verification (Section 12):** Updated to Stage 14.1/14.2 counts (`75/75` Backend, `16/16` Frontend, `32` Vite modules in `280ms`, `17/17` `.venv-audio` Audio+MRI tests, `79` run / `74` passed / `5` skipped / `0` failures in full Python ML suite, live MRI upload `201` + Neon persistence, corrupt MRI rejection `400`, CT `unavailable` `201`), and explicitly noted that Screening `#18` PDF download returned `HTTP 404` because required cognitive tasks were incomplete.
- **Limitations & Licensing (Sections 13–14):** Documented research-PoC-only status, lack of external clinical validation, demographic/age confounding, uncalibrated relative scores (`scores_are_calibrated_probabilities: false`), CT unavailability, OASIS DUA obligations persisting after anonymization, and gitignored local scans/weights.

---

## 3. Updates & Quality Assurance for `DEMENTIA_DETECTION_TOOL_VIVA_GUIDE.pdf`

### Content Preserved & Updated
- Preserved all **16 original chapters**, chapter organization, and all **100 original viva questions (`Q1`–`Q100`, Sections A–J)** (updating `Q86`/`Q87` test counts to match `17/17` and `74/79`).
- Updated **Cover**, **Table of Contents**, **Chapter 1**, **Chapter 2** (SVG architecture + lifecycle), **Chapter 7** (added Sections `7.5` Experimental Structural MRI Pipeline, `7.6` Stage 14.1 Licensing & Leakage Audit, `7.7` Stage 14.2 Age-Confounding Investigation), **Chapter 8** (MRI modality isolation), **Chapter 12** (Stage 14.1/14.2 test results + Screening `#18` PDF caveat), **Chapter 14** (MRI/CT/age/DUA limitations), **Chapter 15** (added **Section K: `Q101`–`Q112`**, 12 additional questions covering MRI motivation, NIfTI `.nii.gz`, 3D preprocessing, `volumetric_logreg`, participant-disjoint splitting, misleading `0.8770` ROC-AUC, age confounding, `0.7754` age-matched ROC-AUC, lack of clinical validation, disabled CT inference, OASIS DUA after anonymization, and modality isolation), and **Chapter 16** (updated elevator pitch, walkthrough, demo order, and Quick Revision Sheet).

### PDF Quality Assurance Results
- **Final Page Count:** **`38` pages**
- **Extractable Text & Blank Page Check (`pypdf`):** `38/38` pages have extractable text; **Empty pages: `[]` (0 blank pages)**.
- **Viva Questions Verified:** Original Q&As **`100/100`** + Additional MRI Q&As **`12/12`** (`112` total).
- **Secret Leak Check:** `0` leaked credentials/secrets.
- **Visual Inspection:** Rendered all `38` pages via `pypdfium2` into 7 contact sheets (`sheet_1.png`–`sheet_7.png`) and inspected all sheets visually; confirmed clean headers/footers (`Page X of 38`), readable SVG diagrams, non-overflowing tables, clean page breaks, and no clipping or overlapping text.

---

## 4. Consistency Audit & Remaining Limitations

- Verified consistency across `README.md`, `DEMENTIA_DETECTION_TOOL_VIVA_GUIDE.pdf`, `IMAGING_MODEL_CARD.md`, `IMAGING_MODEL_TRAINING_REPORT.md`, `STAGE14_1_FINAL_AUDIT_REPORT.md`, and `STAGE14_2_AGE_CONFOUNDING_REPORT.md`:
  - MRI model is **never** described as clinically validated.
  - Scores are **never** described as diagnostic probabilities (`scores_are_calibrated_probabilities: false`).
  - Brain CT AI inference is consistently marked **unavailable**.
  - Screening `#18` PDF download is explicitly documented as **incomplete (`HTTP 404` due to missing cognitive tasks)**.
  - Application logic and patient/screening DB records were **not** modified.
