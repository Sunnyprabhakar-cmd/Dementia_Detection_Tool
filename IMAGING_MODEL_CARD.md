# Model Card — `radiata-oasis-mri-v1.0.0` (Experimental Brain MRI PoC)

## Model Details
- **Model ID:** `radiata-oasis-mri-v1.0.0`
- **Live Default Estimator:** `volumetric_logreg` (27 3D morphometric & regional intensity features)
- **Bundle Location:** `artifacts/models/imaging/radiata-oasis-mri-v1.0.0/` (`volumetric_logreg.joblib`, `triplanar_2d_cnn.pt`, `lightweight_3d_cnn.pt`, `metadata.json` with SHA-256 checksums)
- **Modality:** Structural T1-weighted Brain MRI (`.nii` / `.nii.gz`)
- **Labels:** `cognitively_normal` vs `Alzheimers_disease` (does **not** cover MCI or non-AD dementias)
- **Training Data:** `radiata-ai/brain-structure` (`OASIS-1` & `OASIS-2` subset: `787` scans across `564` participants)

## Intended Use & Prohibited Uses
- **Intended Use:** Experimental research demonstration of 3D NIfTI preprocessing and volumetric inference inside MindScan AI.
- **Prohibited Uses:** Clinical diagnosis, medical screening clearance, Brain CT classification, or standalone patient decision-making.

## Performance (Participant-Disjoint Test Set, `n = 158` scans / `112` participants)
- **Accuracy:** `0.7911` (95% CI `[0.7212, 0.8472]`)
- **ROC-AUC:** `0.8770` | **PR-AUC:** `0.7404` | **F1:** `0.7227`
- **Sensitivity:** `0.7963` | **Specificity:** `0.7885` | **Precision:** `0.6615`

## Limitations & Disclaimer
> *"This imaging model is an experimental research prototype and is not intended for clinical diagnosis. Results must be interpreted by qualified healthcare professionals."*

- Trained on skull-stripped, MNI152-aligned (`113×137×113`, `1.5 mm³`) OASIS T1w volumes; clinical raw hospital scans with skulls or different orientations/resolutions will experience domain shift.
- Uncalibrated relative scores (`scores_are_calibrated_probabilities: false`) are not diagnostic probabilities.
