# Production Setup Guide — MindScan AI (`PRODUCTION_SETUP.md`)

## 1. Required Environment Variables

### Backend (`Backend/.env`, from `Backend/.env.example`)
- `NODE_ENV=production`
- `PORT=3001`
- `DATABASE_URL` (PostgreSQL connection string with TLS enabled; `DATABASE_SSL_REJECT_UNAUTHORIZED=true`)
- `JWT_SECRET` (cryptographically random secret, >= 32 characters; required at startup in production)
- `CORS_ORIGIN=https://dementia-detection-tool.vercel.app` (exact origin)
- `MINDSCAN_DEMO_MODE=false`
- `PYTHON_EXECUTABLE` (path to `.venv` Python with `Backend/ml/requirements-training.txt`)

### Frontend (`Frontend/.env`, from `Frontend/.env.example`)
- `VITE_API_URL=https://your-backend-domain.example` (never hardcode `localhost` in production builds)

## 2. Database Setup & Migrations
```powershell
npm run db:ensure
npm run db:migrate
```
Migrations `000` through `005` are checksum-verified and idempotent (`schema_migrations`).

## 3. Trusted Clinician Provisioning
Public registration is strictly patient-only. Provision clinicians via CLI:
```powershell
node Backend/scripts/create-clinician.js "Dr. Name" "clinician@example.org" "<strong-password>"
```
Assign patients via `clinician_patient_assignments (clinician_id, patient_id)`.
