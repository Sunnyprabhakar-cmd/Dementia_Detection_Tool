# Model card: automated screening models

## Status

**No compatible project model is available.** The current report asks the authenticated backend to evaluate the assessment's stored, allowlisted task/speech measurements. The service returns `503 unavailable` unless a compatible versioned bundle is configured. `/api/ai` remains unavailable. Legacy model files do not satisfy the versioned artifact contract and are not loaded.

## Intended use

There is no approved intended use for a dementia classifier in this application. A future compatible bundle may produce research-only class labels and uncalibrated class scores from one modality. Such output is not a diagnosis, clinical risk assessment, validated probability, triage recommendation, or basis for treatment or eligibility decisions.

## Data and model artifacts

Legacy saved artifacts and metadata exist in the repository, but no verified dataset release/accession, authorization record, independent evaluation, or deployment approval is established. Existing tabular metadata lists `MMSE` and `CDR` among input features while mapping a cohort group to the target. This raises a material target-leakage concern and is incompatible with inferring a patient diagnosis from the current digital tasks. The new training allowlist excludes these fields and restricts models to one supported modality.

The audio feature metadata describes unlabeled recordings and does not establish a validated subject-to-diagnosis mapping. No supervised audio diagnosis model or multimodal fusion is available.

## Safeguards and limitations

- Heuristic risk interpretation and unvalidated audio anomaly scores are disabled.
- Inference uses only features recomputed from authenticated saved assessment task responses; caller-provided features and profile/MRI values are rejected.
- Bundle schema/version, model checksum, feature names, types, ranges/categories, and missingness are checked before prediction.
- The report/history distinguish unavailable output from a model that actually ran.
- Training no longer generates synthetic patient rows or silently chooses a local dataset.
- The guarded training entry point requires explicit provenance/authorization attestation, checksum, explicit target labels, participant-grouped split, allowlisted feature selection, and immutable version.
- Logistic Regression and Random Forest are evaluated on a held-out participant-grouped split with preprocessing fit only on training data. Training creates research-only artifacts and does not run on the repository's current local data.
- Grouped holdout evaluation alone does not establish external validity, clinical validity, fairness, calibration, or absence of all leakage.
- Existing saved artifact metrics are not presented as evidence of performance; they are not revalidated by this change.
- No prospective study, external test cohort, subgroup analysis, calibration analysis, or clinical review has been performed.

Re-enable inference only after an authorized, documented data release and feature/label review; a leakage-resistant evaluation; independent external validation; clinical, privacy, and fairness review; and explicit product approval.
