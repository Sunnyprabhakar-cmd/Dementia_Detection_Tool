# MRI-derived feature pipeline

## Current capability and safety boundary

There is no raw-MRI ingestion, image processing, segmentation, or model pipeline in this project. The repository's local tabular header includes MRI identifiers and derived fields, but the source/release, permissions, imaging format, exact mapping, and feature derivation have not been verified. No MRI files were downloaded, inspected, or processed for this work.

The supported integration boundary is a table of already-derived, numeric MRI features with verified provenance. `Backend/ml/join_derived_mri.py` can join such a table to clinical records only when the operator explicitly supplies the participant key, optional session key, and feature-column allowlist. The join refuses null identifiers, duplicate keys, missing feature columns, and non-numeric features. It preserves every clinical record and labels unmatched rows `missing_mri`; unmatched imaging records are not silently paired.

Before use, the operator must supply a provenance manifest that confirms authorization and has exact SHA-256 checksums for both input CSVs. Its `authorization_confirmed` value is an operator attestation, not a substitute for data steward, ethics, institutional, or legal approval. Outputs are restricted data and must remain outside Git on access-controlled storage.

## Safe precomputed-feature join

Example only; first verify data provenance, authorization, source dictionary, participant/session semantics, and permitted linkage. Use a private output path.

```powershell
python Backend/ml/join_derived_mri.py `
  --clinical-csv "C:\approved-private-data\clinical.csv" `
  --mri-features-csv "C:\approved-private-data\mri-derived.csv" `
  --manifest "C:\approved-private-data\provenance.json" `
  --clinical-id "verified_subject_key" `
  --mri-id "verified_subject_key" `
  --clinical-session "verified_visit_key" `
  --mri-session "verified_session_key" `
  --feature-columns "feature_a,feature_b" `
  --dry-run
```

The utility reports only aggregate matched/missing counts in dry-run mode. It does not print identifiers or sample records. Omit both session arguments only when official documentation proves there is exactly one appropriate feature record per participant; duplicates are an error. Without `--dry-run`, the output contains the selected clinical records, chosen derived features, and `mri_status`; protect it as restricted data.

The input columns and feature definitions above are placeholders, not a claim about the actual OASIS schema. Do not substitute filenames or an approximate identifier for a verified linkage key. The current local `Subject ID`/`MRI ID` column names alone do not establish a valid mapping.

## Not implemented: raw image processing

No MRI reader, format validator, registration, segmentation, or FreeSurfer/nibabel pipeline is included. Appropriate implementation depends on the authorized release's actual image formats, approved processing software, quality-control protocol, and corresponding clinical key. Before adding it:

- Confirm access/use terms cover image processing and derived feature creation.
- Confirm image file formats, archive integrity, and required tool versions.
- Document acquisition/site and preprocessing protocols, quality control, failures, and provenance for every derived feature.
- Test ID/session matching, duplicate detection, unmatched cases, and failed processing with synthetic identifiers and non-clinical fixture values only.
- Keep images, logs, intermediate files, and derived participant-level tables in approved private storage.

Do not infer a diagnosis from an MRI-derived feature or combine it with assessment/speech output until an appropriately matched authorized dataset and independent evaluation justify that use.
