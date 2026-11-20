# Voice Research Review — Stage 10 (`VOICE_RESEARCH_REVIEW.md`)

**Date:** 2026-11-20  
**Scope:** Evaluation of speech-based Alzheimer's/MCI benchmarks, open-source repositories (including `homiyano/Alzheimer-s-detection-model-with-speech`), acoustic/SSL encoders, and deployment feasibility.

---

## 1. Benchmark Corpora & Challenges

| Corpus / Challenge | Participants & Labels | Languages | Access & License | Key Pitfalls |
| --- | --- | --- | --- | --- |
| **DementiaBank Pitt Corpus** | 104 controls, 208 dementia, 85 unknown (Cookie Theft picture description) | English | TalkBank membership + DUA (`talkbank@cmu.edu`); non-commercial research only | Unbalanced; multiple sessions per speaker (segment leakage risk) |
| **ADReSS (Interspeech 2020)** | Balanced age/gender subset of Pitt (`~156` speakers: 78 AD / 78 NC) + MMSE regression | English | TalkBank / DementiaBank DUA | Small sample size (`N~156`); recording-environment shortcuts |
| **ADReSSo (Interspeech 2021)** | Speech-only balanced Pitt subset (`~237` speakers: AD vs NC, MMSE, progression) | English | TalkBank / DementiaBank DUA | Silence/pause artifacts can inflate accuracy if not controlled |
| **DementiaBank Delaware Corpus** | MCI & healthy control discourse/dialogue | English | TalkBank / DementiaBank DUA | Smaller MCI sample; cross-corpus domain shift |
| **TAUKADIAL** | Multilingual spontaneous speech (MCI vs NC) | English, Chinese | TalkBank / challenge DUA | Cross-lingual models do not generalize blindly to `hi`/`pa`/`si`/`ta` |

---

## 2. Candidate Models & Open-Source Implementations

| Candidate | Architecture & Inputs | Reported Literature Metrics | Weights Available? | License & Use | Compatibility & Limitations |
| --- | --- | --- | --- | --- | --- |
| **`alzspeech`** (`homiyano/Alzheimer-s-detection-model-with-speech`) | 1) `GatedFusionClassifier` (frozen Whisper + text), 2) `TextDisfluencyClassifier` (BERT + pause tokens), 3) `PMIGraphClassifier`, + `SilenceControlClassifier` | Literature templates cite `89.6%` acc (ADReSS) to `90.14%` F1 (ADReSSo); repo itself provides training code only | **No** (explicitly states no trustworthy pretrained AD weights exist) | **MIT** (code); requires TalkBank DUA for ADReSSo data | Python 3.10+ (`torch`, `transformers`); synthetic fixtures only for mechanics |
| **data2vec (`data2vec-audio-base-960h` + RF/LR/SVC)** | Self-supervised raw audio embeddings + classical ML / MLP | ADReSSo held-out AUC `0.846`; DementiaBank external AUC `0.835`; Hosmer-Lemeshow $p=0.9616$ | Generic `data2vec-audio-base-960h` weights exist; AD-finetuned weights not shipped | Apache-2.0 (backbone) | Needs local ADReSSo audio to train/calibrate downstream classifier |
| **wav2vec 2.0 (`wav2vec2-base-960h`)** | Self-supervised speech encoder + linear/RF head | Generally lower than `data2vec` on ADReSSo in comparative benchmarks | Generic ASR backbone only | Apache-2.0 (backbone) | Fine-tuning full transformer on `N<200` speakers risks overfitting |
| **openSMILE eGeMAPS + Linguistic Baseline** | 88 acoustic eGeMAPS features + transcript fluency/disfluency features + LR/RF/SVM/GB | ADReSS/ADReSSo baselines `75%–78.9%` acc; combined acoustic+text `83%–89.6%` | Trainable from scratch on authorized data | openSMILE (`audEERING` open-source/research license; commercial requires license) | Interpretable, low-overfitting baseline; requires speaker-grouped CV & silence-only control |
| **Whisper (`faster-whisper` `base`)** | Multilingual ASR + segment/word timestamps (already in MindScan) | Transcription only (not a dementia classifier) | **Yes** (MIT, CTranslate2) | **MIT** | Word error rate varies for `hi`/`pa`/`si`/`ta`; must separate ASR errors from cognitive findings |

---

## 3. Milestone 1 Conclusions for MindScan
1. **No drop-in pretrained dementia-speech weights** can be legally/scientifically deployed without authorized training data.
2. MindScan's Stage 10 voice pipeline will implement **structured multi-task verbal assessment**, **extended acoustic + linguistic extraction**, a **per-language capability registry**, and a **leakage-free model comparison pipeline** (LR, RF, GB, SVM + `SilenceControlClassifier`), keeping real AD classification **explicitly unavailable/blocked** until TalkBank ADReSSo/Pitt access is approved by the user.
