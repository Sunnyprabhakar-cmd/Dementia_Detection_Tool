# Stage 8.1 Security Audit (`STAGE8_1_SECURITY_AUDIT.md`)

**Date:** 2026-11-20  
**Scope:** Registration, role assignment, JWT authentication, patient/clinician authorization, database migration `005`, and PDF output safety.

---

## 1. Vulnerabilities Identified & Remediated

| Finding | Severity | Resolution |
| --- | --- | --- |
| **Public Registration Role Escalation** | **Critical** | `POST /api/auth/register` previously accepted `role` from `req.body` and `App.jsx` exposed a clinician selector. **Fixed:** `authController.js` now rejects any non-`"patient"` role with `403 Forbidden`; `authService.js` hardcodes `normalizedRole = "patient"`; `App.jsx` registration UI is patient-only; added `Backend/scripts/create-clinician.js` for trusted server-side clinician provisioning. |
| **Unassigned Clinician Access in `riskAssessmentService.js`** | **High** | `generateAndPersistMultimodalSummary` and `getPersistedMultimodalSummary` previously queried by `screening_id` for `role === "clinician"` without verifying `clinician_patient_assignments`. **Fixed:** Both functions now call `isClinicianAuthorizedForScreening(userId, screeningId)` and throw `403 Forbidden` if unassigned. |
| **Missing Lookup Indexes in Migration `005`** | **Medium** | Added `clinician_assignments_patient_idx`, `clinician_reviews_screening_created_idx`, and `clinician_reviews_patient_idx` to `005_clinician_assignments_and_reviews.sql`. |

---

## 2. Authorization Matrix Verified
- **Unauthenticated / Invalid JWT:** All protected `/api/patient/*`, `/api/clinician/*`, `/api/notifications*`, `/api/results/*`, `/api/screening/*`, and `/api/screening/:id/report.pdf` routes return `401 Unauthorized`.
- **Patient Role on Clinician Routes:** `GET /api/clinician/screenings`, `GET /api/clinician/screenings/:id`, `POST /api/clinician/screenings/:id/review` return `403 Forbidden`.
- **Clinician Immutability:** Clinicians have no write endpoints for `task_responses` or `screening_patient_profiles`.
- **PDF Safety:** `generateAssessmentPdfBuffer` escapes `(`, `)`, `\`, strips non-printable characters, verifies `startxref` byte offset, and includes no internal server paths.

---

## 3. Remaining Live-Environment Blocker
- **PostgreSQL Credentials Unavailable:** `Backend/.env` has no `DB_PASSWORD` / `DATABASE_URL` or `JWT_SECRET` configured locally, so `npm run db:ensure` and `npm run db:migrate` were **not** executed against a live database. Production readiness is **not** claimed until live migrations and DB-backed E2E tests are executed.
