# Stage 12 — Separate Patient and Clinician Login Experience Report

**Date:** 2026-11-20  
**Repository:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`

---

## 1. Existing Authentication Architecture & Root Cause

- **Backend:** `Backend/services/authService.js` signs a JWT containing `{ userId, role }` (from PostgreSQL `users.role`) with `expiresIn: "1d"`; `Backend/controller/authController.js` enforces patient-only public registration (`403` for non-patient roles); `Backend/middleware/authMiddleware.js` and `requireRole` enforce server-side RBAC.
- **Previous Frontend Gap:** `Frontend/src/App.jsx` rendered a single generic `Login / Register` card with no role-selection entry screen, no separate `/login/patient` or `/login/clinician` routes, and read `userRole` from `localStorage` without decoding/validating the signed JWT.

---

## 2. Changes Implemented

1. **Pure Routing & Role-Validation Module (`Frontend/src/authRouting.js`):**
   - Implemented URL routing for `/login`, `/login/patient`, `/login/clinician`, `/patient/dashboard`, and `/clinician/dashboard`.
   - Added `getTokenRoleAndValidity()` to extract the signed `role` claim and verify JWT `exp` expiration.
   - Added `validatePortalLoginRole()` to reject portal/account role mismatches in both directions without storing tokens or redirecting.
   - Added `resolveAuthorizedRoute()` to redirect unauthenticated/invalid routes to `/login`, block cross-role direct dashboard URLs, and redirect authenticated users away from `/login*` pages to their role's dashboard.
2. **Role-Selection & Portal Login UI (`Frontend/src/components/AuthPortal.jsx`):**
   - **Role Selection (`/login`):** Responsive 2-card portal selector (**Patient Portal** with `Patient Login` + `Patient Registration`; **Clinician Portal** with `Clinician Login` and explicit notice that public registration is disabled).
   - **Patient Portal (`/login/patient`):** `← Back to role selection`, `Login` / `Register` tabs, password visibility toggle (`Show` / `Hide`), language selector, and loading/error states.
   - **Clinician Portal (`/login/clinician`):** `← Back to role selection`, login-only form (no registration tab), password visibility toggle (`Show` / `Hide`), and loading/error states.
3. **App Integration (`Frontend/src/App.jsx`):**
   - Integrated `AuthPortal`, `window.history.pushState`/`popstate`, `resolveAuthorizedRoute`, and role-gated `loadHistory` / `resumeActiveScreening` (only executed for `patient` role).
4. **Unit Tests (`Frontend/tests/authRouting.test.js`):**
   - Added 4 unit test suites covering unauthenticated redirects, cross-role URL protection, bidirectional login portal mismatch rejection, and JWT role/expiration validation.

---

## 3. Live Browser Verification Results (`http://localhost:5173/` -> `http://localhost:3001/`)

All 10 Stage 12 scenarios passed with **`0` console/page errors** and **`0` HTTP `>= 400` responses** (evidence screenshot: `browser_evidence/45986c51-0a9a-4e8b-a248-4fecfd93eb06/final_step_28.png`):

| # | Scenario | Observed Result |
|---|---|---|
| 1 | Patient selects Patient Login & logs in | Redirected to `/patient/dashboard`; `Assessment dashboard` rendered (`HTTP 200`). |
| 2 | Clinician selects Clinician Login & logs in | Redirected to `/clinician/dashboard`; `Clinician Portal` rendered (`HTTP 200`). |
| 3 | Patient accesses `/clinician/dashboard` directly | Redirected back to `/patient/dashboard` with notice: *"Patient accounts are not authorized to access the Clinician Dashboard."* |
| 4 | Clinician accesses `/patient/dashboard` directly | Redirected back to `/clinician/dashboard`; `Clinician Portal` remained active. |
| 5 | Patient credentials in Clinician Login (`/login/clinician`) | Rejected on `/login/clinician` with: *"This account is a patient account and cannot access the Clinician Portal. Please use Patient Login."* |
| 6 | Clinician credentials in Patient Login (`/login/patient`) | Rejected on `/login/patient` with: *"This account is registered as a clinician. Please sign in through the Clinician Portal."* |
| 7 | Logout returns to role selection | Returned to `/login` (`Select Your Portal`). |
| 8 | Refresh preserves authenticated dashboard | `page.reload()` preserved `/clinician/dashboard` for clinician and `/patient/dashboard` for patient. |
| 9 | Unauthenticated direct dashboard access | Visiting `/clinician/dashboard` while logged out redirected to `/login`. |
| 10 | Public clinician registration disabled | `/login/clinician` has no registration UI; backend `POST /api/auth/register` continues returning `403` on clinician role escalation (verified in `Backend/tests/stage8_1Security.test.js`). |

---

## 4. Regression Test Counts

- **Backend Node Tests (`npm test`):** `75/75` passed (`0` failures).
- **Frontend Unit Tests (`npm test`):** `16/16` passed (`0` failures, including `4/4` in `authRouting.test.js`).
- **Frontend Production Build (`vite build`):** `32` modules transformed in `262ms` (`0` errors).

---

## 5. Remaining Limitations

- Static production servers (such as Nginx or Express serving `Frontend/dist`) must rewrite SPA routes (`/login/*`, `/patient/*`, `/clinician/*`) to `index.html` if deep-linked outside the Vite dev server.
- Minor UI polish: on `/login`, the `"Patient Registration"` ghost button has low-contrast text on `#f8fafc`; after a full page reload, the topbar greeting omits the email (which is only in React state, not persisted).
