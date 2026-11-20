# Security & Privacy Architecture — MindScan AI (`SECURITY_AND_PRIVACY.md`)

## 1. Authentication & Role-Based Access Control
- **Password Hashing:** `bcrypt` (cost factor `12`).
- **JWT:** Signed with `JWT_SECRET`, `1d` expiry; role (`patient` or `clinician`) is read from PostgreSQL `users` at login, never trusted from client request bodies.
- **Public Registration:** Strictly `patient`-only (`403 Forbidden` on non-patient role attempts). Clinicians are provisioned via `Backend/scripts/create-clinician.js`.
- **Authorization:** Patients access only their own `user_id` resources; clinicians access only patients in `clinician_patient_assignments` and cannot modify `task_responses`.

## 2. Hardening & Upload Controls
- **Security Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Strict-Transport-Security` (production), `X-Powered-By` disabled.
- **Rate Limiting:** `/api/auth/*` (`60` req / 15 min), `/api/audio/*` (`20` req / min).
- **Uploads:** Audio validated by MIME + magic bytes (`<= 12 MB`), processed in private `os.tmpdir()` and deleted in `finally`. Drawings validated by PNG/JPEG signature (`<= 5 MB`).
- **Data Retention & Privacy:** Raw audio and speech transcripts are not persisted in `task_responses` or logs.
