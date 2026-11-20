# Stage 10.4 — Dementia Speech Dataset License & Usage Audit

**Date:** 2026-11-20  
**Dataset:** DementiaNet (`https://github.com/shreyasgite/dementianet`)

---

## 1. License & Provenance Assessment

| Component | License / Terms | Permitted Use in This Project | Prohibited / Restricted Actions |
|---|---|---|---|
| **DementiaNet GitHub repository code & CSV metadata** | MIT License | Local research, feature extraction, model training, evaluation | None beyond MIT attribution |
| **DementiaNet WAV audio clips** (`research-data/dementianet/raw/`) | Third-party YouTube public-figure interview audio | Local non-commercial research & proof-of-concept feature extraction only | **Do NOT commit, bundle, or redistribute raw audio clips** |
| **TalkBank / DementiaBank / ADReSS** | Institutional Data Use Agreement (DUA) | Not used in Stage 10.4; excluded mirrors (`cheulyop/dementiabank`, `MearaHe/dementiabank`) | Bypassing TalkBank DUA |

---

## 2. Repository Safeguards Implemented

1. **Raw Audio Excluded from Git:** `research-data/dementianet/.gitignore` ignores `raw/`, `*.wav`, `*.mp3`, `*.webm`, and `*.m4a` so third-party audio is never committed or redistributed.
2. **Derived Model Bundle Only:** Only trained scikit-learn pipelines and `metadata.json` (with SHA-256 checksums and explicit usage limitations) are stored under `artifacts/models/speech_poc/dementianet-acoustic-v1.0.0/`.
3. **Non-Diagnostic Labeling:** All API and UI outputs label the DementiaNet classifier as:  
   `"Experimental speech-based research screening output — not a clinical diagnosis."`
4. **Language & Quality Gating:** Because DementiaNet contains English interview speech only, `classify_acoustic_poc()` explicitly refuses to score non-English audio (`language != "en"`) or recordings with `quality_reliable != True`.
