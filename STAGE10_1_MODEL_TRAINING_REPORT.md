# Stage 10.1 Model Training Report (`STAGE10_1_MODEL_TRAINING_REPORT.md`)

**Date:** 2026-11-20

---

## 1. Training Status: Blocked Pending Authorized Speech Data
- **Real Clinical Training:** **Not executed** because no authorized, participant-labelled dementia speech audio dataset (ADReSSo / Pitt / EWA-DB) is present in the workspace.
- **Synthetic Data Policy:** Per project rules, no dementia classifier was trained on synthetic audio and no clinical accuracy is claimed.
- **Pipeline Readiness:** `Backend/ml/training/voice_pipeline.py` (LR, RF, GB, SVM + `silence_control` with speaker-grouped CV, Wilson CIs, PR-AUC, ROC-AUC, Brier calibration) is verified via synthetic smoke tests (`test_stage10_voice_and_imaging.py`).
- **Live Inference Status:** `audio_classifier.py` and `VoiceTask.jsx` explicitly report `unavailable` (`dementia_inference_supported: false` across `en`, `hi`, `pa`, `si`, `ta`).
