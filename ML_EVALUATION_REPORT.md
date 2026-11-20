# ML Evaluation Report — Stage 6 (`ML_EVALUATION_REPORT.md`)

**Date:** 2026-11-20  
**Versioned Bundle:** `artifacts/models/clinical_tabular_research/zenodo-13378346-v1.0.0/`  
**Pipeline:** `Backend/ml/training/pipeline.py` (`infer_tabular.py` for isolated bundle loading)

---

## 1. Provenance, Splits & Leakage Controls
- **Dataset:** Zenodo `13378346` (`CC-BY-4.0`, `283` unique participants, `0` duplicates).
- **Participant-Level Split:** `StratifiedGroupKFold` (`group_col="Nr"`): Train `169`, Validation `57`, Test `57`. Disjointness verified programmatically (`0` shared `Nr` IDs).
- **Leakage Prevention:** `SimpleImputer` and `StandardScaler` fit on Train only; `Nr` and `Clinical Diagnosis` excluded from predictors; test partition never used for model selection.
- **Bundle Integrity:** `metadata.json` (`format="mindscan-research-model"`, `schema_version=2`) records SHA-256 hashes of the source `.xlsx` and `.joblib` weights.

## 2. Explainability (Permutation Importance on Validation Set, Random Forest)
Top 5 statistical predictors (correlation/predictive association only — **not** causal claims):
1. `D3` (Vitamin D3): `0.0786 ± 0.0203`
2. `Years of study`: `0.0532 ± 0.0132`
3. `IADL` (Instrumental Activities of Daily Living): `0.0463 ± 0.0283`
4. `Age`: `0.0190 ± 0.0145`
5. `Potassium`: `0.0119 ± 0.0165`

## 3. Limitations & Scope Boundary
- **Small Sample Size (`N=283`):** Single-center cohort; internal CV/holdout is **not** external clinical validation.
- **Modality Boundary:** This tabular biomarker model is isolated from MindScan's live digital cognitive/speech/drawing inference (`predict.py` explicitly returns `unavailable` for `clinical_tabular_research`).
- **Missing Live Clinical Data:** Training a live MindScan digital-task or speech classifier requires authorized, participant-labeled MindScan or DementiaBank/ADReSS cohorts.
