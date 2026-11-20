# Final Project Demonstration Guide (10–15 Minutes)

**System:** MindScan AI — Research Cognitive, Speech & Multimodal Screening Prototype  
**URLs:** Frontend `http://localhost:5173/` · Backend `http://localhost:3001/`

---

## 1. Introduction & Objectives (1.5 min)
- Explain the goal: a transparent, privacy-preserving cognitive and communication screening prototype combining structured digital tasks, acoustic/speech analysis, optional clinician/attendant physical observations, and role-based reporting.
- Emphasize the core safeguard: **experimental research prototype only — not a clinical diagnosis**.

## 2. Patient Registration, Login & Dashboard (1.5 min)
- Open `http://localhost:5173/`, register or sign in as a `patient` (public registration is patient-only).
- Show the **Patient Dashboard**: active screening resume, **Assessment History & Reports**, **Optional Brain Imaging**, and **Notifications**.

## 3. Cognitive Screening Workflow (2.5 min)
- Click **Start screening**, enter Age and confirm consent.
- Walk through **Memory** (5-word recall), **Attention**, **Digit Span**, **Picture Recognition**, **Pattern Recognition**, **Clock Drawing** (canvas strokes analyzed by `Pillow`/Python CV), **Orientation**, **Delayed Memory**, and **Language**.
- Note how skipped tasks are explicitly tracked and never scored as `0`.

## 4. Voice Assessment & Experimental Speech Classification (2.5 min)
- On **Voice / Picture Description**, confirm consent and either record via microphone or click **Upload WAV / audio file** (e.g., an English DementiaNet `.wav` sample).
- Highlight the 5 clearly separated UI sections:
  1. **Audio Quality** (`Reliable` + SNR)
  2. **Speech Transcription** (`faster-whisper-base`, detected language `en`; raw transcript is never persisted to DB)
  3. **Acoustic Feature Analysis** (44 features: speaking rate, pauses, F0 pitch, jitter/shimmer/HNR, spectral centroid, MFCCs)
  4. **Experimental Research Classifier Output** (`dementianet-acoustic-v1.0.0`: `Non-dementia` / `Dementia` / `Inconclusive`, uncalibrated decimal scores, `0.50` validation-default threshold labeled *"Experimental classification — threshold not clinically validated"*)
  5. **Model Limitations & Disclaimer**.

## 5. Optional Physical Examination with Attendant (1.5 min)
- Show **Optional Physical Examination**: explain that patients must not perform this independently; it is recorded in person by a trained attendant or qualified healthcare professional.
- Demonstrate adding separate **Sensory Response** (body region, method, response) and **Reflex** (site, Left/Right/Both, response) observations — or skipping it cleanly without affecting the cognitive score.

## 6. Unified Report, Score Separation & PDF Export (2 min)
- Show **Assessment Performance Score (`XX/100`, `assessment-performance/1.0.0`)** separately from **Assessment Completeness (`%`)** and **Experimental Speech Model Prediction**.
- Return to Patient Dashboard -> **View Summary** and click **Download PDF** (`mindscan-report-<id>.pdf`) to show identical values and the **Optional Physical Examination Observations** section.

## 7. Clinician Login, Assigned Review & Security/Privacy (2.5 min)
- Log out and sign in as a provisioned **clinician**.
- Show **Clinician Portal** (patient sidebar hidden), search/filter assigned assessments, open a screening, submit a **Clinician Review** (leaving original patient responses immutable), and download the PDF.
- Conclude with **Security & Limitations**: unassigned patients return `403`, unauthenticated routes return `401`, raw audio/transcripts are not retained, and DementiaNet uses weak YouTube labels (English-only) requiring future DUA clinical validation (ADReSSo/OASIS).
