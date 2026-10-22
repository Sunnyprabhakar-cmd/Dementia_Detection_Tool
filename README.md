# MindScan AI

MindScan AI is a research prototype for recording cognitive-task responses and optional voice, motor, and clinician-entered observations. It is not a medical device, diagnostic service, or substitute for professional assessment.

The application reports task measurements and observations separately. Automated risk interpretation and tabular model inference are disabled: the local dataset's exact release and permitted use have not been verified, and the existing model metadata includes clinician MMSE/CDR inputs that could leak diagnostic information.

## Current workflow

- Authenticated patient intake and resumable assessment sessions.
- Memory, attention, orientation, and language tasks.
- Optional voice recording with explicit consent and transcript review. Audio is processed temporarily; only allowlisted descriptive measurements are saved when the participant continues. The transcript and raw recording are not saved to the assessment.
- Optional exploratory tapping and separately recorded clinician observations.
- An assessment report and history that distinguish task measurements, transcription/features, optional observations, model status/version/evaluation state, missing inputs, and inference limitations.

Task measures are descriptive prototype measurements, not validated clinical scores. Voice transcription is not voice-based dementia classification. See [docs/architecture.md](./docs/architecture.md), [docs/privacy.md](./docs/privacy.md), [docs/MODEL_CARD.md](./docs/MODEL_CARD.md), and [docs/AI_IMPLEMENTATION_AUDIT.md](./docs/AI_IMPLEMENTATION_AUDIT.md).

## Components

- `Frontend/`: React + Vite client.
- `Backend/`: Express API, PostgreSQL persistence, and optional local transcription.
- `Backend/ml/`: guarded research training and inference pipeline. Training requires explicit authorized data, provenance manifest, labels, participant grouping, modality, allowlisted feature selection, and version. No dataset is trained automatically.
- `docs/`: architecture, data access, model status, testing, and privacy notes.

## Local development (Windows)

Prerequisites: Node.js 20.19+ or 22.12+, npm, PostgreSQL 15+ installed as a Windows service, and Python 3.11+ for the optional local ML/audio Python environments. Setup will not install PostgreSQL or bypass its administrator/password requirements.

From the repository root, run setup once:

```powershell
npm run setup
```

`setup.ps1` installs exactly from the existing Backend and Frontend lockfiles, preserves existing environment values, generates a missing local JWT secret without printing it, creates the configured database if the PostgreSQL account is authorized, applies repeatable SQL migrations, and checks the resulting schema. For a fresh PostgreSQL installation that requires a password, set `DB_PASSWORD` in `Backend/.env` before rerunning setup. Setup never drops a database, truncates data, resets users, or overwrites existing secrets. Existing `Backend/.env` and `Frontend/.env.local` values are retained.

Launch the API and frontend together:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173/`. The PostgreSQL-backed API health endpoint is `http://127.0.0.1:3001/api/health`; it returns HTTP 503 if the API cannot reach the database. Development settings are local-only and are not a production security configuration.

Optional Python packages are pinned in `Backend/ml/requirements-training.txt` and `Backend/ml/requirements-audio.txt`. Setup checks/installs the training environment and verifies the existing `.venv-audio` where available. To create the audio environment when absent:

```powershell
py -3.11 -m venv .venv-audio
& .\.venv-audio\Scripts\python.exe -m pip install -r Backend\ml\requirements-audio.txt
```

The app runs faster-whisper in offline mode and does not download model weights during an upload. The `base` model weights must already be cached. To explicitly populate that cache on a machine with internet access, run:

```powershell
& .\.venv-audio\Scripts\python.exe -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"
```

That command downloads the model only if it is not already cached. Speech uploads are decoded and checked for duration, silence, and malformed content before transcription. Temporary audio is removed after processing. Transcript analysis is deterministic and descriptive; it is not a speech classifier.

For optional research inference only, set `MINDSCAN_MODEL_DIR` to a reviewed compatible versioned bundle and `MINDSCAN_MODEL_VERSION` to its exact version. The current legacy tabular model is not compatible with the cognitive task features and is not enabled. Leave the model version unset to keep ML inference explicitly unavailable.

### Synthetic demo (no login or database required)

The demo endpoint is disabled unless both processes are explicitly started in development with demo opt-in. It serves only a deterministic in-memory fixture; it never creates a screening, writes task responses/history, records audio, or saves a model output. It is a UI/software-path demonstration, not a trained-model or speech-transcription demonstration.

In one PowerShell terminal, start the API:

```powershell
$env:NODE_ENV = "development"
$env:MINDSCAN_DEMO_MODE = "true"
$env:PORT = "3002"
npm --prefix Backend run dev
```

In another terminal, start Vite with its matching UI flag:

```powershell
$env:VITE_API_BASE_URL = "http://localhost:3002"
$env:VITE_MINDSCAN_DEMO_MODE = "true"
npm --prefix Frontend run dev
```

