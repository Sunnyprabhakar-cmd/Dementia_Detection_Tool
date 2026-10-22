# Architecture

## Request and storage flow

```text
React client
  ├── authenticated intake and task responses ──> Express API ──> PostgreSQL
  ├── optional audio upload (with consent) ─────> temporary server file ──> local transcription
  └── task/observation report <────────────────── Express API <────────── PostgreSQL
```

Authentication protects screening, result, and audio routes. Screening records are scoped to the authenticated account. Patient profile, response, and result writes are associated with a screening session; deleting an owned session deletes its dependent records through database foreign keys.

The profile captures consent and optional context. Memory, attention, orientation, and language responses are recorded as task responses. Voice, tapping, and clinician observations are optional and remain distinct from required digital tasks. The report presents available measurements and observations without deriving MMSE/CDR values or a dementia risk probability from task performance.

## API surface

- `/api/auth`: account registration and login.
- `/api/screening`: start, resume, retrieve, update profile, save response, retrieve result, and delete an owned assessment.
- `/api/results`: authenticated assessment history.
- `/api/audio/upload`: consent-driven audio upload and transcription. The original recording is temporary; reviewed transcript metadata and descriptive speech measurements are saved only if the participant elects to continue.
- `/api/audio/analysis`: returns unavailable; no dementia inference is made from audio.
- `/api/ai/analyze`: returns `503 unavailable`; the heuristic ensemble is not used.
- `/api/ml/predict`: authenticated request body is exactly `{ "screeningId": <positive integer> }`. The server loads that account-owned assessment, derives allowlisted features from its saved tasks, and calls the Python inference CLI. Caller-supplied feature data is rejected.

The Python inference CLI accepts JSON through stdin, reads a versioned `metadata.json` bundle, verifies model-file checksums and schema version, validates feature names/types/ranges/categories/missingness, and returns an explicit `unavailable` state when inputs or compatible artifacts are absent. Node applies a 10-second timeout, bounds output size, and does not log subprocess output or feature values. There is no separate Python HTTP server; the existing Express API and subprocess pattern are the smaller compatible integration.

## Persistence and measurement

PostgreSQL stores account credentials as password hashes, assessment sessions, task response JSON, result measurements, and the patient profile linked to a session. Raw voice recordings are not part of persistent assessment storage. The computed model response/status is stored in the existing `screening_results.task_scores` JSON object under a reserved `__modelOutput` key so report and history can show the same result without a schema migration.

Attention timing uses browser performance timing and is not calibrated across devices. Orientation uses the local assessment date and month names selected for the task; place is recorded but not scored. Tapping preserves raw event offsets and separates rejected rapid taps. Speech feature extraction reports transcript counts, speaking duration, rate only with sufficient timed speech, and observed pauses; it does not claim language-specific validity. These are exploratory measurements and should not be interpreted as validated cognitive, speech, or motor tests.

Training permits one modality per model. It offers Logistic Regression and Random Forest pipelines with preprocessing fit inside training folds, and a participant-grouped held-out partition. Scores from one holdout are research-only. Modality outputs are not averaged or fused; fusion requires separate matched, authorized participant-level data and its own evaluation.

### Deferred multimodal interface

A future fusion service must accept a versioned envelope with separate modality outputs, not raw concatenated scores:

```json
{
  "linkage": {
    "status": "verified_and_authorized",
    "manifest_sha256": "reviewed linkage manifest checksum"
  },
  "modalities": [
    {
      "modality": "cognitive_tasks",
      "model_version": "0.1.0",
      "label_schema": "reviewed-label-schema-id",
      "status": "available_research_only",
      "output": {}
    },
    {
      "modality": "speech",
      "model_version": "0.1.0",
      "label_schema": "reviewed-label-schema-id",
      "status": "available_research_only",
      "output": {}
    }
  ],
  "fusion_model_version": "separately-trained-version"
}
```

This envelope is a design contract only; there is no fusion endpoint or model. A future implementation must verify authorized participant-level linkage, compatible labels, modality-specific availability, and a separately trained/evaluated fusion artifact. It must reject mismatches and missing modalities rather than average model outputs.

## Deployment boundary

The default setup is for local development. Production deployment requires separate security, privacy, accessibility, clinical, and operational reviews. In particular, configure TLS, restrictive CORS, secret management, database access controls, retention and deletion procedures, backups, and incident response before handling real participant information.
