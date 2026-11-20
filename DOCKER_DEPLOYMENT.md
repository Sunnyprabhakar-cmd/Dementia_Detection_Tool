# Docker Deployment Guide — MindScan AI (`DOCKER_DEPLOYMENT.md`)

## 1. Architecture Services (`docker-compose.yml`)
- **`postgres` (`postgres:16-alpine`):** Persistent `pgdata` volume, `pg_isready` healthcheck.
- **`backend` (`Backend/Dockerfile`):** Multi-stage Node 22 + Python 3 `.venv` (`requirements-training.txt`), non-root `mindscan` user, `/api/health` Docker `HEALTHCHECK`.
- **`frontend` (`Frontend/Dockerfile`):** Multi-stage Vite build served via `nginxinc/nginx-unprivileged:1.27-alpine` on port `8080` with SPA fallback and security headers (`Frontend/nginx.conf`).

*(RabbitMQ and Redis are intentionally omitted because the application uses synchronous HTTP + bounded Python subprocesses.)*

## 2. Running Locally with Docker
1. Create a root `.env` with `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN=http://localhost:8080`, `VITE_API_URL=http://localhost:3001`.
2. Build and start:
   ```powershell
   docker compose up -d --build
   ```
3. Run migrations inside the backend container:
   ```powershell
   docker compose exec backend npm run migrate
   ```
