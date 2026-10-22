# Model evaluation report

**Status: no authorized project model has been evaluated.** There are no valid model-performance results to report. Do not treat the test-only fixture or legacy artifact metadata as evaluation.

Use this report only after the dataset steward has confirmed the permitted use and an authorized analysis has run. Keep participant identifiers private.

## Run and artifact

- Dataset/release/accession:
- Authorization reference (non-secret):
- Dataset source and SHA-256:
- Model version and SHA-256:
- Code revision:
- Training timestamp (UTC):
- Python, pandas, NumPy, and scikit-learn versions:
- Modality and task:
- Label names, definitions, provenance, and adjudication:
- Intended research use and exclusions:

## Cohort and features

- Inclusion/exclusion rules:
- Participant count and observation count (aggregate only):
- Repeated-visit policy:
- Feature schema/version and definitions:
- Feature missingness and handling:
- Excluded identifiers, proxies, target-derived fields, and leakage review:
- Authorized modality-linkage basis, if relevant:

## Evaluation design

- Train/validation/test methodology:
- Participant/group key and split seed:
- Participants and observations in each split:
- Confirmation that participant groups are disjoint:
- Confirmation all learned preprocessing was fitted on training data only:
- Confirmation validation/test sets were not used for feature, threshold, or model selection:
- External validation source and authorization:
- Deviations from protocol:

## Results

Do not populate metrics without a recorded run and reproducible output.

- Per-class precision, recall, F1, support:
- Confusion matrix:
- Accuracy / balanced accuracy / macro and weighted F1:
- Sensitivity and specificity, with definitions and uncertainty:
- Calibration assessment and method (if any):
- Confidence intervals/uncertainty method:
- Subgroup performance and sample sizes:
- Missing-input and failure rates:

## Limitations and disposition

- Population, site, language, device, and selection limitations:
- Label and measurement limitations:
- Residual leakage concerns:
- Clinical/external validation status:
- Known failure modes:
- Reviewer and review date:
- Decision: unavailable / research-only / other reviewed state:
- Required follow-up:

## Current project disposition

No authorized dataset/model bundle, independent holdout results, or external evaluation are established. Therefore all model metrics above remain unreported and application inference remains unavailable unless a compatible artifact is reviewed and explicitly configured.
