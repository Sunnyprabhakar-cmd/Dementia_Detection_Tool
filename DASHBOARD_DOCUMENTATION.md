# Dashboard Documentation — MindScan AI (`DASHBOARD_DOCUMENTATION.md`)

**Last Updated:** 2026-11-20

---

## 1. Patient Dashboard (`Frontend/src/components/PatientDashboard.jsx`)
- **Backend Endpoints:** `GET /api/patient/dashboard`, `PATCH /api/patient/preferences`, `GET /api/results/history`, `GET /api/results/compare?a=<id>&b=<id>`, `GET /api/notifications`, `PATCH /api/notifications/:id/read`.
- **Capabilities:**
  - Welcome header & research-only screening disclaimer.
  - Start New Screening / Continue Active Screening buttons.
  - Preferred language persistence (`en`, `si`, `ta`).
  - Unread notifications list with mark-as-read action.
  - Assessment history list with **View Summary** and **Download PDF** actions.
  - Side-by-side comparison of two assessments (descriptive deltas only; no clinical deterioration claims).

## 2. Clinician Dashboard (`Frontend/src/components/ClinicianDashboard.jsx`)
- **Backend Endpoints:** `GET /api/clinician/screenings`, `GET /api/clinician/screenings/:id`, `POST /api/clinician/screenings/:id/review`.
- **Authorization:** Requires `role === "clinician"` and an active entry in `clinician_patient_assignments` (`005_clinician_assignments_and_reviews.sql`).
- **Capabilities:**
  - Search by patient name or study identifier (`q` parameter) and filter (`all`, `recent`, `incomplete`, `pending_review`).
  - Open assessment detail with full `MultimodalSummary`.
  - Add clinician observations (`notes`, `reviewStatus`: `pending` | `in_review` | `reviewed`, `followUpRecommended`) without modifying original `task_responses`.
  - Automatic patient notification on review submission.
