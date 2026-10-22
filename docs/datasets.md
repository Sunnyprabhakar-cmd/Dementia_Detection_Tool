# Dataset access and provenance

## Current project files

The repository has local tabular/audio data and model artifacts, but their presence is not evidence of source, release, consent, license, permitted reuse, or approved linkage. The existing tabular artifact metadata refers to a local `dementia_dataset.csv` and an “OASIS-style” longitudinal cohort; it does not identify a verified accession/release or establish that the data may be used for this project. The project-local audio has no verified subject-level diagnostic mapping in its accompanying metadata. Do not treat the two modalities as linkable.

No candidate data was downloaded, opened at the participant-row level, or used for training as part of this implementation. The existing [data audit script](../Backend/ml/data_audit.py) has been changed to require a provenance/authorization manifest and to emit aggregate-only results; it has not been run against the local CSV because its provenance and access basis remain unverified.

## External access information

- **OASIS:** Start from the [OASIS project site](https://sites.wustl.edu/oasisbrains/), select the exact release (for example OASIS-1/longitudinal, OASIS-3, or OASIS-4), and follow that release's official NITRC-IR registration, data-use, citation, and download instructions. Verify the release and terms before use; do not infer the release from a filename. The local file's exact release and applicable use terms are not established.
- **DementiaBank/Pitt:** The [DementiaBank data index](https://talkbank.org/dementia/access/) links corpus-specific documentation and signed contribution forms. DementiaBank says access is restricted to consortium members; students must ask their faculty advisor to request membership and student access with a defined term. Follow the exact corpus/Pitt materials' contribution, privacy, and citation rules. The [DementiaBank site](https://talkbank.org/dementia/) describes the request process and separately available educational Grand Rounds material. Do not scrape, bypass authentication, share credentials, or use educational materials as if they were an authorized research dataset.

## Audit procedure after authorization

1. Save the official release name, source URL, download date, data-use approval/reference, approved purpose, and required citation in an approved private research record.
2. Preserve the downloaded originals as read-only. Compute SHA-256 checksums and create a local manifest using [the template](./dataset-provenance-template.json). Do not commit restricted files, manifests containing sensitive identifiers, or access records.
3. Review the official data dictionary and schema before loading rows. Record label definitions, repeated-measure structure, subject/group keys, exclusions, missingness, modality coverage, and whether linkage is explicitly permitted.
4. Audit locally with aggregate-only summaries: column names/types, row and participant counts, duplicate records, label counts, missingness, impossible values, and per-participant visit counts. Do not print participant IDs, file paths, transcripts, or row-level records in logs/reports.
5. Confirm the training target and features match the approved research question; exclude identifiers and features that encode or directly reveal the target. Split by participant, keep preprocessing inside training folds, and preserve an untouched test partition.
6. Do not combine datasets/modalities based on names, dates, or directory layout. Require a documented, authorized participant-level linkage key and compatible labels before proposing fusion.

Read and follow the exact release/corpus terms, data-use agreement, institutional review requirements, and attribution requirements before obtaining or processing data. A dataset being publicly described or accessible online does not itself authorize every use.

For the task-specific audit and gated acquisition workflow, see [AI implementation audit](./AI_IMPLEMENTATION_AUDIT.md) and [dataset provenance and access](./DATASET_PROVENANCE.md). The optional precomputed MRI feature join and its limits are documented in [MRI pipeline](./MRI_PIPELINE.md).

## Training provenance manifest

`Backend/ml/train_model.py` fails closed unless given:

- An explicit CSV path.
- A JSON manifest identifying dataset name, release, source URL, authorization reference, and SHA-256 checksum.
- An explicit confirmation that the access terms authorize the intended training use.
- Explicit target, subject/group, and feature columns.

Example manifest shape (replace every placeholder with verified information; do not place credentials, participant identifiers, or restricted materials in this file):

```json
{
  "dataset_name": "verified dataset title",
  "release": "verified release or accession",
  "source_url": "https://official-source.example/dataset",
  "authorization_reference": "non-secret approval or agreement reference",
  "authorization_confirmed": true,
  "sha256": "64-character SHA-256 checksum of the exact CSV"
}
```

The flag is an operator assertion, not a legal or institutional verification performed by the script. Keep authorization records outside the code repository when they are confidential. The script records a checksum and citation fields in model metadata; it does not copy input rows or participant identifiers into that metadata.
