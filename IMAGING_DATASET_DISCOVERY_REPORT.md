# Stage 14 — Brain MRI & CT Dataset Discovery Report

**Date:** 2026-11-20  
**Repository:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`

---

## 1. Candidate Datasets Evaluated

| Candidate | Source URL | Modality & Format | Participants / Scans | Labels | License / Terms | Decision |
|---|---|---|---|---|---|---|
| **`radiata-ai/brain-structure`** (`OASIS-1` & `OASIS-2` subset) | `https://huggingface.co/datasets/radiata-ai/brain-structure` | 3D Structural T1w MPRAGE MRI (`.nii.gz`, `113×137×113`, `1.5 mm³` MNI152) | Total: `2,607` participants / `3,794` scans.<br/>`OASIS-1` + `OASIS-2` subset: **`578` participants / `787` scans** | Clinical diagnoses: `cognitively_normal` (`522` scans / `400` subj) vs `Alzheimers_disease` (`265` scans / `178` subj) | Dataset: `ODC-By v1.0`; Source studies: OASIS-1 / OASIS-2 terms | **Selected** (real 3D NIfTI volumes, participant IDs, single OASIS scanner family) |
| **OpenNeuro `ds007561`** (*UCB-J PET and T1W Images for Synapse Project Cohort*) | `https://openneuro.org/datasets/ds007561` | 3D T1w MRI (`.nii.gz`) + PET | `20` participants / `20` T1w sessions | `Control` (`14`), `MCI` (`5`), `AD` (`1`) | `CC0` (Public Domain) | Used for sample 3D NIfTI validation testing only (too few `AD`/`MCI` cases for train/val/test) |
| **`Falah/Alzheimer_MRI`** | `https://huggingface.co/datasets/Falah/Alzheimer_MRI` | 2D MRI slices (Parquet) | `6,400` slices (`5,120` train / `1,280` test) | `Non_Demented`, `Very_Mild_Demented`, `Mild_Demented`, `Moderate_Demented` | `Apache-2.0` | **Rejected for training** (no participant IDs; high slice-level data leakage risk; 2D slices do not match 3D NIfTI pipeline) |
| **`kanaadlimaye/Alzheimers-Classification-Dataset`** | `https://huggingface.co/datasets/kanaadlimaye/Alzheimers-Classification-Dataset` | 2D MRI images | `10,880` images | Multi-class dementia stages | `CC-BY-4.0` | **Rejected** (2D slice derivative without participant-disjoint NIfTI metadata) |
| **Open Brain CT Cohorts** (RSNA ICH / Kaggle Hemorrhage) | Zenodo / Kaggle / Figshare | Brain CT | Various | Intracranial hemorrhage / acute trauma (NOT dementia) | Various | **Excluded** (CT lacks hippocampal soft-tissue contrast for dementia staging; hemorrhage CT cannot be labeled as dementia) |

---

## 2. Site-Confounder Prevention

In `radiata-ai/brain-structure`, `DLBS` (`315` scans), `IXI` (`409` scans), and `NKI-RS` (`2,283` scans) contain `cognitively_normal` participants **only** (mostly younger 3T scans), whereas all `265` `Alzheimers_disease` scans come from `OASIS-1` and `OASIS-2`. Including `DLBS`/`IXI`/`NKI-RS` as controls would allow a model to cheat by detecting scanner/site differences instead of brain structure. Therefore, **only `OASIS-1` and `OASIS-2` (`787` scans, `578` participants)** are used.
