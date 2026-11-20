# Test Report — MindScan AI (Through Stage 10.4)

**Date:** 2026-11-20

## 1. Frontend Build & Unit Tests
- **Production Build (`vite build`):** `29` modules transformed, built in `176ms` (0 errors).
- **Frontend Unit Tests (`Frontend/tests/assessmentUtils.test.js`):** `12/12` passed.

## 2. Backend Node.js Unit & HTTP Integration Tests
- **Total Tests:** `67` tests across `Backend/tests/*.test.js` (`67/67` passed, `0` failures).
- **Live Node / `.venv-audio` -> `faster-whisper-base` + `dementianet-acoustic-v1.0.0` E2E Check:** Passed on `AlPacino_1.wav` (`status: "success"`, `language: "en"`, `acoustic_classifier_poc.status: "available_experimental_poc"`, `predicted_label: "nodementia"`, `nodementia: 0.696983`, `dementia: 0.303017`).

## 3. Python Tests
- **`.venv-audio` Audio, Transcribe & DementiaNet PoC Tests:** `15/15` passed (`test_audio_validation.py` + `test_transcribe_audio.py` + `test_dementianet_poc.py`).
- **Full Python ML, Preprocessing, Speech, Drawing & Imaging Tests (`Backend/ml/test_*.py`):** `77` tests run, **`72` passed, `5` skipped, `0` failures** (including `6/6` in `test_dementianet_poc.py`).
- **Skipped:** `4` optional `faster-whisper` audio tests when run outside `.venv-audio` and `1` legacy artifact test (`test_legacy_model.py`, `artifacts/models/tabular/baseline_v1` absent).
- **Stage 6 Training Pipeline (`test_training_pipeline.py`):** Passed — verified Zenodo `13378346` loading (`N=283`), participant-level splitting, reproducible training, SHA-256 bundle generation, `infer_tabular.py` inference, live `predict.py` modality boundary rejection, and invalid/missing feature rejection.

## 4. Remaining Blockers
- **Live PostgreSQL Connection:** `DB_PASSWORD` (or `DATABASE_URL`) is not configured in `Backend/.env`, so live database migrations (`000`–`004`) and live end-to-end HTTP+DB browser tests are pending DB credentials.
