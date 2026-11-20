# Imaging Research Review — Stage 10 (`IMAGING_RESEARCH_REVIEW.md`)

**Date:** 2026-11-20  
**Scope:** Evaluation of structural MRI and brain CT datasets, access/licensing terms, preprocessing requirements, and model architectures.

---

## 1. Structural MRI Datasets

| Dataset | Participants & Modalities | Clinical Labels | Access & License | Known Limitations |
| --- | --- | --- | --- | --- |
| **OASIS-1** (`sites.wustl.edu/oasisbrains/`) | `416` subjects (ages 18–96), T1-weighted MRI (`100` mild–moderate AD + healthy controls) | CDR (`0`, `0.5`, `1`, `2`), MMSE, age, sex, SES | Free registration + OASIS Data Use Agreement (DUA) via XNAT/NITRC-IR; **non-commercial academic research**, no redistribution | Cross-sectional only; single scanner/site; defaced scans |
| **OASIS-2** | `150` older adults (ages 60–96), longitudinal T1w MRI across multiple visits | Longitudinal CDR, conversion status, MMSE | OASIS registration + DUA; non-commercial academic use | Must split strictly by subject ID across all visits |
| **OASIS-3** | `1,000+` participants (ages 42–95), longitudinal T1w/T2w/FLAIR/DTI + PET + FreeSurfer | Longitudinal CDR, clinical diagnosis, biomarkers | OASIS DUA (also mirrored on OpenNeuro under OASIS terms) | Large multi-GB download; requires strict session/subject grouping |
| **ADNI (1/2/3/4)** (`adni.loni.usc.edu`) | Multicenter longitudinal cohort (`CN`, `MCI`, `AD`), MRI + PET + CSF/blood + genetics | Clinical diagnosis (`CN`/`MCI`/`AD`), CDR, MMSE, ADAS-Cog | LONI IDA account + formal application + ADNI DUA | Multi-site scanner harmonization needed; no redistribution |

---

## 2. Brain CT Datasets (Evaluated Separately from MRI)

| Dataset | Modality & Size | Labels | Suitability for Dementia AI |
| --- | --- | --- | --- |
| **RSNA 2019 Brain CT Hemorrhage** | Multi-center head CT | Intracranial hemorrhage subtypes | **Not labelled for dementia/AD** (useful only for generic CT anatomy pretraining) |
| **Hospital / Institutional Low-Dose CT Cohorts** | Clinical head CT + EHR | Dementia / normal aging | Controlled institutional/IRB access only; not publicly downloadable |
| **Crowdsourced Kaggle "CT" Sets** | Mixed/unverified 2D slices | Unverified | **Rejected:** Often mislabel MRI slices as CT; lacks provenance and subject IDs |

**Conclusion for CT:** No legally accessible, properly labelled open-access brain CT dementia dataset exists. Therefore, Stage 10 implements **secure CT upload, DICOM/NIfTI validation, and metadata de-identification**, while keeping **CT AI inference explicitly unavailable** (and never routing CT scans into an MRI model).

---

## 3. MRI Model Architecture & Checkpoint Assessment
- **Pretrained Weights Check:** Public GitHub/HuggingFace MRI AD checkpoints lack standardized provenance, consistent skull-stripping/MNI-registration pipelines, or verified external validation.
- **Recommended Baseline:** A reproducible 3D CNN / volumetric feature baseline trained on **OASIS-1** (CN vs AD) with strict subject-level splits, age/sex confounder analysis, and saliency-map explainability (explicitly labelled non-diagnostic), **pending user OASIS DUA approval and download**.
