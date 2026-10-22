# Research model pipeline

## Current status

The runtime model service is connected to the report path but returns an explicit unavailable response until a versioned, compatible model bundle is configured. Existing `model.pkl`/`preprocessor.pkl` artifacts use a different format and are not loaded. The local tabular metadata contains target-leakage concerns; the local data has no verified provenance manifest. It has not been used for a new training run.

The runtime accepts only features derived on the server from a participant's saved assessment responses. It does not accept caller-supplied demographic or MRI values. The trainer limits feature columns to one modality and an allowlist in `model_contract.py`; the API serves one configured modality/model only, not probability fusion.

## Training

Use a dedicated Python environment with dependencies from `requirements-training.txt`. The `.venv` used for Python tests already has these packages; the audio-only `.venv-audio` does not.

The transcription endpoint uses `faster-whisper` from `.venv-audio` when that directory exists. To recreate that environment, install `Backend/ml/requirements-audio.txt` into a dedicated environment and set `PYTHON_EXECUTABLE` to its interpreter if it is not at the default path.

Training requires an authorized CSV, matching provenance manifest and checksum, explicit participant grouping, target labels, one modality, supported feature names, a unique model version, and a new output directory. It trains Logistic Regression and Random Forest pipelines. Each imputer, encoder, and scaler is fitted within the training partition; a participant-grouped holdout is kept untouched for evaluation. No synthetic clinical records or local dataset defaults are used.

Do not run on project-local data until its exact release, permissions, target definition, and participant grouping have been verified.

```powershell
python Backend/ml/train_model.py `
  --data "C:\approved-data\features.csv" `
  --provenance "C:\approved-data\provenance.json" `
  --target "verified_label" `
  --labels "label_a,label_b" `
  --group "participant_id" `
  --modality cognitive_tasks `
  --features "memory_recall_count,memory_presented_count" `
  --version 0.1.0 `
  --output "C:\approved-models\0.1.0"
```

Feature names must be in [the data dictionary](../../docs/data-dictionary.md). The test fixture model is not an application model and must never be copied to the production artifact directory.

## Serving

The authenticated `POST /api/ml/predict` endpoint accepts only `{ "screeningId": 123 }`. It reads the caller-owned assessment's saved task responses, derives approved numeric features, and invokes `predict.py` through a bounded Python subprocess with JSON on stdin. Configure `MINDSCAN_MODEL_DIR`, `MINDSCAN_MODEL_VERSION`, and optionally `MINDSCAN_MODEL_NAME`; leave version unset to keep inference unavailable. The configured directory must contain `metadata.json` and hash-matching model files from the guarded trainer.

Inference returns `available_research_only` with a class label and **uncalibrated class scores**, never a clinical risk score or calibrated probability. Missing models/features, incompatible schemas/versions, invalid measurements, and timeouts produce explicit unavailable/invalid-input responses. The assessment report stores the model response with existing result JSON and history shows its status/version.

Joblib/pickle artifacts can execute code when loaded. Only load trusted artifacts generated and reviewed by the project team; artifact hashes detect accidental/tampered weights but do not establish artifact trust or dataset authorization.

## Speech feature extraction

`transcript_analysis.py` applies deterministic, literal rules to the actual successful transcript. It reports word and sentence counts, average words per sentence, configurable whole-word English filler counts, adjacent repeated words, adjacent repeated short phrases (2–4 tokens), unique-word ratio, and counts of selected self-correction markers and vague expressions. Empty transcripts, transcripts shorter than five tokens, failed transcription, and non-English language are explicit states; the English-specific counts are unavailable rather than zero for other languages. Counts are observations only: no threshold, impairment score, classifier, or diagnosis is applied. The known prompt is picture description, but no semantic relevance or picture-detail comparison is performed.

The voice-task page shows the transcript and observations while the task is open. The saved assessment retains the literal observation counts and language, but not the transcript text or raw recording. The report states this distinction. ASR may omit or alter words, and the English-specific rules may be unreliable for other languages, accents, dialects, and speech styles.

Separately, `speech_features.py` derives transcript token/character counts, timed speaking duration, speech rate when at least two seconds of valid speech are present, and observed positive inter-segment pause gaps. It also reports an estimated non-speech ratio from ASR segment timing, adjacent repeated words, explicit English fillers, lexical diversity, and mean sentence length from punctuation-delimited sentences. Timing-based rate/pause measures are available only when valid Whisper segment timestamps and audio duration are present; transcript-only analysis does not infer them. The ratio is not a waveform-energy silence measurement; it can include pauses, noise, and omitted speech. Sentence segmentation and lexical diversity are language-dependent descriptive measures, not validated biomarkers. Pitch statistics remain unavailable because no acoustic pitch extractor is installed.

Pitch and other acoustic features are explicitly unavailable in the live transcription path. Do not treat acoustic means from the older offline corpus report as interchangeable with these transcript/timing features. The local audio feature export has 131 rows from 84 parent-folder group keys, but all 131 target values are missing; these folder keys are not independently verified participant identifiers. The current audio directory has 132 WAV files, so the old export is not a complete/current index. No verified participant-level diagnosis linkage or suitable supervised training data is present locally.

### Candidate research corpus and access blocker

The official [DementiaBank Pitt corpus page](https://talkbank.org/dementia/access/English/Pitt.html) describes audio, longitudinal data, Cookie Theft picture descriptions, and 104 controls, 208 dementia participants, and 85 participants with unknown diagnosis. It gives a DOI, corpus citation requirements, grant acknowledgements, and notes that transcript headers contain diagnostic/participant metadata. Those counts are corpus-level descriptions, not an audit of files available to this project.

The [TalkBank access policy](https://talkbank.org/0share/access.html) classifies DementiaBank as approved access for academic researchers with a verified university/research-lab position and agreement to its [Ground Rules](https://talkbank.org/0share/rules.html). Password-protected clinical-bank use is restricted to faculty; students must obtain access through their faculty advisor. To proceed, an eligible faculty researcher/advisor must register for TalkBank, read the Ground Rules and Code of Ethics, then request DementiaBank membership by emailing `talkbank@cmu.edu` with contact details, affiliation, and a brief research-use statement. Do not download the Pitt media or transcripts until access is approved. The rules also require corpus citation and grant acknowledgement, restrict non-commercial use, and prohibit sharing password-protected data outside authorized users. Verify any institutional IRB/ethics obligations with the responsible research team.

ADReSS/ADReSSo materials were not downloaded or treated as public/open; obtain them only through their current official challenge/data-owner access process and documented terms. No successful approval, access credentials, or license allowing this project's acquisition is currently on record.

### Audio-model training after authorized access

The existing `train_model.py` also supports the `speech` modality. Prepare one audited row per participant/session from authorized recordings using the same `speech_features.py` extraction and the `voice_*` feature names in `model_contract.py`. Include an independently verified participant/group column and documented label column; exclude unknown diagnosis, IDs from the feature list, and labels inferred from folder names or transcripts. Keep the CSV and authorization manifest private. The manifest must identify the dataset/release/source, `license_or_agreement`, authorization reference, a specific `model_use_permission` scope, and matching CSV SHA-256. Set `authorization_confirmed` and `model_training_and_inference_authorized` only after a responsible person verifies the source terms cover the intended training and local inference. These booleans are operator attestations, not independent permission checks; do not rely on the hosting platform's license label alone. The saved bundle records target definition, feature-extractor version, train-only preprocessing, software versions, split counts, validation selection, held-out metrics, and model checksums.

```powershell
& ".\.venv\Scripts\python.exe" Backend\ml\train_model.py `
  --data "C:\approved-private-data\audio_features.csv" `
  --provenance "C:\approved-private-data\provenance.json" `
  --target verified_label `
  --labels "control,dementia" `
  --group participant_key `
  --modality speech `
  --features "voice_audio_duration_seconds,voice_speaking_duration_seconds,voice_transcript_word_count,voice_transcript_character_count,voice_speech_rate_words_per_minute,voice_pause_count,voice_mean_pause_seconds,voice_maximum_pause_seconds,voice_estimated_non_speech_ratio,voice_filler_word_count,voice_adjacent_repeated_word_count,voice_lexical_diversity,voice_mean_sentence_length_words" `
  --version 0.1.0 `
  --output "C:\approved-models\mindscan-audio\0.1.0"
```

