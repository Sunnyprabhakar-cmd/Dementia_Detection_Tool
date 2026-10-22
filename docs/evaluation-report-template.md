# Research model evaluation report

> Status: draft template. Do not report model performance until an authorized dataset has been independently checked and the evaluation has been run.

## Run identification

- Model version:
- Model family (Logistic Regression / Random Forest):
- Modality:
- Training timestamp (UTC):
- Code revision:
- Python / NumPy / pandas / scikit-learn versions:

## Data provenance and authorization

- Dataset name and exact release/accession:
- Official source URL:
- Authorization basis / institutional approval reference:
- Dataset checksum (SHA-256):
- Data steward and access expiry, if applicable:
- Inclusion/exclusion and deduplication rules:
- Label definitions, source, adjudication, and missing-label handling:
- Participant/group identifier used for split (never publish identifiers):

## Feature specification

- Feature names and definitions (see [data dictionary](./data-dictionary.md)):
- Modality:
- Excluded variables and leakage review:
- Missingness by feature and handling:
- Any transformations performed before split (must be none unless label-independent and justified):

## Evaluation design

- Split method and random seed:
- Participant counts and observation counts by split:
- Confirmation that no participant appears in more than one split:
- Confirmation preprocessing was fit on training data only:
- Confirmation test labels were not used for model selection:
- External validation cohort (if available):

## Results

- Per-class precision / recall / F1 / support:
- Confusion matrix:
- Accuracy and weighted F1:
- Calibration method/assessment (if any):
- Subgroup performance and uncertainty intervals:
- Threshold selection rationale (if any):

## Limitations and decision

- Dataset representativeness and linkage limitations:
- Potential target/feature leakage:
- Missingness, measurement, language, device, and demographic limitations:
- Clinical and external validation status:
- Approved research use, if any:
- Decision: do not serve / research-only serving / other explicitly reviewed state:
- Reviewers and review date:
