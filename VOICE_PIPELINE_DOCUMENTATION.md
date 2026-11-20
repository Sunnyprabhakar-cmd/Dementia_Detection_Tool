# Voice Pipeline Documentation — Stage 10 (`VOICE_PIPELINE_DOCUMENTATION.md`)

- **Structured Verbal Tasks (`Frontend/src/components/VoiceTask.jsx`):** `picture_description`, `semantic_fluency`, `phonemic_fluency` (English protocol), `spontaneous_speech`, `story_retelling`, `qa_verbal`.
- **Acoustic Features (`Backend/ml/preprocessing/audio_preprocessing.py`):** 13-band MFCCs (`mean`/`std`), F0 (`mean`, `median`, `std`, `min`, `max`, `range`), `jitter_local`, `shimmer_local`, `hnr_mean_db`, `voiced_unvoiced_ratio`, RMS energy, ZCR, spectral centroid/bandwidth/rolloff, waveform pauses, response latency, SNR, clipping ratio.
- **Linguistic & Registry (`Backend/ml/preprocessing/speech_features.py`):** `LANGUAGE_CAPABILITY_REGISTRY` (`en`, `hi`, `pa`, `si`, `ta`), separate per-language filler sets, low-confidence flags.
- **Comparison Pipeline (`Backend/ml/training/voice_pipeline.py`):** `acoustic_only`, `linguistic_only`, `combined`, `silence_control` across LR, RF, GB, SVM with speaker-grouped splits.