The updated trainer makes participant-disjoint train/validation/test partitions, uses validation balanced accuracy only for baseline selection, fits preprocessing and models on the training partition, and reports held-out test balanced accuracy, macro precision/recall/F1, confusion matrix, and binary ROC-AUC/PR-AUC when appropriate. Logistic Regression and Random Forest are both compared. Very small or imbalanced datasets may fail the minimum class-coverage requirements; do not relax these by splitting recordings from the same participant across partitions.

For opt-in runtime inference, set `MINDSCAN_AUDIO_MODEL_DIR`, `MINDSCAN_AUDIO_MODEL_VERSION`, and optionally `MINDSCAN_AUDIO_MODEL_NAME` (`logistic_regression` or `random_forest`) in the backend environment. The audio pipeline invokes the shared checksum-checked inference contract; absent, old-format, incompatible, or invalid artifacts return `classifier unavailable`. The trained class label is shown only as a research result. No speech model is currently trained or available.

## Test commands

```powershell
python -m unittest Backend.ml.test_train_model Backend.ml.test_predict Backend.ml.test_speech_features Backend.ml.test_dataset_tools Backend.ml.test_data_audit
```

Tests use a small, non-clinical in-memory fixture solely to train and load a real test artifact. It does not use or create synthetic patient, clinical, or MRI records. Downloader and audit tests use temporary fixtures and do not access external datasets or project-local participant data.

## Aggregate data audit

`data_audit.py` requires an explicit CSV, target, participant key, private output path, and provenance manifest with authorization attestation and matching SHA-256. It reports aggregate schema/missingness/duplicate/participant/session/label counts only; it does not enumerate audio files or emit participant IDs or row values. The manifest field is an operator attestation, not an independent authorization check. Do not run it on project-local data until its source and access basis are verified.

```powershell
python Backend/ml/data_audit.py `
  --data "C:\approved-private-data\features.csv" `
  --provenance "C:\approved-private-data\provenance.json" `
  --target "verified_label" `
  --participant "participant_key" `
  --session "visit_key" `
  --output "C:\approved-private-data\audit-report.json"
```
