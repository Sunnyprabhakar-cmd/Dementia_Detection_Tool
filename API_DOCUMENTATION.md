# API Documentation — MindScan AI

**Base URL:** `http://localhost:3001` (local dev)  
**Authentication:** `Authorization: Bearer <JWT>` on all protected routes.

---

## 1. Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new user (`{ name, email, password, referBy?, role?: "patient" | "clinician", preferredLanguage?: string }`).
- `POST /api/auth/login` — Authenticate and receive `{ token, user: { id, name, email, role, preferredLanguage } }`.

## 2. Screening & Cognitive Tasks (`/api/screening`)
- `POST /api/screening/start` — Create a new screening session with `patientProfile` (requires `age` and `consent: true`).
- `GET /api/screening/active` — Retrieve the user's active `in_progress` screening session and completed tasks for resumption.
- `GET /api/screening/:id` — Retrieve session details, profile, and saved task responses.
- `PUT /api/screening/:id/patient` — Update patient intake profile on an active screening.
- `POST /api/screening/:id/response` — Save a task response (`taskType`: `memory`, `delayed_memory`, `attention`, `digit_span`, `picture_recognition`, `pattern_recognition`, `clock_drawing`, `orientation`, `language`, `voice`, `motor_tapping`, `clinician_observation`).
- `GET /api/screening/:id/result` — Aggregate cognitive scores, run guarded ML inference if configured, persist & return report.
- `DELETE /api/screening/:id` — Delete an owned screening session.

## 3. Drawing Intelligence (`/api/screening/:id/drawing`)
- `POST /api/screening/:id/drawing` — Submit base64 PNG/JPEG `imageDataUrl`, `strokes`, `targetTime`, `completionTimeSeconds` (or `skipped: true`). Invokes `Backend/ml/analyze_drawing.py` to extract spatial/contour/number-region/hand features and persists under `clock_drawing`.
- `POST /api/screening/:id/drawing/validate` — Validate image data URL format, size (`<= 5 MB`), and PNG/JPEG signature.
- `POST /api/screening/:id/drawing/features` — Extract spatial drawing features without persisting.
- `GET /api/screening/:id/drawing` — Retrieve saved clock drawing analysis for screening `:id`.

## 4. Audio & Speech (`/api/audio`)
- `POST /api/audio/upload` — Consent-gated binary audio upload (`audio/wav`, `audio/webm`, `audio/mpeg`, `audio/mp4`, `audio/ogg`, `<= 12 MB`). Transcribes via `faster-whisper` in a temporary file, extracts speech/timing + acoustic (`MFCC`, `F0`, spectral centroid/bandwidth/rolloff, SNR, clipping) + multilingual (`en`, `hi`, `pa`) features, deletes temp audio.
  - **Response (`200 OK`):** `{ status: "success", processing_status: "completed", audio_duration_seconds, transcription, speech_features, transcript_analysis, speech_intelligence: { acoustic_features, linguistic_analysis, timing_summary }, quality_warnings, classifier, error: null }`
- `GET /api/audio/analysis` — Reports speech classifier availability status.

## 5. Results & History (`/api/results`)
- `GET /api/results/history` — Retrieve persisted screening result history for the authenticated user.
- `GET /api/results/drawing-history` — Retrieve persisted clock drawing history for the authenticated user.

## 6. Notifications (`/api/notifications`)
- `GET /api/notifications` — List notifications for the authenticated user.
- `PATCH /api/notifications/:id/read` — Mark a notification as read.

## 7. Clinician Portal (`/api/clinician`, requires `role: "clinician"`)
- `GET /api/clinician/screenings` — List recent patient screenings and summary scores.
- `GET /api/clinician/screenings/:id` — View full screening detail, task responses, and clinician reviews.
- `POST /api/clinician/screenings/:id/review` — Add a clinician review note and `followUpRecommended` flag.

## 8. ML & Demo (`/api/ml`)
- `POST /api/ml/predict` — Guarded research-model inference for an owned `screeningId` (rejects caller-supplied features).
- `GET /api/ml/demo-report` — Synthetic demo fixture (disabled unless `MINDSCAN_DEMO_MODE=true`).

## 9. Multimodal Assessment Summary (`/api/screening/:id/summary`)
*(Accessible to owning patient or `clinician` role)*
- `POST /api/screening/:id/summary` — Generate and persist multimodal assessment summary, completeness, findings, and recommendations.
- `GET /api/screening/:id/summary` — Retrieve persisted multimodal summary.
- `GET /api/screening/:id/summary/modalities` — Retrieve modality-level findings (`cognitive`, `drawing`, `voice`).
- `GET /api/screening/:id/summary/recommendations` — Retrieve generated non-diagnostic recommendations.
- `GET /api/screening/:id/summary/completeness` — Retrieve assessment completeness breakdown.
- `GET /api/screening/:id/report.pdf` — Download multi-page PDF screening report (`application/pdf`).

## 10. Patient Dashboard & Comparison (`/api/patient`, `/api/results/compare`)
- `GET /api/patient/dashboard` — Retrieve patient profile, active screening, latest summary, history count, and unread notifications.
- `PATCH /api/patient/preferences` — Update `preferredLanguage` (`en`, `si`, `ta`) and `name`.
- `GET /api/results/compare?a=<id1>&b=<id2>` — Compare two authorized assessments side by side.

## 11. Brain Imaging (Optional MRI/CT) (`/api/imaging`)
- `POST /api/imaging/upload` — Upload `.nii`, `.nii.gz`, `.dcm`, or DICOM `.zip` (`<= 50 MB`) with `x-screening-id`, `x-imaging-modality` (`mri` | `ct`), `x-file-name` headers. Validates, de-identifies metadata, and stores outside `Frontend/`.
- `GET /api/imaging/screening/:id` — List uploaded scans for an owned or clinician-assigned screening.
- `DELETE /api/imaging/:scanId` — Delete an owned scan from storage and PostgreSQL.
