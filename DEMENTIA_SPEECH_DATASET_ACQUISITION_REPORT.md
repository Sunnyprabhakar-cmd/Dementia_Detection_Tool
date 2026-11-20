# Stage 10.4 — Dementia Speech Dataset Acquisition Report

**Date:** 2026-11-20  
**Dataset:** DementiaNet (`https://github.com/shreyasgite/dementianet`)  
**Local Storage (Gitignored):** `research-data/dementianet/raw/`

---

## 1. Acquisition Summary

- **Download Method:** `gdown` (`6.5.2`) from the public Google Drive folders linked in the DementiaNet repository.
- **Downloaded Audio Files:**
  - `nodementia/`: `324` WAV recordings
  - `dementia/`: `130` WAV recordings (`1` file `galesayers_5_1.wav` failed transient Google Drive download)
  - **Total downloaded WAVs:** `454`

---

## 2. Post-Download Audio Audit (`extract_dementianet_features`)

- **Valid decoded recordings (`>= 0.5s`):** `453`
- **Corrupt or silent skipped:** `1`
- **Duplicate audio hashes skipped:** `0`
- **Unique speakers (`speaker_hash`):** `214`
- **Class distribution:** `nodementia: 324` (`71.5%`), `dementia: 129` (`28.5%`)
- **Sample rates:** `44100 Hz` (`453/453` recordings)
- **Cached Feature Matrix:** `research-data/dementianet/extracted_features.csv` (`453` rows × `44` acoustic features + speaker/label metadata)
