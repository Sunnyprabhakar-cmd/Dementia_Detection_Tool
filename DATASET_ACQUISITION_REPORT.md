# Dataset Acquisition Report — Stage 10 (`DATASET_ACQUISITION_REPORT.md`)

**Date:** 2026-11-20

---

## 1. Legally Acquired Open-Access Datasets (Already Verified in Workspace)
- **Zenodo `13378346`** (*Cognitive performance of older patients*, `CC-BY-4.0`, `N=283`): `research-data/open_zenodo/zenodo_13378346_dataset.xlsx` (MD5 verified). Used for Stage 6 isolated clinical-tabular baseline.
- **Zenodo `5509808`** (*Neurological screening in southern Italy*, `CC-BY-4.0`, `N=705` participants + 1 summary row): `research-data/open_zenodo/zenodo_5509808_dataset.xlsx` (MD5 verified). Used for data-cleaning audit.

---

## 2. Controlled-Access Datasets (Blocked Pending User Approval)

| Modality | Dataset | Access Status | Blocker |
| --- | --- | --- | --- |
| **Voice** | ADReSS 2020 / ADReSSo 2021 / Pitt | **Not downloaded** | Requires TalkBank membership & DUA approval (`talkbank@cmu.edu`). |
| **MRI** | OASIS-1 / OASIS-2 / OASIS-3 / ADNI | **Not downloaded** | Requires OASIS/NITRC-IR or LONI IDA registration and DUA approval. |
| **CT** | Brain CT Dementia Cohorts | **Unavailable** | No open-access labelled brain CT dementia dataset exists. |

**Policy Compliance:** No restricted audio, MRI, or CT data was scraped or bypassed. All Stage 10 pipelines will be implemented cleanly, tested with clearly labelled synthetic fixtures, and will explicitly mark real clinical model training/inference as **blocked/unavailable** until authorized datasets are provided.
