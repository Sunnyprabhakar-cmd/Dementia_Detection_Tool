# Model Card — `dementianet-acoustic-v1.0.0` (Experimental Proof-of-Concept)

## Model Details
- **Model ID:** `dementianet-acoustic-v1.0.0`
- **Selected Estimator:** `logistic_regression` (`SimpleImputer` + `StandardScaler` + `LogisticRegression`)
- **Bundle Location:** `artifacts/models/speech_poc/dementianet-acoustic-v1.0.0/`
- **Modality:** `speech_acoustic_poc` (44 acoustic & prosodic features)
- **Training Data:** DementiaNet (`453` valid WAV recordings across `214` speakers; `nodementia: 324`, `dementia: 129`)
- **Integrity:** Verified at runtime via SHA-256 checksum in `metadata.json` (`0c6c37312ead98b50fe137bc3952cec63e7fa4eba30d44769b291094dc402897` for `logistic_regression.joblib`).

## Intended Use & Out-of-Scope Uses
- **Intended Use:** Experimental research demonstration of acoustic feature extraction + end-to-end speech inference inside the MindScan prototype.
- **Out-of-Scope / Prohibited Uses:** Clinical diagnosis, medical triage, clinical risk stratification, or non-English speech screening.

## Performance (Speaker-Disjoint Test Set, `n = 91`)
- **Accuracy:** `0.7363` (95% CI `[0.6375, 0.8159]`)
- **ROC-AUC:** `0.7562` | **PR-AUC:** `0.5257` | **F1:** `0.5714`
- **Sensitivity (Recall):** `0.6154` | **Specificity:** `0.7846` | **Precision:** `0.5333`

## Ethical Considerations & Limitations
1. **Weak Labels:** Public-figure YouTube interview labels reflect biographical status, not standardized clinical cognitive testing (CDR/MMSE/MoCA).
2. **Domain Shift:** YouTube studio/interview audio differs from clinical Picture Description recordings and browser microphone `.webm` captures.
3. **Language Restriction:** English-only (`language == "en"`); non-English recordings (Hindi, Punjabi, Sinhala, Tamil) are explicitly gated out (`status: "unavailable"`).
4. **Quality Gating:** Recordings failing `quality_reliable === true` or missing any of the 44 acoustic features are never fabricated or scored.
