# Stage 10.4 — Dementia Speech Model Training & Evaluation Report

**Date:** 2026-11-20  
**Pipeline:** `Backend/ml/training/dementianet_pipeline.py`  
**Output Bundle:** `artifacts/models/speech_poc/dementianet-acoustic-v1.0.0/`

---

## 1. Speaker-Level Split (Zero Speaker Leakage)

Using `participant_level_split` grouped strictly by `speaker_hash`:
- **Train:** `271` recordings (`128` speakers)
- **Validation:** `91` recordings (`43` speakers)
- **Independent Test:** `91` recordings (`43` speakers)

---

## 2. Feature Set (`44` Acoustic Features)

Extracted directly from `Backend/ml/preprocessing/audio_preprocessing.py`:
- **Voicing & Energy (4):** `voiced_frame_ratio`, `voiced_unvoiced_ratio`, `energy_rms_mean`, `energy_rms_std`
- **Spectral & ZCR (4):** `zcr_mean`, `spectral_centroid_hz`, `spectral_bandwidth_hz`, `spectral_rolloff_hz`
- **Pitch & Perturbation (7):** `pitch_mean_hz`, `pitch_median_hz`, `pitch_std_hz`, `pitch_range_hz`, `jitter_local`, `shimmer_local`, `hnr_mean_db`
- **Waveform Silence / Pause (3):** `waveform_silence_ratio`, `waveform_pause_count`, `waveform_mean_pause_seconds`
- **MFCCs (26):** `mfcc_1_mean`..`mfcc_13_mean`, `mfcc_1_std`..`mfcc_13_std`

---

## 3. Independent Test Set Comparison (`n = 91` recordings, `43` speakers)

| Model | Accuracy (95% Wilson CI) | Precision | Recall (Sensitivity) | Specificity | F1 | ROC-AUC | PR-AUC | Confusion Matrix `[[TN, FP], [FN, TP]]` |
|---|---|---|---|---|---|---|---|---|
| **`logistic_regression` (Selected)** | **0.7363** `[0.6375, 0.8159]` | **0.5333** | **0.6154** | **0.7846** | **0.5714** | **0.7562** | **0.5257** | `[[51, 14], [10, 16]]` |
| `svm_rbf` | 0.7143 `[0.6143, 0.7969]` | 0.5000 | 0.4615 | 0.8154 | 0.4800 | 0.6763 | 0.4444 | `[[53, 12], [14, 12]]` |
| `gradient_boosting` | 0.6923 `[0.5913, 0.7777]` | 0.4375 | 0.2692 | 0.8615 | 0.3333 | 0.6568 | 0.4085 | `[[56, 9], [19, 7]]` |
| `random_forest` | 0.6593 `[0.5573, 0.7485]` | 0.3913 | 0.3462 | 0.7846 | 0.3673 | 0.6757 | 0.4105 | `[[51, 14], [17, 9]]` |
| `silence_control` (silence/pause only) | 0.5824 `[0.4798, 0.6784]` | 0.3000 | 0.3462 | 0.6769 | 0.3214 | 0.5101 | 0.3719 | `[[44, 21], [17, 9]]` |

### Key Takeaways
1. `logistic_regression` achieved **0.7562 ROC-AUC** and **0.7363 accuracy** on unseen speakers, outperforming the `silence_control` baseline (`0.5101` ROC-AUC — near chance).
2. Class imbalance (`324` `nodementia` vs `129` `dementia`) and weak YouTube biographical labels limit precision (`0.5333`) and sensitivity (`0.6154`).
3. Output scores are **not** calibrated clinical probabilities (`scores_are_calibrated_probabilities: false`).
