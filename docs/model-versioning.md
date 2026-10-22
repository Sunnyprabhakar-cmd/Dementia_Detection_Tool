# Model bundle versioning

## Version scheme

Use semantic `MAJOR.MINOR.PATCH` identifiers (for example, `0.1.0`) as immutable artifact directory names:

```text
artifacts/models/research/0.1.0/
  metadata.json
  logistic_regression.joblib
  random_forest.joblib
```

- **MAJOR**: incompatible feature schema, label definition, or modality contract.
- **MINOR**: new reviewed training data or model family with the same input/label contract.
- **PATCH**: reproducibility or packaging correction that does not change the model contract. Any changed weights still require a new immutable version.

Never overwrite a released directory. The trainer refuses an existing output path.

## Bundle contract

`metadata.json` records the bundle format/schema version, model version, modality, feature schema and ranges/categories, target labels, dataset provenance and checksum, training timestamp, training software versions, participant-group split, per-model holdout metrics, and model-file checksums.

At inference, the loader checks bundle/schema version, requested model version/name, modality and allowed feature names, required values/types/ranges/categories, and the weight-file checksum before loading. Legacy pickle files without this metadata contract are incompatible and are not loaded.

The Node service derives allowable numeric inputs from authenticated saved assessment responses, sends JSON over child-process stdin, enforces a timeout/output cap, and never logs transcript, features, audio, or subprocess stderr. It returns structured `unavailable` when no version is configured or the bundle/schema/inputs are missing or incompatible.

## Trust and release

Joblib artifacts are pickle-based and can execute code on load. Only load bundles generated and reviewed by a trusted operator. Checksums detect mismatch but do not prove authorization or trust when an attacker can modify both weights and metadata. Keep private/restricted training data, authorization materials, and model weights out of Git unless a separate license/access review explicitly permits distribution. Do not enable a model based only on a single holdout score.
