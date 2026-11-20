# Stage 1: Install production Node dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app/Backend
COPY Backend/package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production runtime with Python ML/preprocessing support
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv curl \
  && rm -rf /var/lib/apt/lists/*

COPY Backend/ml/requirements-training.txt /app/Backend/ml/requirements-training.txt
RUN python3 -m venv /app/.venv \
  && /app/.venv/bin/pip install --no-cache-dir -r /app/Backend/ml/requirements-training.txt

COPY --from=deps /app/Backend/node_modules /app/Backend/node_modules
COPY Backend /app/Backend
COPY artifacts /app/artifacts

RUN groupadd --system mindscan && useradd --system --gid mindscan mindscan \
  && chown -R mindscan:mindscan /app

USER mindscan
WORKDIR /app/Backend

ENV NODE_ENV=production
ENV PORT=3001
ENV PYTHON_EXECUTABLE=/app/.venv/bin/python

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "server.js"]
