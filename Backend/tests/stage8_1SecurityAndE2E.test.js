import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import jwt from "jsonwebtoken";
import { app } from "../server.js";
import { generateAssessmentPdfBuffer } from "../services/pdfReportService.js";

const withServer = async (fn) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("public registration rejects clinician or admin role escalation with 403", async () => {
  await withServer(async (baseUrl) => {
    for (const attemptedRole of ["clinician", "admin", "superuser"]) {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test User",
          email: "test@example.com",
          password: "Password123!",
          role: attemptedRole
        })
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.ok(body.message.includes("patient"));
    }
  });
});

test("protected patient, clinician, summary, comparison, notification, and PDF routes reject missing or invalid JWT with 401", async () => {
  await withServer(async (baseUrl) => {
    const routes = [
      ["GET", "/api/patient/dashboard"],
      ["PATCH", "/api/patient/preferences"],
      ["GET", "/api/clinician/screenings"],
      ["GET", "/api/clinician/screenings/1"],
      ["POST", "/api/clinician/screenings/1/review"],
      ["GET", "/api/notifications"],
      ["GET", "/api/results/compare?a=1&b=2"],
      ["GET", "/api/screening/1/summary"],
      ["GET", "/api/screening/1/report.pdf"]
    ];

    for (const [method, path] of routes) {
      const noAuth = await fetch(`${baseUrl}${path}`, { method });
      assert.equal(noAuth.status, 401, `Expected 401 without token for ${method} ${path}`);

      const badAuth = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { Authorization: "Bearer invalid.jwt.token" }
      });
      assert.equal(badAuth.status, 401, `Expected 401 with invalid token for ${method} ${path}`);
    }
  });
});

test("patient JWT is blocked from all clinician endpoints with 403", async () => {
  const prevSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "stage8-1-test-secret";
  try {
    const patientToken = jwt.sign({ userId: 99, role: "patient" }, process.env.JWT_SECRET);
    await withServer(async (baseUrl) => {
      const endpoints = [
        ["GET", "/api/clinician/screenings"],
        ["GET", "/api/clinician/screenings/1"],
        ["POST", "/api/clinician/screenings/1/review"]
      ];
      for (const [method, path] of endpoints) {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { Authorization: `Bearer ${patientToken}` }
        });
        assert.equal(res.status, 403, `Expected 403 for patient on ${method} ${path}`);
      }
    });
  } finally {
    process.env.JWT_SECRET = prevSecret;
  }
});

test("PDF output has valid xref offset, multi-page pagination, and no internal server paths", () => {
  const recs = Array.from({ length: 16 }, (_, i) => ({
    id: `r${i}`,
    priority: "medium",
    title: `Finding (${i + 1}) \\ note`,
    message: "Long descriptive recommendation text that wraps cleanly across lines without overflowing."
  }));
  const buf = generateAssessmentPdfBuffer({
    screeningId: 505,
    patientLabel: "PARTICIPANT-505",
    assessmentDate: "2026-11-20",
    multimodalSummary: {
      completeness: { percent: 100, completedCount: 10, expectedCount: 10 },
      modalities: { cognitive: { experimentalIndicatorPercent: 85, rawScores: { memory: 80 } }, drawing: {}, voice: {} },
      recommendations: recs
    }
  });
  const text = buf.toString("utf8");
  assert.ok(text.startsWith("%PDF-1.4\n"));
  assert.ok(text.includes("Page 1 of 2"));
  assert.ok(text.includes("Page 2 of 2"));
  assert.equal(text.includes("D:\\"), false);
  assert.equal(text.includes("Backend/"), false);

  const match = text.match(/startxref\n(\d+)\n%%EOF/);
  assert.ok(match, "startxref offset must be present");
  const xrefPos = Number(match[1]);
  assert.equal(buf.subarray(xrefPos, xrefPos + 4).toString("utf8"), "xref");
});
