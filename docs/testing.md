# Testing and validation

## Automated checks

From the repository root on Windows:

```powershell
npm --prefix Frontend test
npm --prefix Frontend run lint
npm --prefix Frontend run build
npm --prefix Backend test
```

The Python training, artifact-inference, and speech-feature tests can be run with an environment containing the packages in `Backend/ml/requirements-training.txt`:

```powershell
python -m unittest Backend.ml.test_train_model Backend.ml.test_predict Backend.ml.test_speech_features Backend.ml.test_dataset_tools Backend.ml.test_data_audit
```

The Python tests fit real Logistic Regression and Random Forest pipelines on a small, generated, non-clinical in-memory fixture solely to validate the bundle contract. They also test explicit labels, group separation, preprocessing pipelines, model loading/version/checksum validation, missing and invalid inputs, silence/short/invalid-transcript feature cases, explicit downloader authorization and checksum gates, exact MRI ID/session joins, duplicate/unmatched records, failed-processing status, and aggregate-only data audits that omit participant values. Fixtures are not clinical data, application models, or evidence of dementia model performance. Downloader tests use a fake response and do not access the network.

## Scope of tests

Backend JavaScript tests cover assessment validation, result-history ownership/idempotency through a mocked database, unavailable legacy audio inference, server-derived allowlisted features, and model-runner timeout/error behavior. Frontend tests cover transparent task measurements and consistent unavailable model status for report/history. Frontend lint/build check the React source and production bundle.

## Not verified

- No database migration was run for this change. The migration runner requires a database with `schema.sql` applied first.
- No end-to-end browser workflow, real microphone/device check, or audio transcription run was performed.
- No participant data was used for training or inference, and no dataset access terms were verified for the local files. The test fixture does not use participant data.
- Dataset audits were not run against project-local data because its source and authorization remain unverified.
- No clinical validation, subgroup/fairness analysis, calibration, external validation, or model reproducibility study was performed.

Passing these software checks does not validate clinical meaning, privacy compliance, or fitness for medical use.
