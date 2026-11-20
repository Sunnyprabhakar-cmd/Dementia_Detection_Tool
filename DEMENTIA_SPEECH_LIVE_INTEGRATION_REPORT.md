# Stage 10.4 — Live Speech Model Integration & Verification Report

**Date:** 2026-11-20  
**Status:** Integrated & Verified End-to-End

---

## 1. Architecture Integration

1. **Python Inference (`Backend/ml/audio_classifier.py`):**
   - Added `classify_acoustic_poc(speech_intelligence, artifact_directory=..., model_name=...)`.
   - Enforces:
     - `metadata.json` schema & `modality == "speech_acoustic_poc"` check
     - SHA-256 verification of `.joblib` model file
     - English-only gating (`language == "en"`)
     - Audio reliability gating (`quality_reliable is True`)
     - Finite-value validation for all 44 `ACOUSTIC_FEATURE_COLS` (never fabricates missing features)
   - Installed `scikit-learn==1.9.1` and `joblib==1.6.0` in `.venv-audio` so `transcribe_audio.py` runs `classify_acoustic_poc` directly.
2. **Audio Pipeline (`Backend/ml/transcribe_audio.py`):**
   - Decodes non-WAV browser recordings (`.webm`, `.ogg`, `.mp3`, `.m4a`) to temporary 16 kHz mono WAV via PyAV so `extract_speech_intelligence()` extracts all 44 acoustic features for any uploaded format, then cleans up the temp WAV.
   - Attaches `acoustic_classifier_poc` alongside existing `classifier` (preserving existing Stage 6/10 contracts).
3. **Backend API (`Backend/controller/audioAgentController.js`):**
   - Exposes `acoustic_classifier_poc` in `POST /api/audio/upload` responses.
4. **Frontend UI (`Frontend/src/components/VoiceTask.jsx`):**
   - Displays `"Experimental speech-based research screening output — not a clinical diagnosis"` with predicted label, uncalibrated class scores, model version (`dementianet-acoustic-v1.0.0`), dataset (`DementiaNet`), and limitations.

---

## 2. Live End-to-End Verification

- **Real WAV Test (`AlPacino_1.wav`, 28.0 s, 44.1 kHz) via `.venv-audio\Scripts\python.exe Backend/ml/transcribe_audio.py`:**
  - `faster-whisper-base` transcribed `94` words (`language: "en"`, `language_probability: 0.981`)
  - `extract_speech_intelligence` extracted all `44` acoustic features (`quality_reliable: true`, `pitch_mean_hz: 184.38 Hz`, `estimated_snr_db: 20.26 dB`)
  - `acoustic_classifier_poc` returned:
    - `status: "available_experimental_poc"`
    - `model_version: "dementianet-acoustic-v1.0.0"`
    - `model_name: "logistic_regression"`
    - `predicted_label: "nodementia"` (`nodementia: 0.696983`, `dementia: 0.303017`, `scores_are_calibrated_probabilities: false`)
