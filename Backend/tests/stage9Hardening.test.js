import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { app, validateStartupConfiguration } from "../server.js";
import { createRateLimiter } from "../middleware/securityMiddleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

test("security headers are applied and X-Powered-By is disabled", async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
    assert.equal(res.headers.get("x-powered-by"), null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("rate limiter returns 429 when threshold is exceeded", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  const req = { ip: "127.0.0.1" };
  let nextCount = 0;
  let lastStatus = null;
  const res = {
    status(c) { lastStatus = c; return this; },
    json() { return this; }
  };

  limiter(req, res, () => { nextCount += 1; });
  limiter(req, res, () => { nextCount += 1; });
  limiter(req, res, () => { nextCount += 1; });

  assert.equal(nextCount, 2);
  assert.equal(lastStatus, 429);
});

test("production startup configuration requires JWT_SECRET", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevJwt = process.env.JWT_SECRET;
  const prevDbUrl = process.env.DATABASE_URL;
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "";
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/mindscan";
  try {
    const errors = validateStartupConfiguration();
    assert.ok(errors.some((e) => e.includes("JWT_SECRET")));
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.JWT_SECRET = prevJwt;
    process.env.DATABASE_URL = prevDbUrl;
  }
});

test("Dockerfiles and docker-compose.yml exist without hardcoded secrets", () => {
  const files = [
    path.join(repoRoot, ".dockerignore"),
    path.join(repoRoot, "docker-compose.yml"),
    path.join(repoRoot, "Backend", "Dockerfile"),
    path.join(repoRoot, "Frontend", "Dockerfile"),
    path.join(repoRoot, "Frontend", "nginx.conf")
  ];
  for (const f of files) {
    assert.ok(fs.existsSync(f), `Expected deployment file: ${f}`);
  }
  const compose = fs.readFileSync(path.join(repoRoot, "docker-compose.yml"), "utf8");
  assert.ok(compose.includes("${DB_PASSWORD:?Set DB_PASSWORD in .env}"));
  assert.ok(compose.includes("${JWT_SECRET:?Set JWT_SECRET in .env}"));
});
