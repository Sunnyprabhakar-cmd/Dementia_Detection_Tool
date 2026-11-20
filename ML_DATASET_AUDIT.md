# ML Dataset Audit — MindScan AI (`ML_DATASET_AUDIT.md`)

**Date:** 2026-11-20  
**Scope:** Direct aggregate audit of all acquired open-access datasets in `research-data/open_zenodo/` prior to Stage 6 model training. Datasets are **never merged** across studies.

---

## 1. Zenodo `13378346` — *Cognitive performance of older patients*

1. **Original Source & Publication:** Zenodo Record `13378346` (`https://zenodo.org/records/13378346`), Creator: Bednorz, Adam, Published: `2024-09-01`.
2. **License & Permitted Usage:** `CC-BY-4.0` (Open Access, attribution required; permits research analysis and model development).
3. **Participants & Observations:** `283` rows, `283` unique `Nr` participant IDs (`0` nulls, `0` duplicates).
4. **Available Features (`24` candidate predictors excluding `Nr` and `Clinical Diagnosis`):**
   - Demographics: `Sex`, `Age`, `Years of study`
   - Lab/Metabolic Biomarkers: `CRP`, `TSH`, `Vit. B12`, `Sodium`, `Potassium`, `Creatinine`, `Hemoglobin`, `Hemoglobin Glycated`, `Uric Acid`, `D3`
   - Comorbidities: `Diabeties`, `Atherosclerosis`, `Heart Attack`, `FA`, `Stroke`, `HA`
   - Functional/Physical/Anthropometric: `ADL`, `IADL`, `BERG`, `Stress`, `BMI`
5. **Target Variable & Exact Meaning:** `Clinical Diagnosis` — categorical clinical group (`control`, `MCI`, `DEMENTIA`).
6. **Label Type:** Clinical group classification (`control` vs `MCI` vs `DEMENTIA`), not a raw screening questionnaire score.
7. **Missing-Value Percentages:** Low (`0.0%`–`7.42%`): `Hemoglobin Glycated` (`7.42%`), `D3` (`4.24%`), `Vit. B12` (`1.77%`), `Creatinine` (`1.06%`), `TSH` & `Hemoglobin` (`0.71%`), `CRP`, `ADL`, `BMI` (`0.35%`); all other columns `0.0%`.
8. **Class Distribution:** `MCI`: `144` (`50.9%`), `control`: `101` (`35.7%`), `DEMENTIA`: `38` (`13.4%`).
9. **Participant Identifiers:** Yes (`Nr`, 1:1 unique per row).
10. **Data Leakage & Duplicate Risks:** `Nr` must be excluded from features and used strictly for participant-level splitting. `ADL`/`IADL` are functional status measures that correlate strongly with clinical impairment and must be interpreted as correlated clinical predictors, not causal or digital-task equivalents.

---

## 2. Zenodo `5509808` — *Effect of neurological screening on early dementia detection in southern Italy*

1. **Original Source & Publication:** Zenodo Record `5509808` (`https://zenodo.org/records/5509808`), Creators: Maria Cristina De Cola et al., Published: `2020-10-05`.
2. **License & Permitted Usage:** `CC-BY-4.0` (Open Access, attribution required).
3. **Participants & Observations:** `706` rows in raw Excel sheet, but **`705` unique `ID`s and `1` null `ID`**. Direct inspection revealed the final row is an **aggregate summary/total row** (`ID=NaN`, `TEST NEURO-PSICOLOGICI=413`, `ALTERAZIONE NEUROL=705`), leaving `705` participant rows.
4. **Available Features:** `ETA'` (Age), `SESSO` (Sex), `ESENTE TICKET` (fee exemption), `TEST NEURO-PSICOLOGICI` (whether neuropsychological test was performed), `EEG/PEA`, `VISITA CARDIOLOGICA`, `ECG`, `VISISTA ORTOPEDICA`, `VISISTA CHIRURGICA`, `VISISTA NUTRIZIONALE`, `VISISTA OTORINO`, `ECO TSA`, `follow-up`, `Ambulatorio`.
5. **Target Variable & Exact Meaning:** `ALTERAZIONE NEUROL (SI,NO)` (`no`: `335`, `si`: `210`, `NaN`: `160`, summary row `'705'`: `1`).
6. **Label Type:** **Screening/neurological alteration flag**, NOT a confirmed dementia diagnosis.
7. **Missing-Value Percentages:** `Ambulatorio` (`82.58%`), `follow-up` (`24.93%`), `ALTERAZIONE NEUROL (SI,NO)` (`22.66%`), `ESENTE TICKET` (`16.29%`).
8. **Class Distribution (after removing summary row & missing target, N=545):** `no`: `335` (`61.5%`), `si`: `210` (`38.5%`).
9. **Participant Identifiers:** Yes (`ID`, after removing the summary row).
10. **Data Leakage & Duplicate Risks:** Features represent **specialist referral/visit utilization** (`VISITA CARDIOLOGICA`, `ECG`, `TEST NEURO-PSICOLOGICI`), not cognitive performance or speech/drawing biomarkers. Using `ALTERAZIONE NEUROL` as a "dementia diagnosis" would be scientifically invalid.

---

## 3. Defined Prediction Tasks & Scope Boundaries

| Task ID | Dataset | Target Definition | Input Features | Excluded Features | Intended Use & Limitations |
| --- | --- | --- | --- | --- | --- |
| **Task A (Primary): Cognitive Impairment Group Classification** | Zenodo `13378346` (`N=283`) | Binary: `0 = control` (`101`), `1 = impaired (MCI or DEMENTIA)` (`182`) | `Sex`, `Age`, `Years of study`, `CRP`, `TSH`, `Vit. B12`, `Sodium`, `Potassium`, `Creatinine`, `Hemoglobin`, `Hemoglobin Glycated`, `Uric Acid`, `D3`, `Diabeties`, `Atherosclerosis`, `Heart Attack`, `FA`, `Stroke`, `HA`, `ADL`, `IADL`, `BERG`, `Stress`, `BMI` | `Nr` (ID), `Clinical Diagnosis` (target) | Isolated tabular research model for clinical/biomarker classification. **Not** compatible with MindScan's live digital cognitive tasks (memory/attention/drawing/speech). |
| **Task B (Excluded from Diagnostic Claims)** | Zenodo `5509808` (`N=705`) | `ALTERAZIONE NEUROL` is a screening alteration flag, not a diagnosis | N/A | Summary row (`ID=NaN`), `Ambulatorio` | Used for tabular data-cleaning/audit verification only; **not** trained as a dementia classifier. |
