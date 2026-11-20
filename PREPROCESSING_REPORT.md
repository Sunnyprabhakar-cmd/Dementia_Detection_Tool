# Preprocessing Report — MindScan AI

**Date:** 2026-11-20  
**Module:** `Backend/ml/preprocessing/`  
**Test Suite:** `Backend/ml/test_preprocessing.py` (4/4 passing; full Python suite: 60 tests run, 55 passed, 5 skipped, 0 failures)

---

## 1. Implemented Preprocessing Capabilities

| Component | Module | Capabilities Implemented |
| --- | --- | --- |
| **Tabular Cleaning** | `data_cleaning.py` | Column whitespace stripping (`strip_column_whitespace`), aggregate missing-value analysis (`analyze_missing_values`), exact & key-level duplicate detection (`detect_duplicates`), type coercion & null-row/column removal (`clean_tabular_dataframe`). |
| **Acoustic Audio Processing** | `audio_preprocessing.py` | WAV validation (`validate_wav_audio` — sample rate, duration, silence RMS rejection), 13-band MFCC mean/std extraction, autocorrelation F0 pitch estimation (`pitch_mean_hz`, `pitch_std_hz`, `pitch_min_hz`, `pitch_max_hz`, `voiced_frame_ratio`), RMS energy, ZCR, waveform pause count/duration, and response latency (`extract_acoustic_features`). |
| **Clock Drawing Image Processing** | `image_preprocessing.py` | Image validation (`validate_drawing_image` — dimensions, blank-canvas rejection), spatial centering (`center_offset_ratio`), circularity (`circularity_score`), quadrant balance (`q1`–`q4`, `quadrant_balance_score`), ring/hand ink ratios (`outer_ring_ink_ratio`, `number_ring_ink_ratio`, `inner_hand_ink_ratio`), hand angle spread, stroke length & completion time (`extract_clock_drawing_features`). |
| **Feature Engineering & Versioning** | `feature_engineering.py` | Schema validation (`validate_feature_schema`), leak-free train-only `SimpleImputer(median)` + `StandardScaler`/`MinMaxScaler` (`fit_transform_preprocessor`), participant-grouped `StratifiedGroupKFold` / `GroupShuffleSplit` (`participant_level_split`), and SHA-256 dataset versioning (`version_dataset_artifact`). |

---

## 2. Observed Results on Acquired Open-Access Datasets

### A. Zenodo `13378346` — Cognitive Performance of Older Patients (`CC-BY-4.0`)
- **Initial / Cleaned Rows:** `283` / `283` (`26` columns, trailing column whitespace stripped)
- **Overall Missingness:** `0.77%`
- **Participant-Grouped Split (`group_col="Nr"`):**
  - Train: `169` participants
  - Validation: `57` participants
  - Test: `57` participants
  - Cross-split participant overlap: `0`
- **Scaling & Imputation:** `SimpleImputer(strategy="median")` + `StandardScaler` fit on Train only; `0` NaN values in `X_train`, `X_val`, `X_test`.

### B. Zenodo `5509808` — Neurological Screening in Southern Italy (`CC-BY-4.0`)
- **Initial / Cleaned Rows:** `706` / `706` (`16` columns)
- **Overall Missingness:** `9.18%`
- **Exact Duplicate Rows:** `0`

---

## 3. Non-Clinical Fixture Verification (Audio & Clock Drawing)
- **Audio Fixture (16 kHz synthetic dual-tone + 0.25s pause WAV):** Verified `duration=1.35s`, `waveform_pause_count >= 1`, `pitch_mean_hz` within `[120, 200]` Hz, and 26 MFCC summary features (`mfcc_1_mean`..`mfcc_13_std`). Silent WAV rejected with `ValueError`.
- **Clock Drawing Fixture (300×300 synthetic clock PNG + 2 strokes):** Verified `circularity_score > 0.7`, `quadrant_balance_score > 0.7`, `stroke_count = 2`, `total_stroke_length_px = 135.0`, `completion_time_seconds = 18.4`. Blank PNG rejected with `ValueError`.
- *Note: Synthetic fixtures validate software mechanics only and are never used as clinical training data.*
