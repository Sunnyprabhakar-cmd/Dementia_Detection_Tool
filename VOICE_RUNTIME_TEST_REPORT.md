# Voice Runtime Test Report (`VOICE_RUNTIME_TEST_REPORT.md`)

**Date:** 2026-11-20

## Test Categories Executed
1. **Automated Unit Tests (Python, `71` total):** `66` passed, `5` skipped (`4` optional `faster-whisper` tests skipped because `.venv-audio` is not installed; `1` legacy `baseline_v1` test skipped), `0` failures.
2. **Automated Unit & HTTP-to-Python Integration Tests (Backend Node.js, `67` total):** `67/67` passed, `0` failures (includes `stage10_2VoiceE2E.test.js` exercising real `express` HTTP upload -> `createUploadAudioHandler` -> real Python `extract_speech_intelligence` subprocess -> `validateVoiceResponse`).
3. **Frontend Unit Tests & Production Build:** `12/12` passed; `vite build` (`29` modules, `230ms`, `0` errors).
4. **Live Database & Manual Browser Mic Tests:** Not executed (PostgreSQL credentials in `Backend/.env` unavailable; no interactive browser mic session in headless CLI).
