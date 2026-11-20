# Stage 10.5 — Final Demonstration Readiness Audit Report

**Date:** 2026-11-20  
**Repository:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`  
**Status:** Ready for Demo once `Backend/.env` (`DB_PASSWORD` / `DATABASE_URL` + `JWT_SECRET`) is configured; live browser microphone test remains pending DB login configuration.

---

## 1. Trained Model Verification (`artifacts/models/speech_poc/dementianet-acoustic-v1.0.0/`)

- **Bundle Files Present:** `logistic_regression.joblib`, `random_forest.joblib`, `metadata.json`.
- **Integrity & Loading:** Both `.joblib` files load as `sklearn.pipeline.Pipeline` objects and match their recorded SHA-256 checksums in `metadata.json` (`sha_match: True`).
- **Feature Schema & Ordering:** `44` features in `feature_schema` matching `ACOUSTIC_FEATURE_COLS` and `extract_acoustic_features()` in `Backend/ml/preprocessing/audio_preprocessing.py`.
- **Safety & Gating Verified (`test_dementianet_poc.py`, 6/6 passing):**
  - Missing/NaN features -> explicit `status: "unavailable"` without fabrication.
  - Non-English speech (`language != "en"`) -> explicit `status: "unavailable"` (`missing_inputs: ["english_speech_required"]`).
  - Unreliable audio (`quality_reliable !== True`) -> explicit `status: "unavailable"` (`missing_inputs: ["reliable_audio_quality"]`).
  - `scores_are_calibrated_probabilities` is always `false`.

---

## 2. Presentation Fixes (`Frontend/src/components/VoiceTask.jsx`)

Updated `VoiceTask.jsx` so the UI:
1. Clearly separates **Audio Quality**, **Speech Transcription**, **Acoustic Feature Analysis (Non-diagnostic)**, **Experimental Research Classifier Output**, and **Model Limitations & Disclaimer**.
2. Displays the required disclaimer verbatim:
   > *"Experimental speech-based research screening output. This system is not a diagnostic tool and cannot establish whether a person has dementia."*
3. Displays uncalibrated relative scores as decimal values (`0.374 · 0.626`), **not** percentages (`%`) or probabilities of dementia.
4. Adds a direct **Upload WAV / audio file** control alongside **Start recording** via a shared `processAudioBlob()` helper.

---

## 3. Dataset Transparency (`DementiaNet`)

- **Source:** `https://github.com/shreyasgite/dementianet` (MIT repo; third-party YouTube public-figure interview audio).
- **Counts:** `454` downloaded WAVs -> `453` valid (`>= 0.5s`, `44100 Hz`), `1` corrupt/silent skipped, `0` duplicate hashes; **`214` unique speakers**; **`nodementia: 324`**, **`dementia: 129`**.
- **Speaker-Disjoint Splits:** Train `271` (`128` speakers), Val `91` (`43` speakers), Test `91` (`43` speakers).
- **License & Restrictions:** Raw YouTube audio clips are strictly for local non-commercial research and are **not** committed or redistributed.
- **Confounders & Limitations:** Weak biographical labels (not clinical MMSE/MoCA/CDR diagnoses), heterogeneous YouTube studio/archival microphone/compression artifacts, age/speaking-context differences, class imbalance, and English-only coverage. **These recordings are NOT representative of the general clinical patient population.**

---

## 4. Security & Privacy Verification

- **Git Exclusion:** `.gitignore` excludes `.env`, `.env.*`, `artifacts/models/`, `*.joblib`, `*.wav`, `*.webm`, `*.mp3`, `*.m4a`; `research-data/dementianet/.gitignore` excludes `raw/` and all audio extensions.
- **Temp File Cleanup:** Verified `0` leftover `mindscan-audio-*` directories in `$env:TEMP` after live `POST /api/audio/upload`; `transcribe_audio.py` deletes temporary 16 kHz mono WAVs in `finally`.
- **Transcript Privacy:** `POST /api/audio/upload` returns transcripts transiently for display; saved screening responses persist only descriptive metrics and `quality_warnings`/`quality_reliable` (verified by `Backend/tests/`).
- **Auth & Upload Validation:** `POST /api/audio/upload` enforces JWT (`401` without valid `userId`), size limit (`12 MB`), and magic-byte audio signature checks.

---

## 5. Runtime & Verification Results

| Check | Outcome | Notes |
|---|---|---|
| **Backend Node Tests (`npm test`)** | **67/67 passed** | Includes auth, security, RBAC, PDF, and Stage 10.2 E2E |
| **Frontend Tests (`npm test`)** | **12/12 passed** | `assessmentUtils.test.js` |
| **Frontend Build (`vite build`)** | **Passed** | `29` modules transformed, `0` errors |
| **`.venv-audio` Audio & PoC Tests** | **15/15 passed** | `test_audio_validation`, `test_transcribe_audio`, `test_dementianet_poc` |
| **Full Python ML Suite** | **77 run: 72 passed, 5 skipped** | `4` optional `faster-whisper` outside `.venv-audio`, `1` legacy `baseline_v1` |
| **Live Backend -> Python -> Classifier (`AbeBurrows_5.wav`)** | **Passed (`HTTP 200`)** | `1122`-char English transcript, `53` acoustic keys, `quality_reliable: true`, `dementianet-acoustic-v1.0.0` returned `predicted_label: "dementia"` (`nodementia: 0.37367`, `dementia: 0.62633`, `scores_are_calibrated_probabilities: false`) |
| **Live Browser UI (`http://localhost:5173/`)** | **Partial (Auth Blocked by Missing `Backend/.env`)** | Frontend loaded cleanly (`HTTP 200`, `0` console/page errors). Login/Register returned PostgreSQL SASL error `client password must be a string` because `Backend/.env` (`DB_PASSWORD`/`DATABASE_URL`) is not configured; therefore **live browser microphone recording inside `VoiceTask.jsx` was NOT executed**. |
