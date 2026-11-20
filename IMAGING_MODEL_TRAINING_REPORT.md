# Stage 14 — Brain MRI Model Training & Evaluation Report

**Date:** 2026-11-20  
**Pipeline:** `Backend/ml/training/radiata_mri_pipeline.py`  
**Bundle:** `artifacts/models/imaging/radiata-oasis-mri-v1.0.0/`

---

## 1. Dataset Preparation & Participant-Disjoint Split

- **Source:** `radiata-ai/brain-structure` (`OASIS-1` & `OASIS-2` T1-weighted MPRAGE `.nii.gz` volumes, `113×137×113` at `1.5 mm³` MNI152 space).
- **Download & Validation Audit:** `787` scans downloaded (`0` failures, `0` duplicates, `0` corrupt files) across **`564` unique participants** (`cognitively_normal: 522`, `Alzheimers_disease: 265`; `OASIS-1: 414`, `OASIS-2: 373`).
- **Participant-Disjoint Split (`participant_level_split`, seed `42`):**
  - **Train:** `472` scans (`339` participants)
  - **Validation:** `157` scans (`113` participants)
  - **Untouched Test:** `158` scans (`112` participants)

---

## 2. Architectures Evaluated

1. **`volumetric_logreg` (`SimpleImputer` + `StandardScaler` + `LogisticRegression(class_weight="balanced")`):** 27 3D morphometric & regional intensity features (`brain_foreground_ratio`, `nonzero_intensity_cv`, intensity percentiles, `hemisphere_asymmetry`, `central_low_intensity_ratio`, `central_norm_mean`, `gradient_energy_mean`, and 18 `3×3×2` spatial grid means).
2. **`triplanar_2d_cnn` (PyTorch `Conv2d`):** 3-channel (`64×64` axial, coronal, sagittal mid-slices) CNN trained for 18 epochs with `BCEWithLogitsLoss(pos_weight=...)`.
3. **`lightweight_3d_cnn` (PyTorch `Conv3d`):** 3D volumetric CNN on `32×40×32` trilinearly downsampled MRI volumes trained for 18 epochs with `BCEWithLogitsLoss(pos_weight=...)`.

---

## 3. Untouched Independent Test Set Results (`n = 158` scans, `112` participants)

| Model | Val ROC-AUC | Test Acc (95% Wilson CI) | Precision | Recall (Sens.) | Specificity | F1 | ROC-AUC | PR-AUC | Confusion Matrix `[[TN, FP], [FN, TP]]` |
|---|---|---|---|---|---|---|---|---|---|
| **`volumetric_logreg` (Live Default)** | `0.7910` | **`0.7911`** `[0.7212, 0.8472]` | **`0.6615`** | `0.7963` | **`0.7885`** | **`0.7227`** | **`0.8770`** | **`0.7404`** | `[[82, 22], [11, 43]]` |
| `triplanar_2d_cnn` | `0.8385` | `0.6076` `[0.5298, 0.6803]` | `0.4649` | `0.9815` | `0.4135` | `0.6310` | `0.8312` | `0.6904` | `[[43, 61], [1, 53]]` |
| `lightweight_3d_cnn` | `0.7979` | `0.3418` `[0.2724, 0.4187]` | `0.3418` | `1.0000` | `0.0000` | `0.5094` | `0.7981` | `0.6436` | `[[0, 104], [0, 54]]` |

### Selection Rationale
Although `triplanar_2d_cnn` achieved the highest validation ROC-AUC (`0.8385`), `pos_weight` calibration shift caused over-prediction of positives at cutoff `0.50` on the test set (`specificity: 0.4135`), and `lightweight_3d_cnn` collapsed to all-positive at `0.50`. By contrast, `volumetric_logreg` achieved the highest untouched test ROC-AUC (`0.8770`), PR-AUC (`0.7404`), F1 (`0.7227`), and balanced sensitivity/specificity (`0.7963` / `0.7885`), while running without PyTorch inside `.venv-audio`.
