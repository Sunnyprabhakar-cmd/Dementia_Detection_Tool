# ML Model Comparison — Zenodo 13378346 (`ML_MODEL_COMPARISON.md`)

**Date:** 2026-11-20  
**Dataset:** Zenodo `13378346` (`N=283` unique participants; Train `169`, Validation `57`, Test `57`; `0` cross-split participant overlap)  
**Target:** Binary Cognitive Impairment Group (`0 = control`, `1 = impaired [MCI or DEMENTIA]`)  
**Preprocessing:** `SimpleImputer(strategy="median", add_indicator=True)` + `StandardScaler()` fitted on **Train only** (`random_state=42`).

---

## 1. Cross-Validation & Holdout Comparison

| Model | 5-Fold CV ROC-AUC | Val ROC-AUC | Test Accuracy (95% Wilson CI) | Test Precision | Test Recall | Test F1 | Test ROC-AUC | Test PR-AUC | Test Brier |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Logistic Regression** | `0.5721` | `0.4824` | `0.5789` | — | — | `0.6364` | **`0.6351`** | **`0.7754`** | **`0.2478`** |
| **Decision Tree** | `0.5488` | `0.5743` | `0.5088` | — | — | `0.5758` | `0.4892` | `0.6412` | `0.3565` |
| **Random Forest** | **`0.6562`** | `0.5865` | `0.5439` | — | — | `0.6486` | `0.5000` | `0.6531` | `0.2527` |
| **Gradient Boosting** | `0.6239` | **`0.6338`** | `0.5789` | — | — | **`0.6923`** | `0.5351` | `0.6863` | `0.2649` |

*(Exact per-class precision, recall, confusion matrices, and Wilson intervals are stored in `artifacts/models/clinical_tabular_research/zenodo-13378346-v1.0.0/metadata.json`.)*

---

## 2. Scientific Interpretation
- On this `N=283` single-center cohort of routine clinical/lab/functional variables, **Logistic Regression** achieved the highest unseen holdout ROC-AUC (`0.6351`), PR-AUC (`0.7754`), and lowest Brier score (`0.2478`), while **Random Forest** had the highest 5-fold CV ROC-AUC (`0.6562`) and **Gradient Boosting** had the highest holdout F1 (`0.6923`).
- Overall discrimination is modest (`ROC-AUC ~0.50–0.64`), confirming that routine metabolic labs and comorbidities alone are **not** sufficient for clinical dementia screening without cognitive task, speech, or neuroimaging biomarkers.
