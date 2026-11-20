# Stage 10.1 Dataset Import Report (`STAGE10_1_DATASET_IMPORT_REPORT.md`)

**Date:** 2026-11-20  
**Importer:** `Backend/ml/training/voice_dataset_importer.py` (`import_voice_dataset_directory`)

---

## 1. Dataset Acquisition Audit
- **DementiaBank Pitt / ADReSS 2020 / ADReSSo 2021 / Delaware / TAUKADIAL:** Controlled-access corpora requiring TalkBank membership and institutional DUA approval (`talkbank@cmu.edu`).
- **EWA-DB (`10.5281/zenodo.10952480`):** Checked via Zenodo API (`access_right: restricted`, `files: []`) — requires formal access approval.
- **Cognitive Assessment Speech Dataset (`zenodo.23273755`):** Open record contains PDF paper only (`CogSpeech_ASR_ACM_Format_Revised.pdf`), not raw audio.

**Conclusion:** Zero labelled dementia speech audio corpora are legally downloadable without DUA approval. No unrelated or synthetic audio was substituted.

## 2. Reusable Importer Capabilities (Verified on Synthetic Fixtures)
- Validates WAV readability, duration, sample rate, silence, and clipping (`validate_wav_audio`).
- Extracts acoustic features (`extract_acoustic_features`), checks labels (`ALLOWED_LABELS`), hashes `participant_id` (`participant_hash`), detects duplicates, reports missing values per column, prevents path traversal, and writes `dataset_manifest.json` + SHA-256 checksums.
- Tested in `Backend/ml/test_stage10_1_importer.py` (`2/2` passed).
