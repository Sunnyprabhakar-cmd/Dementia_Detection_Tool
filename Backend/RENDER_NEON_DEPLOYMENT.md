# Render and Neon deployment

## Render service

Configure the Render service with:

```text
Root directory: Backend
Build command: npm install
Start command: npm start
Health check path: /api/health
```

The server binds to Render's supplied `PORT`; no fixed production port is required.

## Required Render environment variables

| Variable | Required | Value/source |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | The newly rotated Neon connection string for the `neondb` database; copy it from Neon, never commit it |
| `JWT_SECRET` | Yes | A newly generated long random application secret |
| `CORS_ORIGIN` | Recommended | `https://dementia-detection-tool.vercel.app` exactly; if omitted, the backend uses this same exact built-in production origin |
| `PORT` | No | Supplied by Render automatically; do not set a fixed value |

`CORS_ORIGIN` accepts a comma-separated list with no spaces required in
development. In production, an explicitly provided value must equal the
deployed origin above; if it is omitted, the backend uses that same exact
built-in origin. Only exact listed origins are allowed. The backend does not
enable credentialed wildcard CORS.

`DATABASE_URL` takes precedence over every `DB_*` variable. The application
removes PostgreSQL URL SSL query parameters that could conflict with the `pg`
pool options and supplies `ssl: { rejectUnauthorized: true }`. It never logs the
connection string.

For local verification, put the rotated Neon URL in `Backend/.env` as
`DATABASE_URL=...` and run:

```powershell
npm --prefix Backend run database:test
```

This executes `SELECT 1 AS connected` and
`SELECT current_database() AS database_name`, printing only the safe result
values. Do not paste the URL or password into source control or terminal logs.

## Optional variables actually read by the backend

| Variable | Purpose/source |
| --- | --- |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Defaults to `true`; keep `true` in production |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Local fallback only when `DATABASE_URL` is absent; production requires all five and uses TLS |
| `DATABASE_SSL` | Local individual-variable fallback; defaults to TLS in production |
| `PYTHON_EXECUTABLE` | Optional Python executable used by the audio analysis subprocess |
| `MINDSCAN_MODEL_DIR`, `MINDSCAN_MODEL_VERSION`, `MINDSCAN_MODEL_NAME` | Optional guarded cognitive model artifact configuration |
| `MINDSCAN_AUDIO_MODEL_DIR`, `MINDSCAN_AUDIO_MODEL_VERSION`, `MINDSCAN_AUDIO_MODEL_NAME` | Optional guarded voice model artifact configuration |
| `MINDSCAN_AUDIO_MODEL_PYTHON` | Optional Python executable used by the voice classifier |
| `MINDSCAN_DEMO_MODE` | Development-only demo opt-in; leave unset or `false` in production |

The frontend separately reads `VITE_API_URL`, which must be set in Vercel to
the Render backend URL, `https://dementia-detection-tool.onrender.com`. It also
reads `VITE_MINDSCAN_DEMO_MODE`, which should remain unset/false for production.

## Neon schema setup

The application does not run migrations during `npm start`. From a trusted
machine, after setting the rotated Neon URL in the current shell:

```powershell
$env:DATABASE_URL = "<rotated Neon connection string>"
$env:NODE_ENV = "production"
npm --prefix Backend run migrate
```

The migration runner creates/updates only `schema_migrations` and the
application schema, records SHA-256 checksums, refuses modified applied
migrations, and performs a required-table/column check. Existing rows are not
dropped or truncated. Do not run `database:ensure` against Neon; it is a local
database helper and production explicitly refuses its database-creation branch.

The four core tables are `users`, `screening_sessions`, `task_responses`, and
`screening_results`. Runtime intake also requires
`screening_patient_profiles`; the result migration adds the runtime JSON/result
columns and the index migration adds lookup indexes. The numbered migration
files are authoritative for an existing database.

## Health check

```text
https://dementia-detection-tool.onrender.com/api/health
```

With valid credentials, network access, and an applied schema, the expected
response is HTTP 200:

```json
{
  "status": "healthy",
  "database": "connected",
  "databaseName": "neondb"
}
```

If PostgreSQL is unreachable, the endpoint returns HTTP 503 with a
non-sensitive unavailable response. This repository change does not claim a
live Neon or Render connection until those configured deployment checks are run.
