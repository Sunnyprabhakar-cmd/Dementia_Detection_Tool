# Stage 10.3 Live Voice Report (`STAGE10_3_LIVE_VOICE_REPORT.md`)

**Date:** 2026-11-20

---

## 1. `faster-whisper` Runtime Setup & Fixes
- **Environment:** Created `.venv-audio` (Python 3.14.7) and installed `faster-whisper==1.2.1`, `av==19.0.2`, `ctranslate2==4.9.0`, `onnxruntime==1.32.0`, `numpy==2.5.5`, and `scipy==1.18.1` (`Backend/ml/requirements-audio.txt`).
- **Runtime Bugs Found & Fixed:**
  1. `Backend/ml/preprocessing/__init__.py` eagerly imported `pandas`/`PIL`/`sklearn` submodules, causing `ModuleNotFoundError` in `.venv-audio`. **Fixed:** Made optional non-audio submodule imports lazy (`try/except ImportError`).
  2. `faster-whisper==1.2.1` calls `av.open(..., metadata_errors="ignore")`, which raises `TypeError` on `av==19.0.2`. **Fixed:** Added `_decode_audio_16k_mono()` fallback in `Backend/ml/transcribe_audio.py` using `av.AudioResampler(format="fltp", layout="mono", rate=16000)`.
- **Model & Storage:** Cached `Systran/faster-whisper-base` (~145 MB CTranslate2 int8 model).
- **Live Transcription Evidence:**
  - Command: `createUploadAudioHandler()` -> `.venv-audio` -> `transcribe_audio.py` on spoken WAV (`"The early morning sun is bright in our garden."`)
  - Result: **`HTTP 200`**, `status: "success"`, `transcript: "The early morning sun is bright in our garden."`, `language: "en"`, `language_probability: 0.9986`, `pitch_mean_hz: 161.0`, `quality_reliable: true`, `classifier: { status: "unavailable" }`, elapsed: `4.55s`.

## 2. Remaining Blockers
- **Hindi / Punjabi Live Audio:** No live Hindi/Punjabi spoken audio sample was tested against `faster-whisper`; multilingual transcript rules were verified via unit tests (`test_speech_pipeline.py`).
- **Live Browser Microphone & PostgreSQL:** Interactive browser microphone capture and live PostgreSQL persistence remain blocked pending `Backend/.env` credentials and manual browser session.
