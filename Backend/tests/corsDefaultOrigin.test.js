import test from "node:test";
import assert from "node:assert/strict";

test("production startup accepts the built-in frontend origin when CORS_ORIGIN is omitted", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCorsOrigin = process.env.CORS_ORIGIN;
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET ||= "cors-test-secret";
  process.env.DATABASE_URL ||= "postgresql://test:test@example.test/test";
  delete process.env.CORS_ORIGIN;

  try {
    const { validateStartupConfiguration } = await import("../server.js");
    assert.equal(
      validateStartupConfiguration().some((error) => error.includes("CORS_ORIGIN")),
      false
    );
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previousCorsOrigin;
  }
});
