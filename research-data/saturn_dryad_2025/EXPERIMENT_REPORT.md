# SATURN isolated research baseline

## Provenance

- Dryad DOI: `10.5061/dryad.j9kd51cq4`
- Published version: 3
- Source CSV: `_SATURN_2025-04APR_06restructure_DEIDENTIFIED.csv`
- Source SHA-256: `18f3c5523a8e22e10e4b7dec9d458142665f716b1ada1f4d7cea9babfc745168`
- License reported by Dryad: CC0-1.0
- Downloaded source materials: CSV, XLSX, README, CSV variable descriptions, and plaintext variable descriptions

The complete 192-column list and per-column missingness are in
`saturn_audit_report.json`.

## Audit

The source file contains 1,033 rows and 1,033 unique de-identified `PATIENT`
identifiers. `INDEX_EVENT == SATURN` selects 149 rows. Restricting to a
nonmissing `SATURN_TOTAL_SCORE` and nonmissing target leaves 144 rows and 144
unique participants.

The target used for this isolated experiment is:

`AUTO_DEMENTIA_INITIAL_VISIT_1yes_0no`

Within the 144-row SATURN subset used for modeling:

- Label `0`: 94
- Label `1`: 50

The target is an automated ICD-code proxy from retrospective records. It is not
an adjudicated diagnosis and is not a clinical deployment label.

## Features and leakage controls

The baseline uses 44 SATURN component score, timing, reading-speed, motor-speed,
and total-time columns. The ordered feature list is stored in
`feature_schema.json` and `metadata.json`. It excludes:

- The target and the Alzheimer’s diagnosis field
- `INDEX_EVENT`
- `PATIENT`
- `SATURN_TOTAL_SCORE`
- `SATURN_POSSIBLE_SCORE`

The aggregate SATURN total and possible score are excluded to avoid duplicating
the aggregate outcome and to keep the experiment focused on component measures.
Missing numeric features are imputed inside each fitted model pipeline.
The three added features are included in the 44 raw input columns. The audit
counts their missing values across all 149 SATURN rows as reading speed 5,
motor speed 8, and total time 10. In the final 144-row modeling cohort, the
corresponding counts are 2, 3, and 5 after excluding five rows with missing
`SATURN_TOTAL_SCORE`.

SATURN is a different protocol from MindScan’s memory, attention, orientation,
language, and voice tasks. These features must not be mapped into the live
MindScan inference schema.

## Split and models

Version: `saturn-baseline-v0.1.0`

Participant-grouped split:

- Train: 86 participants, 58 negative / 28 positive
- Validation: 29 participants, 17 negative / 12 positive
- Test: 29 participants, 19 negative / 10 positive

The exact partition is persisted in
`artifacts/saturn-baseline-v0.1.0/split_manifest.json` using stable
privacy-conscious participant hashes, row indices, class counts, and the
dataset SHA-256. The outer and inner split seeds are 42 and 43. The persisted
partitions are pairwise disjoint and cover all 144 modeled participants.

Models:

- Logistic Regression with median imputation, missingness indicators,
  standardization, and class balancing
- Random Forest with median imputation and class balancing

All preprocessing is fit on the training partition only.

## Results

### Logistic Regression

| Split | Accuracy | Sensitivity | Specificity | Precision | F1 | ROC-AUC |
|---|---:|---:|---:|---:|---:|---:|
| Validation | 0.586 | 0.250 | 0.824 | 0.500 | 0.333 | 0.578 |
| Test | 0.759 | 0.700 | 0.789 | 0.636 | 0.667 | 0.774 |

95% Wilson intervals for the test accuracy, sensitivity, and specificity are
sampling-uncertainty intervals only: accuracy `[0.579, 0.878]`,
sensitivity `[0.397, 0.892]`, and specificity `[0.567, 0.915]`.

Test confusion matrix, labels `[0, 1]`:

```text
[[15, 4],
 [ 3, 7]]
```

### Random Forest

| Split | Accuracy | Sensitivity | Specificity | Precision | F1 | ROC-AUC |
|---|---:|---:|---:|---:|---:|---:|
| Validation | 0.724 | 0.667 | 0.765 | 0.667 | 0.667 | 0.725 |
| Test | 0.724 | 0.700 | 0.737 | 0.583 | 0.636 | 0.847 |

95% Wilson intervals for the test accuracy, sensitivity, and specificity are
sampling-uncertainty intervals only: accuracy `[0.543, 0.853]`,
sensitivity `[0.397, 0.892]`, and specificity `[0.512, 0.882]`.

Test confusion matrix, labels `[0, 1]`:

```text
[[14, 5],
 [ 3, 7]]
```

These intervals quantify uncertainty in this small held-out sample; they do
not establish clinical validity. These results are exploratory only. They
must not be interpreted as clinical performance, calibrated probabilities, or
evidence that the model generalizes to MindScan users.

## Artifacts and commands

Artifacts are isolated under:

`artifacts/saturn-baseline-v0.1.0/`

They include:

- `logistic_regression.joblib`
- `random_forest.joblib`
- `metadata.json`
- `split_manifest.json`

`metadata.json` records SHA-256 hashes for the source CSV, training script,
feature schema, split manifest, and both model artifacts. The final run has
44 ordered raw features; Logistic Regression and Random Forest each receive
88 transformed columns because median imputation adds 44 missingness
indicators. The model artifacts remain isolated research outputs and are not
connected to live screening.

Reproduce the training run:

```powershell
.venv\Scripts\python.exe research-data\saturn_dryad_2025\train_saturn_baseline.py
```

Run artifact/inference checks:

```powershell
.venv\Scripts\python.exe -m unittest discover -s research-data\saturn_dryad_2025 -p "test_*.py" -v
```

No live API, frontend, database, production model configuration, deployment, or
voice analysis pipeline was changed.
