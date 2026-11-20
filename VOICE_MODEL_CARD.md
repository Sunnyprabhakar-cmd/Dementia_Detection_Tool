# Voice Model Card — MindScan AI (`VOICE_MODEL_CARD.md`)

- **Model Status:** **No clinical dementia speech model deployed** (pipeline `Backend/ml/training/voice_pipeline.py` implemented and smoke-tested on non-clinical synthetic fixtures; real training blocked pending TalkBank ADReSSo/Pitt DUA approval).
- **Supported Languages Registry (`get_language_capabilities`):** `en`, `hi`, `pa` (Whisper transcription + per-language filler/fluency rules), `si`, `ta` (acoustic extraction only; linguistic rules unavailable). `dementia_inference_supported: false` for all languages.
- **Safety & Leakage Controls:** Speaker-level splits, silence-only control baseline (`silence_control`), train-only imputation/scaling, SHA-256 bundle contract.
