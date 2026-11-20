# Stage 14.2 — MRI Age Confounding Investigation Report

**Date:** 2026-11-20  
**Scope:** Scientific investigation of age confounding in the experimental MRI model (`radiata-oasis-mri-v1.0.0`, `volumetric_logreg`), without modifying production model weights, clinical thresholds, or existing patient/screening database records.

---

## 1. Executive Summary

Stage 14.1 identified a substantial age imbalance in the `radiata-ai/brain-structure` OASIS-1 + OASIS-2 MRI cohort (`787` scans): cognitively normal controls span ages `18–97` (mean `57.98 ± 24.77`), whereas Alzheimer's disease scans span ages `61–98` (mean `76.77 ± 7.09`).

This Stage 14.2 investigation demonstrates two key findings:
1. **Age confounding is real and inflates the headline ROC-AUC:** An **Age-Only** logistic regression baseline trained on the exact same participant-disjoint splits achieves `0.6868` ROC-AUC on the untouched test set (`n=158`, `pos=54`), confirming that chronological age alone separates a large fraction of the full cohort due to young controls (`18–59`).
2. **The MRI model still captures real structural signal above age:** When evaluation is restricted to older adults (`age >= 60`)—where `Age-Only` drops to chance (`0.4384` ROC-AUC on `test[age>=60]`, `0.4819` on a fresh age-matched `age >= 60` split)—the volumetric MRI model retains `0.7842` ROC-AUC on `test[age>=60]` and `0.7754` ROC-AUC (`0.7780` PR-AUC, `71.30%` accuracy) when trained and tested strictly on age-matched `age >= 60` adults (`76.79` vs `76.77` mean age).

**Recommendation:** Keep `radiata-oasis-mri-v1.0.0` strictly labeled **experimental / non-diagnostic** with an explicit **age-confounding caveat** (noting that the headline `0.8770` ROC-AUC is inflated by `~0.09–0.10` relative to age-matched `age >= 60` performance of `~0.775–0.784`), and **do not use it for clinical decision-making** until externally validated on multi-site, age-matched cohorts.

---

## 2. Demographic & Scanner Metadata Analysis

Source files inspected (read-only):
- `Dementia_Detection_Tool-main/research-data/radiata_mri/manifest.csv` (`787` scans total)
- `radiata-ai/brain-structure/metadata.csv`

| Attribute | Cognitively Normal (`cognitively_normal`) | Alzheimer's Disease (`Alzheimers_disease`) | Notes |
|---|---:|---:|---|
| Scans | `522` | `265` | Total `787` scans |
| Subjects | `400` | `178` | Participant-disjoint splits preserved |
| Age (mean ± std, range) | `57.98 ± 24.77` (`18–97`) | `76.77 ± 7.09` (`61–98`) | Young `18–59` controls present only in CN |
| Missing Age / Sex | `0` / `0` | `0` / `0` | Zero missing demographic values across all `787` scans |
| Sex distribution | `female: 338`, `male: 184` | `male: 135`, `female: 130` | Higher female proportion in controls |
| Study distribution | `OASIS-1: 314`, `OASIS-2: 208` | `OASIS-2: 165`, `OASIS-1: 100` | Higher OASIS-2 proportion in AD |
| Scanner model | `Vision: 522` | `Vision: 265` | Uniform Siemens Vision across all scans |
| Field strength | `1.5T: 522` | `1.5T: 265` | Uniform `1.5T` across all scans |

**Scanner/Field Strength Finding:** All `787` scans were acquired on a Siemens `Vision` `1.5T` scanner. Scanner model and field strength are therefore **not** confounded between AD and cognitively normal groups in this OASIS-1 + OASIS-2 subset (though single-scanner homogeneity limits cross-scanner generalization).

---

## 3. Model Comparison on Original Participant-Disjoint Splits

All models below were evaluated on the untouched original participant-disjoint test split (`n=158`, `pos=54`).

| Model | Split | n (pos) | Accuracy (95% CI) | Precision | Recall | Specificity | F1 | ROC-AUC | PR-AUC | Confusion Matrix `[[TN, FP], [FN, TP]]` |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **Original MRI (`volumetric_logreg`)** | Test | `158` (`54`) | `0.7911` (`[0.7212, 0.8472]`) | `0.6615` | `0.7963` | `0.7885` | `0.7227` | `0.8770` | `0.7404` | `[[82, 22], [11, 43]]` |
| **Age-Only Baseline** | Validation | `157` (`53`) | `0.6433` (`[0.5658, 0.7140]`) | `0.4851` | `0.9245` | `0.5000` | `0.6364` | `0.7343` | `0.5128` | `[[52, 52], [4, 49]]` |
| **Age-Only Baseline** | Test | `158` (`54`) | `0.6266` (`[0.5490, 0.6982]`) | `0.4706` | `0.7407` | `0.5673` | `0.5755` | `0.6868` | `0.4506` | `[[59, 45], [14, 40]]` |
| **Age + MRI Combined** | Test | `158` (`54`) | `0.7911` (`[0.7212, 0.8472]`) | `0.6615` | `0.7963` | `0.7885` | `0.7227` | `0.8778` | `0.7432` | `[[82, 22], [11, 43]]` |

