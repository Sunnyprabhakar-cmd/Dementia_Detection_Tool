# Stage 8.1 End-to-End & Integration Test Report (`STAGE8_1_E2E_TEST_REPORT.md`)

**Date:** 2026-11-20

---

## 1. Automated Test Execution Summary

| Suite | Command | Total | Passed | Failed | Skipped | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| **Backend Node + HTTP Integration** | `npm --prefix Backend test` | `60` | `60` | `0` | `0` | Includes `stage8_1SecurityAndE2E.test.js` (4/4 HTTP + PDF `startxref` tests), `stage8DashboardsAndPdf.test.js` (4/4), `riskAssessment.test.js` (4/4), `cognitiveTasks.test.js` (6/6), `drawingService.test.js` (3/3). |
| **Frontend Unit Tests** | `npm --prefix Frontend test` | `12` | `12` | `0` | `0` | `assessmentUtils.test.js` |
| **Frontend Production Build** | `npm --prefix Frontend run build` | `1` | `1` | `0` | `0` | `28` modules compiled in `205ms`. |
| **Python ML, Preprocessing, Speech & Drawing** | `python -m unittest discover -s Backend\ml -p "test_*.py"` | `65` | `60` | `0` | `5` | `4` optional `faster-whisper` tests skipped (`.venv-audio` not installed); `1` legacy `baseline_v1` test skipped. |

---

## 2. Live Database & Workflow Verification Status
- **Verified with Live Express HTTP Server (No DB required):**
  - Public registration privilege escalation (`clinician`, `admin`, `superuser` -> `403`).
  - Missing/invalid JWT rejection (`401`) across all patient, clinician, notification, summary, comparison, and PDF routes.
  - Patient JWT blocked from clinician routes (`403`).
  - PDF 1.4 multi-page structure, `startxref` byte offset, escaping, and path-leakage checks.
- **Blocked Pending PostgreSQL Credentials (`Backend/.env`):**
  - Live `npm run db:ensure` & `npm run db:migrate` (`000`–`005`).
  - Live DB-persisted end-to-end flows (Patient register -> login -> screening -> PDF; Clinician CLI provision -> login -> review -> patient notification; Cross-patient DB IDOR check).
