# Stage 10.6 — Unified Assessment Score, Threshold-Based Classification & Results Dashboard

**Date:** 2026-11-20  
**Repository:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`

---

## 1. Separation of Scoring Systems

### A. Assessment Performance Score (`assessment-performance/1.0.0`)
- **Formula:**
  $$\text{Assessment Performance Score} = \frac{1}{|M|} \sum_{t \in M} s_t$$
  where $M$ is the subset of the `7` numeric cognitive tasks (`memory`, `delayed_memory`, `digit_span`, `picture_recognition`, `pattern_recognition`, `orientation`, `attention`) that were actually completed (not skipped, not missing, and having a finite score in $[0, 100]$).
- **Exclusions:**
  - Skipped tasks and missing tasks are excluded from $M$ and **never** scored as `0`.
  - `language` (unscored descriptive observations), `clock_drawing` (spatial CV heuristics), and `voice` (speech timing & acoustic classifier) are kept separate and never double-counted or merged with arbitrary weights.
- **Assessment Completeness:** Computed separately as `completedCount / 10 * 100%` across the 10 expected tasks.
- **Labeling:** Displayed as **Assessment Performance Score (`XX/100`)**, never as a clinical dementia risk score, and without any invented normal/dementia cutoff.

### B. Experimental Speech Classifier (`dementianet-acoustic-v1.0.0`)
- **Model:** `logistic_regression` (`SimpleImputer` + `StandardScaler` + `LogisticRegression`) trained on `44` acoustic/prosodic features from DementiaNet (`453` valid recordings, `214` speakers; `271`/`91`/`91` speaker-disjoint train/val/test split).
- **Score Generation:** Outputs uncalibrated relative class scores (`scores_are_calibrated_probabilities: false`) for `nodementia` and `dementia`. Never presented as `%` or probabilities of dementia.
- **Threshold Selection (`dementianet-val-default-0.50/v1.0`):**
  - Inspected on **validation set (`n = 91`, `43` speakers) only**; never tuned on the independent test set.
  - Default `0.50` boundary on the `dementia` relative score yields:
    - **Validation (`n = 91`):** Accuracy `0.6264`, Sensitivity/Recall `0.4231`, Specificity `0.7077`, Precision `0.3667`, F1 `0.3929`, Youden's J `0.1308`, Confusion Matrix `[[46, 19], [15, 11]]`.
    - **Untouched Independent Test (`n = 91`):** Accuracy `0.7363` (95% CI `[0.6375, 0.8159]`), Sensitivity/Recall `0.6154`, Specificity `0.7846`, Precision `0.5333`, F1 `0.5714`, ROC-AUC `0.7562`, PR-AUC `0.5257`, Confusion Matrix `[[51, 14], [10, 16]]`.
  - **Trade-offs & Clinical Boundary:** Lowering the cutoff (e.g., `0.35` on validation) increases sensitivity (`0.5769`) at the expense of specificity (`0.5692`, `28` false positives). Because validation Youden's J (`0.1308`) is modest and labels are weak YouTube biographical labels, the UI explicitly displays: **"Experimental classification — threshold not clinically validated"**.
- **Prediction Outcomes & Gating:**
  - `Dementia` / `Non-dementia`: only when `language == "en"`, `quality_reliable === true`, all `44` acoustic features are finite, and SHA-256 passes.
  - `Inconclusive`: unsupported language (`language != "en"`), poor audio quality (`quality_reliable !== true`), or missing features.
  - `Model unavailable`: missing/corrupted/tampered model bundle.

---

## 2. Multimodal Policy & Dashboard / PDF Integration

- No trained, clinically validated multimodal dementia classifier exists; therefore cognitive task performance, clock drawing observations, speech features, and experimental speech classification are kept **strictly separate** across:
  - Final Report (`Frontend/src/App.jsx` & `Frontend/src/components/MultimodalSummary.jsx`)
  - Patient Dashboard & Assessment History (`Frontend/src/components/PatientDashboard.jsx` via `MultimodalSummary`)
  - Clinician Dashboard (`Frontend/src/components/ClinicianDashboard.jsx` via `MultimodalSummary`)
  - Multimodal Summary API (`Backend/services/riskAssessmentService.js`)
  - Downloadable PDF (`Backend/services/pdfReportService.js`)
- Neutral non-diagnostic colors (slate/blue) are used instead of red/green diagnostic indicators, and the `Simulated Dementia Probability (Demo Only)` card is restricted to `isSimulatedDemo` mode only.

---

## 3. Changed Files

- `Backend/ml/audio_classifier.py`
- `Frontend/src/components/VoiceTask.jsx`
- `Frontend/src/assessmentUtils.js`
- `Backend/services/assessmentValidation.js`
- `Backend/services/riskAssessmentService.js`
- `Backend/services/pdfReportService.js`
- `Frontend/src/components/MultimodalSummary.jsx`
- `Frontend/src/App.jsx`
- `Backend/tests/stage10_6UnifiedReport.test.js`
- `Backend/ml/test_dementianet_poc.py`
- `STAGE10_6_SCORING_AND_CLASSIFICATION_REPORT.md`

---

## 4. Remaining Scientific Limitations

1. DementiaNet uses weak biographical labels from public-figure English YouTube interviews rather than clinical MMSE/MoCA/CDR evaluations.
2. Class imbalance (`324` `nodementia` vs `129` `dementia`) and YouTube recording/compression confounders limit generalizability to clinical patients.
3. Non-English recordings (`hi`, `pa`, `si`, `ta`) and unreliable audio recordings cannot be scored by `dementianet-acoustic-v1.0.0`.
4. The `0.50` decision threshold is not clinically validated; `scores_are_calibrated_probabilities` is `false`.
