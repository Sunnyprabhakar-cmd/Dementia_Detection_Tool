# AI implementation audit

## Scope and conclusion

This audit records the implemented research-inference boundary and the evidence available in this repository. The project is an educational/research prototype, not a clinically validated diagnostic device. No compatible real-world model is enabled, and no new training on project-local data was performed.

## Existing flow and API contracts

| Input | Collection and storage | Derived processing | Report behavior |
|---|---|---|---|
| Memory, attention, orientation, and language tasks | React assessment screens submit task responses to authenticated Express screening routes; responses are persisted as task response JSON in PostgreSQL. | `Backend/services/mlService.js` derives only the allowlisted task measurements from server-stored responses. | Reports show observed descriptive measurements; they do not calculate a validated composite score, MMSE/CDR, diagnosis, or clinical probability. |
| Optional audio | Consent-gated upload goes through the audio route to temporary server-side processing. The faster-whisper path transcribes; the original recording is not intended to persist with the assessment. Transcript metadata and optional descriptive features may be saved when the participant elects to continue. | `Backend/ml/transcribe_audio.py` handles transcription; `Backend/ml/speech_features.py` derives transcript counts and valid timing-based duration/rate/pause measures. Transcription is not dementia inference. | Transcript, transcription state/provenance, and descriptive speech measures are distinct from model output. Audio anomaly scoring is disabled. |
| Tapping and clinician-entered observations | Raw task events and clinician observations are persisted separately from core digital-task responses. | They are not part of the configured model feature allowlist. | Remain observations; they are not fused into a diagnostic score. |
| Demographics and MRI fields | Optional profile context is stored with the assessment. Local data may also contain MRI-derived columns. | Caller-provided features are rejected. Profile, clinician, identifier, and MRI values are excluded from the live inference allowlist. No MRI image processor is implemented. | No fabricated demographic/MRI fields or model output are reported. |

### Runtime routes

- `POST /api/ml/predict` is authenticated and accepts only an owned `screeningId`; it rejects caller-provided model features.
- The Express service launches the Python inference CLI as a local subprocess. It uses a request timeout and output bound, and does not log the feature payload. There is no separate Python HTTP service.
- The Python CLI accepts a versioned bundle only, validates model/schema/feature compatibility, and returns explicit unavailable states when the model or required inputs are absent.
- The result response is persisted in the existing result JSON under `task_scores.__modelOutput`; report and history read that same state.
- Legacy `/api/ai` and audio anomaly routes remain unavailable/disabled for diagnostic inference.

## Data, artifacts, and dependencies observed

- The project-local tabular CSV header observed during the audit is `Subject ID,MRI ID,Group,Visit,MR Delay,M/F,Hand,Age,EDUC,SES,MMSE,CDR,eTIV,nWBV,ASF`. No participant rows were inspected. Its exact source, release, authorization, and permitted use are unverified. It must not be represented as verified OASIS-1.
- Existing local metadata describes an “OASIS-style” cohort and includes MMSE/CDR among model inputs, creating target leakage concerns. Legacy `model.pkl`/`preprocessor.pkl` files do not conform to the new versioned bundle contract; their mere presence is not evidence of a suitable trained model.
- Prior aggregate inventory observed one tabular CSV and 132 WAV plus 2 WEBM files; existing metadata elsewhere reports 131 audio files. This discrepancy has not been reconciled. File names, recording content, and participant rows were not opened as part of this audit.
- The workspace `.venv` was previously found to contain pandas, NumPy, scikit-learn, and joblib; the audio environment contains faster-whisper. Neuroimaging libraries such as nibabel and MRI-processing software were not confirmed. The Pylance-selected interpreter differs from the `.venv` used for earlier ML tests.
- Existing unit tests cover the versioned trainer, inference contract, speech feature extraction, Node service behavior, report/history availability, and frontend report utilities. The temporary fitted test bundle is a mechanics fixture only, not clinical data or evidence of performance.

## Dataset-source findings and access blockers

- Official OASIS-1 materials describe a cohort and link clinical spreadsheets and multiple MRI/FreeSurfer archive volumes. The official OASIS access page presents a Data Use Agreement, states that users and collaborators must follow its terms, and requires secure, access-controlled storage. An archive URL being reachable does not establish authorization.
- Candidate review found the Kaggle OASIS CSV pair is small (50,010 bytes by its file listing) and labeled CC0 by the uploader, but the OASIS agreement restricts redistribution absent prior written permission. The GitHub mirror has no license and explicitly points back to OASIS/Kaggle. Hugging Face image candidates either have no source/license evidence or are large derivative MRI collections that cannot supersede upstream terms. See [candidate source review](./DATASET_CANDIDATE_REVIEW.md).
- None of the candidates contains the current MindScan assessment feature vocabulary (saved memory/attention/orientation/language task measurements or the descriptive speech schema). Clinical scales/MRI measurements are not substitutes. Even if OASIS access is later approved, a model from those features cannot be connected to the current assessment inference route without a separately justified compatible cohort and feature set.
- DementiaBank/Pitt access is controlled; its official access pages direct researchers to the corpus-specific process and required forms/terms. No restricted corpus was accessed or downloaded.
- No local authorization reference, verified release/accession, checksummed dataset provenance record, matched-modality evidence, or compatible label definition was found in the evidence reviewed. Consequently, do not train, infer from the local legacy models, process raw participant data, or link modalities until those prerequisites are verified.
- See [dataset provenance](./DATASET_PROVENANCE.md) for the official access path and the gated download workflow.

## Implemented and deferred

Implemented:

- Group-aware, explicit-provenance training for Logistic Regression and Random Forest, with preprocessing fit inside the training partition and a held-out participant-group split.
- Versioned artifact metadata, hashes, feature allowlists, and explicit unavailable inference responses.
- Descriptive speech feature extraction that preserves missingness and separates transcription from model analysis.
- Authenticated Node-to-Python subprocess integration and report/history status propagation.
- A checksum- and authorization-gated resumable downloader, plus a safe join utility for precomputed MRI-derived features. Neither was used to download or process local data.

Deferred/blocking:

- No approved dataset or confirmed authorization, so no real training, evaluation metrics, or production model artifact exists.
- The trainer currently evaluates one participant-grouped held-out partition; it does not provide a separate train/validation/test design, external validation, calibration, or uncertainty analysis.
- No raw MRI ingestion/segmentation pipeline is implemented. The new MRI utility joins explicitly selected, precomputed numeric features by exact unique participant/session keys only.
- No authorized participant-level matched multimodal cohort and compatible labels exist; fusion is documentation-only and probabilities are never averaged.
- A model trained on an OASIS cohort is not automatically compatible with live assessment features or population. Serving remains unavailable without a reviewed compatible artifact.

## Verification boundary

The project’s prior implementation tests and frontend/backend build checks passed as recorded in the task session. This continuation adds focused tests for the download gate and MRI joins; their exact results are reported at delivery. No data acquisition, private-row inspection, model training on project data, database migration, commit, or push was performed.
