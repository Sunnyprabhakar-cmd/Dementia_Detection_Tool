# Research model card

## Current status

**No compatible authorized model is enabled or available for application inference.** The service reports unavailable unless an explicitly versioned, schema-compatible artifact is configured. Existing legacy pickle artifacts are incompatible with the current versioned contract and are not loaded. No model was trained on project-local data for this work.

## Intended use

There is no approved clinical intended use. The application is an educational/research prototype. A future compatible research artifact may return a class label and uncalibrated class scores for evaluation; this output must not be described as a diagnosis, clinical risk assessment, validated probability, triage recommendation, or treatment/eligibility recommendation.

## Data and evaluation status

- The local CSV's exact data source, release, and authorization are unverified. Its header includes `Group`, `MMSE`, and `CDR`; prior metadata indicates leakage risk when clinical scores are used as features to predict a cohort grouping.
- Legacy artifact metadata is not an independently reproducible evaluation and does not establish permitted data use or model compatibility.
- The current trainer requires explicit authorization/provenance attestation and checksum, labels, subject grouping, one supported modality, explicit features, and a new version/output directory. It fits preprocessing within the training partition and keeps a group-separated holdout.
- The current evaluation is a single participant-grouped holdout. There is no separate validation/test partition, external cohort evaluation, calibration analysis, uncertainty intervals, prospective study, subgroup review, or clinical validation.
- No compatible labeled and authorized multimodal participant cohort is established. Fusion remains disabled and outputs are not averaged.

## Input and safeguards

The live API derives its allowlisted features from the authenticated user's saved task responses; it does not accept caller-supplied feature vectors or demographic/MRI fields. Model bundle version, schema, input names/types/ranges/missingness, and file hashes are checked. Missing model/features, incompatible schema, and service failures remain explicit unavailable states in report/history.

Speech transcription is a separate service from any dementia-related inference. Transcript-derived counts and valid timing measurements are descriptive and may reflect ASR errors; they are not validated biomarkers.

## Known limitations and risks

- Dataset provenance, label construct validity, population representativeness, and potential residual leakage need independent review.
- Repeated measures require participant-level grouping. A grouped holdout alone does not demonstrate external generalization.
- Assessment tasks have device, language, education, accessibility, and measurement limitations; no clinical instrument equivalence is claimed.
- Uncalibrated scores are not probabilities and must not be used for individual clinical decisions.
- Joblib/pickle loading can execute code. Only load artifacts produced by a trusted, reviewed pipeline; checksums establish integrity, not trust or authorization.

## Re-evaluation and release criteria

Do not enable a model until a data steward verifies the exact authorized release and purpose; labels/features and leakage are reviewed; preprocessing and split code are reproducible; an untouched participant-separated test set and external validation are reported; calibration, uncertainty, subgroup performance, and missingness are assessed where appropriate; model card/evaluation records are reviewed; and product, privacy, security, ethics, and clinical governance approve the release.

See [model versioning](./model-versioning.md) and [evaluation report](./EVALUATION_REPORT.md).
