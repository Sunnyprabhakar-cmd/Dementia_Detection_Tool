# Stage 8 Design — Patient & Clinician Dashboards, History & PDF Reporting (`STAGE8_DESIGN.md`)

**Date:** 2026-11-20

---

## 1. Existing vs. Missing Capabilities

| Capability | Existing State | Stage 8 Addition |
| --- | --- | --- |
| **Role-Based Auth** | `users.role` (`patient`/`clinician`) and `requireRole` exist. | Enforce clinician-to-patient assignment authorization (`clinician_patient_assignments`) and cross-user ownership checks. |
| **Patient Dashboard** | Basic sidebar with 5 history items in `App.jsx`. | Dedicated `PatientDashboard.jsx` + `GET /api/patient/dashboard`, `PATCH /api/patient/preferences`, side-by-side comparison (`GET /api/results/compare`), PDF download, notifications. |
| **Clinician Dashboard** | Basic `GET /api/clinician/screenings` backend only. | Dedicated `ClinicianDashboard.jsx` with search, filters (`all`, `recent`, `incomplete`, `pending_review`), review workflow (`review_status`), and PDF export. |
| **PDF Reporting** | None. | Pure Node.js multi-page PDF 1.4 generator (`Backend/services/pdfReportService.js`) at `GET /api/screening/:id/report.pdf` with pagination, escaping, and disclaimers. |
| **Notifications** | `notifications` table & `/api/notifications` routes exist. | Trigger notifications on screening summary completion and clinician review submission; render in Frontend. |

---

## 2. Security & Authorization Rules
- **Backend Enforcement:** Every route checks `authMiddleware` (`JWT`) and either resource ownership (`screening_sessions.user_id === req.user.userId`) or `requireRole("clinician")` + assignment verification.
- **No PII in URLs or Logs:** Patient search uses query parameters (`q`) or POST/header auth without logging names/emails/IDs.
- **Immutability of Original Responses:** Clinicians can create `clinician_reviews` but cannot modify `task_responses`.
