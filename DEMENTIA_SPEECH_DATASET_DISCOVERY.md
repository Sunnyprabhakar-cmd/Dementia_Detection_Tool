# Stage 10.4 — Dementia Speech Dataset Discovery Report

**Date:** 2026-11-20  
**Repository:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`  
**Objective:** Identify any genuinely accessible, legitimate dementia-related speech audio dataset for training an experimental speech-based proof-of-concept classifier without bypassing institutional DUAs or fabricating data.

---

## 1. Sources Searched

| Source | Candidate | Modality / Content | Access Status | Decision |
|---|---|---|---|---|
| **GitHub + Google Drive** | `shreyasgite/dementianet` (DementiaNet) | Public-figure YouTube interview WAV clips (`dementia` vs `nodementia`) + `train_dm.csv` / `valid_dm.csv` | **Accessible** (MIT code repo; Google Drive audio folder downloadable via `gdown`) | **Selected** for local experimental PoC training |
| **Hugging Face** | `RiniPL/Dementia_Dataset` | Image classification dataset (not speech audio) | Public | Rejected (wrong modality) |
| **Hugging Face** | `ayushhk/dementiacare_btp` | Tabular CSV metadata only (no audio files) | Public | Rejected (no audio) |
| **Hugging Face** | `cheulyop/dementiabank`, `MearaHe/dementiabank` | Unverified TalkBank/DementiaBank mirrors | Public mirror without TalkBank DUA | **Excluded** (must not bypass DementiaBank institutional DUA) |
| **DementiaBank / ADReSS / ADReSSo** | Official TalkBank corpora | Clinical Cookie Theft & neuropsychological recordings | Requires institutional DUA approval | Blocked for immediate training; remains the target for future clinical validation |

---

## 2. Selected Dataset Summary (`DementiaNet`)

- **Repository:** `https://github.com/shreyasgite/dementianet`
- **Published CSV Split Metadata Inspected:**
  - `train_dm.csv`: `227` rows, `116` unique speakers (`nodementia: 121`, `dementia: 106`)
  - `valid_dm.csv`: `48` rows, `25` unique speakers (`nodementia: 28`, `dementia: 20`)
  - Speaker overlap between `train_dm.csv` and `valid_dm.csv`: `0`
- **Label Nature (Important Limitation):** Weak biographical / public-figure labels (`dementia` vs `nodementia`), **not** standardized clinical diagnoses (no MMSE, MoCA, CDR, or neuropsychological battery scores).
- **Language:** English spontaneous interview speech only.