**Interpretation:** Adding `age` directly to the volumetric MRI features (`Age + MRI Combined`) changes test ROC-AUC minimally (`0.8770` → `0.8778`) and leaves thresholded classification metrics identical (`79.11%` accuracy, `0.7227` F1), indicating that brain morphometry already correlates strongly with age across the full `18–98` span.

---

## 4. Age-Restricted & Age-Matched Evaluation (`age >= 60`)

To isolate dementia-related structural signal from normal aging effects in `18–59` controls, we evaluated both:
1. The **untouched original test split restricted to `age >= 60`** (`n=112`, `pos=54`), and
2. A **fresh age-matched `age >= 60` cohort** (`571` scans across `348` subjects: `cognitively_normal: 306`, `Alzheimers_disease: 265`) with fresh participant-disjoint splits. In this `age >= 60` cohort, mean age is virtually identical between classes (`cognitively_normal: 76.79 ± 8.38` vs `Alzheimers_disease: 76.77 ± 7.09`).

| Evaluation Setup | Model | Test n (pos) | Accuracy (95% CI) | Precision | Recall | Specificity | F1 | ROC-AUC | PR-AUC | Confusion Matrix `[[TN, FP], [FN, TP]]` |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **Original Test (`age >= 60`)** | Original MRI (`volumetric_logreg`) | `112` (`54`) | `0.7054` (`[0.6152, 0.7818]`) | `0.6615` | `0.7963` | `0.6207` | `0.7227` | `0.7842` | `0.7420` | `[[36, 22], [11, 43]]` |
| **Original Test (`age >= 60`)** | Age-Only Baseline | `112` (`54`) | `0.4732` (`[0.3832, 0.5650]`) | `0.4706` | `0.7407` | `0.2241` | `0.5755` | `0.4384` | `0.4506` | `[[13, 45], [14, 40]]` |
| **Age-Matched (`age >= 60` cohort)** | MRI-Only (`volumetric_logreg`) | `115` (`53`) | `0.7130` (`[0.6245, 0.7878]`) | `0.6786` | `0.7170` | `0.7097` | `0.6972` | `0.7754` | `0.7780` | `[[44, 18], [15, 38]]` |
| **Age-Matched (`age >= 60` cohort)** | Age-Only Baseline | `115` (`53`) | `0.4783` (`[0.3891, 0.5688]`) | `0.4407` | `0.4906` | `0.4677` | `0.4643` | `0.4819` | `0.4560` | `[[29, 33], [27, 26]]` |

### Key Takeaways
- When young controls (`18–59`) are removed, **Age-Only drops from `0.6868` to chance (`0.4384` / `0.4819` ROC-AUC)**.
- Under the exact same `age >= 60` restriction, **volumetric MRI maintains `0.7842` ROC-AUC (original model) and `0.7754` ROC-AUC / `0.7780` PR-AUC (age-matched retrain)**.
- Therefore, the volumetric MRI model does learn genuine Alzheimer's-related brain atrophy signals beyond chronological age, **but** its unadjusted `0.8770` ROC-AUC overstates discrimination in older clinical populations by `~0.09–0.10` ROC-AUC points (`~0.877` vs `~0.775–0.784`) and specificity drops (`0.7885` → `0.6207` on the original model when `18–59` controls are excluded).

---

## 5. Limitations & Production Status Recommendation

### Scientific & Dataset Limitations
- **Age confounding in full-cohort metrics:** Young healthy controls (`18–59`) inflate specificity and ROC-AUC on the full OASIS-1+2 dataset.
- **Single-scanner homogeneity:** All `787` scans come from Siemens `Vision` `1.5T` scanners; performance on `3T` or other vendor scanners is untested.
- **No external clinical validation:** All splits come from OASIS-1+2 via `radiata-ai/brain-structure`; no multi-site prospective validation has been performed.
- **No production weight changes made:** Per Stage 14.2 rules, `artifacts/models/imaging/radiata-oasis-mri-v1.0.0/` was left untouched.

### Recommendation
- **Keep the MRI model strictly `experimental` (`available_experimental_poc`)** for academic demonstration only, accompanied by an explicit caveat stating that clinical validation is absent and the `0.8770` ROC-AUC includes `~0.09–0.10` inflation from `18–59` young controls (age-matched `age >= 60` ROC-AUC is `0.7754–0.7842`).
- **Disable / do not rely on it for clinical decision-making** until an age-matched, multi-site, externally validated model is trained and approved.

---

## 6. Screening #18 PDF Report Verification

- Tested `GET http://localhost:3001/api/screening/18/report.pdf` authenticated as `stage14_1_audit@example.com` (Screening `#18` has `mri` and `ct` uploaded in `brain_imaging_scans` and remains `in_progress` without completed cognitive tasks).
- **Observed Response:** `HTTP 404` with `{"message":"Complete these required tasks first: memory, attention, orientation, language"}`.
- **Code Inspection (`Backend/services/pdfReportService.js`, lines 142–151):** Confirms Section `7. BRAIN IMAGING (OPTIONAL)` renders MRI availability, `modelStatus`, `Experimental label`, the non-diagnostic prototype notice (`"This imaging model is an experimental research prototype and is not intended for clinical diagnosis."` when `mri.modelOutput?.status === "available_experimental_poc"`), and CT availability/`modelStatus` once required cognitive tasks are completed.
- Existing patient/screening DB records were **not** modified during this verification.
