# Dataset Access Guide — Stage 10 (`DATASET_ACCESS_GUIDE.md`)

**Date:** 2026-11-20

This guide documents the exact **legal, non-bypassable** access procedures for controlled-access voice and neuroimaging datasets requiring the user's personal registration or institutional approval.

---

## 1. TalkBank / DementiaBank (Pitt Corpus, ADReSS 2020, ADReSSo 2021, Delaware)
1. Register at `https://dementia.talkbank.org/` using an institutional email address.
2. Read and agree to the TalkBank Ground Rules (`https://talkbank.org/0share/rules.html`).
3. **Faculty / PI:** Email `talkbank@cmu.edu` with your affiliation, profile link, and research plan.  
   **Students:** Your faculty advisor must email `talkbank@cmu.edu` on your behalf, taking responsibility and specifying access dates.
4. Once approved, place downloaded files in a private directory outside Git (e.g., `Backend/data/raw/adresso21/`) and generate a manifest with `Backend/ml/download_authorized_dataset.py`.

---

## 2. OASIS-1 / OASIS-2 / OASIS-3 (Structural MRI)
1. Visit `https://sites.wustl.edu/oasisbrains/home/access/` and review the OASIS Data Use Agreement (DUA).
2. Register on NITRC-IR / XNAT Central (`central.xnat.org`) and submit the OASIS access application.
3. Once approved, download the OASIS-1 clinical CSV and NIfTI/Analyze volumes into `Backend/data/raw/oasis1/` (gitignored).

---

## 3. ADNI (Multicenter MRI/PET/Biomarkers)
1. Create a LONI Image & Data Archive (IDA) account at `https://adni.loni.usc.edu/data-samples/adni-data/`.
2. Submit an online research application and sign the ADNI Data Use Agreement.

---

## 4. Brain CT Dementia Cohorts
- No open-access labelled brain CT dementia dataset is publicly available. Institutional IRB approval or a formal data-transfer agreement (e.g., NHS Scotland / hospital PACS de-identified export) is required before training any CT model.
