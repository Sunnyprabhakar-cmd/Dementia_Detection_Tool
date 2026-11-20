# Dataset Catalog — MindScan AI

**Last Updated:** 2026-11-20  
**Policy:** No restricted datasets, unverified mirrors, or fabricated clinical records are used. All controlled-access datasets document their official approval procedure.

---

## 1. Acquired & Verified Open-Access Datasets

| Dataset | Source / DOI | License | Local Path | Size / Checksum | Contents & Compatibility |
| --- | --- | --- | --- | --- | --- |
| **Cognitive performance of older patients** | Zenodo Record `13378346` (`https://zenodo.org/records/13378346`) | `CC-BY-4.0` (Open) | `research-data/open_zenodo/zenodo_13378346_dataset.xlsx` | `61,372` bytes; MD5 `077a20882a9ecedcca4ca01f326dbd1d` (Verified) | `283` participant rows × `26` columns (`Sex`, `Age`, `Years of study`, `Clinical Diagnosis`, blood/metabolic biomarkers, `ADL`, `IADL`, `BERG`, `Stress`, `BMI`). Suitable for tabular preprocessing & baseline research classification; **not** compatible with live MindScan digital-task inference. |
| **Effect of neurological screening on early dementia detection in southern Italy** | Zenodo Record `5509808` (`https://zenodo.org/records/5509808`) | `CC-BY-4.0` (Open) | `research-data/open_zenodo/zenodo_5509808_dataset.xlsx` | `52,980` bytes; MD5 `fc0a6a1b34172c172e43bf06ad2cf1c9` (Verified) | `706` rows × `16` columns (`ID`, `ETA'`, `SESSO`, `TEST NEURO-PSICOLOGICI`, `EEG/PEA`, `ALTERAZIONE NEUROL (SI,NO)`, `follow-up`). Suitable for tabular cleaning/missingness/classification experiments; **not** compatible with live MindScan digital-task inference. |

---

## 2. Open-Access Datasets Requiring Browser Download / API Token

| Dataset | Source / DOI | License | Status | Notes |
| --- | --- | --- | --- | --- |
| **SATURN 2025 Retrospective Dataset** | Dryad `10.5061/dryad.j9kd51cq4` | `CC0-1.0` | Metadata & baseline scripts present in `research-data/saturn_dryad_2025/` | Dryad API v2 download endpoint returns `HTTP 401 Unauthorized` without a Dryad API token or interactive browser download. Once manually placed at `research-data/saturn_dryad_2025/downloaded/_SATURN_2025-04APR_06restructure_DEIDENTIFIED.csv` (expected SHA-256 `18f3c5523a8e22e10e4b7dec9d458142665f716b1ada1f4d7cea9babfc745168`), `train_saturn_baseline.py` reproduces the isolated SATURN baseline. |
| **SATURN 2020 Foundational Dataset** | Dryad `10.5061/dryad.02v6wwpzr` | `CC0-1.0` | Investigated | Same Dryad API v2 token/browser download requirement. |

---

## 3. Controlled-Access Clinical & Multimodal Datasets (Approval Required)

These datasets were **not** downloaded and no access controls were bypassed. Official procedures:

| Dataset | Modalities | Official Source | Required Access / Registration Procedure |
| --- | --- | --- | --- |
| **DementiaBank Pitt Corpus** | Spontaneous speech audio (Cookie Theft), transcripts, MMSE | `https://talkbank.org/dementia/access/English/Pitt.html` | Register for a TalkBank account, agree to TalkBank Ground Rules (`https://talkbank.org/0share/rules.html`), and email `talkbank@cmu.edu` with institutional affiliation and research plan (students must apply through a faculty advisor). |
| **ADReSS (2020) & ADReSSo (2021)** | Balanced age/gender speech audio & transcripts for AD detection | `https://dementia.talkbank.org/ADReSS-2020/` | Requires active DementiaBank / TalkBank membership and adherence to challenge data-use terms. |
| **OASIS-1 / OASIS-3** | Clinical tabular (CDR, MMSE, demographics) + MRI / derived volumetrics | `https://sites.wustl.edu/oasisbrains/home/access/` | Submit the OASIS Data Use Agreement (DUA) and apply through NITRC-IR; non-commercial academic use only, no third-party redistribution. |
| **NHATS Clock Drawing Dataset** | Scanned analog Clock Drawing Test (CDT) images + cognitive scores | `https://www.nhats.org` | Register as a researcher on the NHATS Data Portal and submit a data access application for sensitive/clock-drawing files. |
| **Framingham Heart Study (FHS)** | Digital/analog clock drawing + longitudinal cognitive & MRI data | BioLINCC / FHS Research Portal | Formal IRB/research proposal submission via NIH BioLINCC or FHS portal. |

---

## 4. Reusable Acquisition & Validation Tools

- `Backend/ml/dataset_acquisition.py`: Open-access Zenodo downloader with automatic MD5/SHA-256 verification and `.provenance.json` sidecar generation.
- `Backend/ml/download_authorized_dataset.py`: Checksum- and provenance-gated downloader for approved controlled-access manifests (`--dry-run` supported).
- `Backend/ml/data_audit.py`: Aggregate-only dataset auditor (missingness, duplicates, label counts).