Open the Vite URL and select **Open simulated demo report** on the sign-in screen. The report shows synthetic task fixtures and server-derived feature extraction; the voice section explicitly states that no audio was recorded/transcribed. The API refuses to serve the demo outside `NODE_ENV=development`, and the button is absent unless the frontend flag is set. For the actual authenticated assessment, saved responses, and consent-based audio transcription workflow, use the normal database setup above.

## Validation

```powershell
npm run db:ensure
npm run db:migrate
npm test
npm run test:python
& .\.venv-audio\Scripts\python.exe -m unittest Backend.ml.test_audio_validation Backend.ml.test_transcribe_audio -v
npm --prefix Frontend test
npm --prefix Frontend run lint
npm --prefix Frontend run build
npm --prefix Backend test
```

`npm run test:python` runs the complete ML suite using `.venv`; audio-decoder tests are also run in `.venv-audio`, where PyAV is installed with faster-whisper. Backend unit tests use mocks for most database-dependent behavior; the end-to-end authenticated assessment/report/history flow must additionally be exercised against the configured local database. See [docs/testing.md](./docs/testing.md) for coverage and limitations.

### Optional authorized model training

There is currently no verified labeled dataset containing the app's task-derived features. Do not train from the legacy MRI/clinical table. If an authorized research dataset is later assembled from the same task definitions, with a genuinely observed independent outcome and participant identifiers, record its provenance and checksum and then run (replace the paths and column names with those in that approved dataset):

```powershell
& .\.venv\Scripts\python.exe Backend\ml\train_model.py `
  --data "C:\approved-data\mindscan_task_outcomes.csv" `
  --provenance "C:\approved-data\provenance.json" `
  --target "verified_outcome" `
  --labels "control,case" `
  --group "participant_id" `
  --modality cognitive_tasks `
  --features "memory_recall_count,memory_presented_count,attention_correct_count,attention_incorrect_count,attention_missed_count,attention_mean_reaction_time_ms,orientation_correct_count,orientation_scored_count,language_sentence_character_count,language_list_response_count" `
  --version "1.0.0" `
  --output "C:\approved-models\mindscan-cognitive\1.0.0"
```

The script compares Logistic Regression and Random Forest by participant-grouped validation balanced accuracy, evaluates the selected model on a separate held-out test partition, and saves the pipeline and metadata only when the dataset provenance is explicitly authorized. The authoritative ordered feature descriptions are in [Backend/ml/feature_schema.json](./Backend/ml/feature_schema.json); Python training/inference and the Express prediction API load the same file. Do not configure a model trained on a different feature contract.

## Research data and model status

No compatible cognitive classifier was trained. The ignored local `Backend/data/dementia_dataset.csv` was audited in aggregate: 373 rows, 15 columns, 150 subject IDs with 2–5 visits each, no duplicate full rows, and no duplicate subject/visit/label records. `Group` has 190 `Nondemented`, 146 `Demented`, and 37 `Converted` rows; no subject had conflicting `Group` labels. The CSV has 19 missing `SES` and 2 missing `MMSE` values. Its local artifact metadata maps `Converted` together with `Demented` as a positive label, but the exact release, label protocol, and reuse rights are unverified; no provenance manifest or license documentation was present alongside the file.

This table is not a dataset of MindScan memory, attention, orientation, or language-task responses. It contains MRI, demographic, and clinical fields, including `CDR` and `MMSE`; `CDR` is strongly associated with `Group` and must not be used as a predictor. No features from this table were used to train or configure live inference. An attempted run of the guarded trainer stopped because the required provenance manifest is absent. The older `artifacts/models/tabular/baseline_v1` remains incompatible with the app contract and is not enabled. Its stored historical metrics have not been reproduced and are not presented as evidence.

The single shared schema contains ten cognitive task features (`memory_recall_count`, `memory_presented_count`, `attention_correct_count`, `attention_incorrect_count`, `attention_missed_count`, `attention_mean_reaction_time_ms`, `orientation_correct_count`, `orientation_scored_count`, `language_sentence_character_count`, `language_list_response_count`) and thirteen transcript/audio-timing features documented in `Backend/ml/feature_schema.json`. The pipeline can use these for training only when there is authorized participant-level labeled data with those exact measurements. Until then, `/api/ml/predict` and reports show the explicit unavailable state; no score, probability, or prediction is fabricated.

The local speech engine was exercised with Windows-generated spoken test audio and the cached `faster-whisper-base` model; it returned an English transcript and deterministic transcript observations. That validates local synthesized speech transcription, not a human participant recording or clinical performance. No audio classifier is available. Rule-based speech observations and Whisper output are descriptive only. See [docs/DATASET_CANDIDATE_REVIEW.md](./docs/DATASET_CANDIDATE_REVIEW.md), [docs/DATASET_PROVENANCE.md](./docs/DATASET_PROVENANCE.md), [docs/MRI_PIPELINE.md](./docs/MRI_PIPELINE.md), and [docs/EVALUATION_REPORT.md](./docs/EVALUATION_REPORT.md) before obtaining or processing research data.
