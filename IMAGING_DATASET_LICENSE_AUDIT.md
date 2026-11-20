# Stage 14 — Brain Imaging Dataset License & Usage Audit

**Date:** 2026-11-20

---

## 1. License & Redistribution Audit

| Dataset / Subset | Original License | Permitted Use in This Repository | Restrictions Enforced |
|---|---|---|---|
| **`radiata-ai/brain-structure`** compilation | `ODC-By v1.0` | Local research training & evaluation of anonymized skull-stripped NIfTI volumes | Raw `.nii.gz` scans stored in gitignored `research-data/radiata_mri/raw/` — **never** committed or redistributed |
| **`OASIS-1` & `OASIS-2`** source volumes (inside Radiata) | OASIS Custom DUA (anonymized, PHI removed) | Non-commercial academic research; attribution to OASIS & Radiata | Do not redistribute raw OASIS volumes or claim clinical clearance |
| **OpenNeuro `ds007561`** | `CC0` (Public Domain) | Unrestricted research & test verification | Attribution to Bendlin, Johnson, Christian |
| **Brain CT** | No open dementia/AD CT dataset found | CT AI inference remains **explicitly disabled** (`status: "unavailable"`) | CT scans are never routed into MRI models |

---

## 2. Privacy & De-Identification Safeguards

1. `research-data/radiata_mri/.gitignore` ignores `raw/`, `*.nii`, `*.nii.gz`, `*.pt`, and `*.joblib`.
2. Participant identifiers are SHA-256 hashed (`participant_hash`) before splitting or saving manifests.
3. Live uploads in `Backend/ml/imaging/imaging_pipeline.py` validate NIfTI-1 / DICOM headers, strip/reject PII tags, and never share weights or predictions with cognitive or speech scoring.
