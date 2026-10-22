# Dataset provenance and access

## Current provenance status

No project-local research dataset has verified source/release, authorization, license/terms, and participant-level linkage in an approved provenance record. The local CSV header is consistent with repeated-visit clinical and MRI-derived fields, but does not prove OASIS provenance. Do not use this local data for training or inference until a responsible data steward confirms the exact source and permitted purpose.

No external dataset was downloaded in this work. Do not put restricted data, access credentials, participant identifiers, private approval records, or transcripts in Git.

The candidate-source review for Kaggle, GitHub, and Hugging Face alternatives is in [DATASET_CANDIDATE_REVIEW.md](./DATASET_CANDIDATE_REVIEW.md). The platforms' metadata does not establish permission to redistribute underlying OASIS data; none of the reviewed candidates is approved for acquisition or training here.

## Official access paths

### OASIS

Start with the [OASIS project site](https://sites.wustl.edu/oasisbrains/), select the exact release, and review that release's [Data Use Agreement and access process](https://sites.wustl.edu/oasisbrains/home/access/). The OASIS-1 page describes clinical spreadsheets and multiple MRI/FreeSurfer archive volumes; exact files and terms must be confirmed on the official release page before acquisition. The official agreement restricts OASIS to non-commercial academic research, requires secure access-controlled storage, prohibits sharing/distribution to third parties without prior written permission, and requires acknowledgment/citation. The OASIS site says access is hosted through NITRC-IR and applications are reviewed. Complete the official request/approval steps and preserve the approved reference before downloading. A Kaggle CC0 label or other mirror license does not itself prove the uploader could relicense OASIS data.

Do not assume OASIS-1, OASIS-3, and OASIS-4 share release terms, labels, modalities, or identifier conventions. Do not start an archive download just because a URL is reachable.

### DementiaBank / Pitt

The official [Pitt corpus page](https://talkbank.org/dementia/access/English/Pitt.html) documents longitudinal audio and picture-description data, with 104 controls, 208 dementia participants, and 85 participants whose diagnosis is unknown. It also lists corpus citations, grant acknowledgements, and diagnostic information in transcript metadata. These are source-reported corpus counts, not counts of data acquired by this project.

The [TalkBank access policy](https://talkbank.org/0share/access.html) says DementiaBank clinical data require approved access for eligible academic researchers with a verified university/research-lab position and agreement to the [Ground Rules](https://talkbank.org/0share/rules.html). An eligible faculty researcher/advisor must register for TalkBank, read the Ground Rules and Code of Ethics, then email `talkbank@cmu.edu` with contact details, affiliation, and a brief research plan to request access. Students must request access through a faculty advisor, who is responsible for their access and defined access dates. The Pitt page's download link does not override the membership gate. No credentials or approval are available in this project, so no Pitt media/transcripts were downloaded.

TalkBank rules state non-commercial use and corpus citation/acknowledgement requirements and restrict sharing of password-protected data. Before model training or serving, verify that the approved terms explicitly cover those derivative-model uses; an access approval or platform license badge alone is insufficient. Do not scrape, use another person's credentials, or treat educational examples as authorized research data.

## Provenance record requirements

Create and retain an access-controlled provenance record before processing:

- Exact dataset, release/accession, official source, and download date.
- Data steward, authorization/approval reference, approved purpose, access expiry, and required citation.
- SHA-256 and byte size for each acquired file, plus original file name and release-level data dictionary.
- Exact label definition and source, inclusion/exclusion rules, participant/session keys, missingness, and modality availability.
- Explicit statement of which files/modalities may be linked and under what terms.
- Storage location, authorized operators, retention/deletion requirements, and audit trail.

The reference and checksum may be recorded in a local private manifest, but a checksum is not proof of permission. The operator confirmation field is an assertion; it does not perform legal, institutional, or ethics review.

## Gated download utility

`Backend/ml/download_authorized_dataset.py` is a resumable HTTPS downloader restricted to documented official hostnames. It refuses to connect unless its JSON manifest contains:

- An explicit `authorization_confirmed: true`.
- A non-secret `authorization_reference`.
- Official source, download, and terms URLs.
- A filename without a directory path and an independently verified SHA-256.
- The exact dataset/release.

The utility checks available disk space against the expected size (from the manifest or an official `HEAD` response), validates the completed size and checksum, retains `.part` data for interrupted transfers, and writes a provenance sidecar. It stops on access-denied responses; it does not attempt to bypass authentication or data agreements. A `--dry-run` validates the manifest without network access.

Example template (not an authorization and not usable until every value is verified):

```json
{
  "dataset_name": "Exact official dataset title",
  "release": "Exact release/accession",
  "source_url": "https://official-host.example/release-page",
  "download_url": "https://official-host.example/exact-file",
  "access_terms_url": "https://official-host.example/terms",
  "authorization_reference": "approved non-secret reference",
  "license_or_agreement": "verified license/agreement and scope",
  "authorization_confirmed": false,
  "sha256": "replace-with-verified-64-character-checksum",
  "expected_size_bytes": 123456,
  "file_name": "exact-file-name"
}
```

Use a private manifest outside the repository. The sample values above are placeholders. The downloader writes only under the chosen private destination (default `Backend/data/raw/`, gitignored); it does not extract archives.

```powershell
python Backend/ml/download_authorized_dataset.py `
  --manifest "C:\approved-private-data\release-manifest.json" `
  --dry-run
```

Only after access terms and authorization have been verified by the responsible institution/data steward, execute without `--dry-run`. If the source requires user login or additional approval, use its official manual process; do not pass credentials to the utility. For training, separately add a specific `model_use_permission` and set `model_training_and_inference_authorized` only after confirming the terms cover model training and local inference; the downloader cannot infer these rights.

## Audit before training

1. Review official schema and release documentation first; do not inspect individual rows in logs or reports.
2. Produce aggregate-only counts for records, unique participants, labels, visits, modality coverage, duplicates, invalid values, and missingness.
3. Exclude identifiers and target-revealing variables from features. Define labels and target population from approved source documentation, not guessed cohort names.
4. Keep all visits for a participant in one split; fit every learned preprocessing step only on the training partition.
5. Keep original data read-only and derived features traceable to exact source file hashes and extraction configuration.
6. Require documented participant-level permission and compatible labels for linkage. Never join by filenames, dates, or similar-looking identifiers.

See [the local data dictionary](./data-dictionary.md), [MRI pipeline boundary](./MRI_PIPELINE.md), and [evaluation report](./EVALUATION_REPORT.md).
