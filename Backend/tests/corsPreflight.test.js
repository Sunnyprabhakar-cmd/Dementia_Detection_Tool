import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

process.env.NODE_ENV = "production";
process.env.CORS_ORIGIN = "https://dementia-detection-tool.vercel.app";
process.env.JWT_SECRET ||= "cors-test-secret";
process.env.DATABASE_URL ||= "postgresql://test:test@example.test/test";

const { app } = await import("../server.js");

const request = (server, options) => new Promise((resolve, reject) => {
  const req = http.request({ ...options, port: server.address().port }, (res) => {
    res.resume();
    res.on("end", () => resolve(res));
  });
  req.on("error", reject);
  req.end();
});

test("results history preflight allows the deployed frontend and auth headers", async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await request(server, {
      method: "OPTIONS",
      path: "/api/results/history",
      headers: {
        Origin: "https://dementia-detection-tool.vercel.app",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization, Content-Type"
      }
    });

    assert.equal(response.statusCode, 204);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "https://dementia-detection-tool.vercel.app"
    );
    assert.match(response.headers["access-control-allow-methods"], /GET/);
    assert.match(response.headers["access-control-allow-methods"], /OPTIONS/);
    assert.match(response.headers["access-control-allow-headers"], /Authorization/);
    assert.match(response.headers["access-control-allow-headers"], /Content-Type/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
