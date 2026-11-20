# Stage 16 — Final GitHub Commit & Push Report

**Date:** 2026-11-20  
**Project Directory:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`  
**Status:** **PUSHED & VERIFIED**

---

## 1. GitHub Repository & Commit Details

- **GitHub Repository URL:** `https://github.com/Sunnyprabhakar-cmd/Dementia_Detection_Tool.git`
- **Branch Name:** `main` (tracking `origin/main`, fast-forward from `161ccd4b8fa11e0cd54482694e49dbc0580e3cb6`, no force-push)
- **Main Deliverable Commit Hash:** `6fc5eff7d17d8b588993b839d21756a52f55f291`
- **Commit Message:** `Complete dementia detection platform with experimental MRI pipeline, scientific audits and viva documentation`
- **Files Committed:** `173 files changed, 13897 insertions(+), 1528 deletions(-)` — includes Stages 1–15 source code, migrations `000`–`006`, `Backend/ml/imaging/imaging_pipeline.py`, `Backend/ml/training/radiata_mri_pipeline.py`, `Backend/ml/test_radiata_mri_poc.py`, `README.md`, `DEMENTIA_DETECTION_TOOL_VIVA_GUIDE.pdf` (`38` pages), `STAGE14_1_FINAL_AUDIT_REPORT.md`, `STAGE14_2_AGE_CONFOUNDING_REPORT.md`, `STAGE15_DOCUMENTATION_UPDATE_REPORT.md`, and all model cards/reports.
- **Push Verification Result:**
  - `git status`: `On branch main`, `Your branch is up to date with 'origin/main'.`
  - `git ls-remote origin refs/heads/main` matched `6fc5eff7d17d8b588993b839d21756a52f55f291`.

---

## 2. Final Verification Tests Executed (Stage 16)

| Suite | Command | Result |
|---|---|---|
| **Backend Node Tests** | `npm --prefix Backend test` | **`75 / 75` passed** (`0` failures) |
| **Frontend Unit Tests** | `npm --prefix Frontend test` | **`16 / 16` passed** (`0` failures) |
| **Vite Production Build** | `npm --prefix Frontend run build` | **Passed** (`32` modules transformed in `276ms`, `0` errors) |
| **`.venv-audio` Audio & MRI PoC Tests** | `.\.venv-audio\Scripts\python.exe -m unittest Backend.ml.test_audio_validation Backend.ml.test_transcribe_audio Backend.ml.test_dementianet_poc Backend.ml.test_radiata_mri_poc` | **`17 / 17` passed** (`0` failures) |
| **Full Python ML Suite** | `python -m unittest discover -s Backend\ml -p "test_*.py"` | **`79` run: `74` passed, `5` skipped, `0` failures** |

---

## 3. Sensitive & Restricted Files Excluded (`.gitignore`)

Verified excluded before staging and confirmed absent from `git diff --cached`:
- `.env` and `.env.*` (only `.env.example` templates are tracked)
- `node_modules/`, `.venv*/`, `dist/`, `__pycache__/`
- `Backend/data/`, `Backend/storage/`, `Backend/uploads/` (local uploaded patient MRI/CT `.nii.gz` scans)
- `artifacts/models/` (local trained MRI `radiata-oasis-mri-v1.0.0` and speech `dementianet-acoustic-v1.0.0` weights)
- `research-data/radiata_mri/raw/`, `research-data/radiata_mri/manifest.csv`, `research-data/dementianet/raw/`
- `*.nii`, `*.nii.gz`, `*.dcm`, `*.pt`, `*.pkl`, `*.joblib`, `*.wav`, `*.webm`, `*.mp3`, `*.m4a`, `*.sqlite`, `*.db`, `*.tmp`, `*.log`, `*.zip`

---

## 4. Remaining Blockers

- **None** for Git commit/push.
- Operational/scientific caveats remain documented in `README.md`, `DEMENTIA_DETECTION_TOOL_VIVA_GUIDE.pdf`, `STAGE14_1_FINAL_AUDIT_REPORT.md`, and `STAGE14_2_AGE_CONFOUNDING_REPORT.md` (experimental non-diagnostic status, `~18.8`-year MRI age confounding, Brain CT AI inference unavailable, OASIS DUA obligations).
