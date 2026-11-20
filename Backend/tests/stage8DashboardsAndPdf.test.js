import assert from "node:assert/strict";
import test from "node:test";
import { buildAssessmentPdfLines, generateAssessmentPdfBuffer } from "../services/pdfReportService.js";
import { buildAssessmentComparison } from "../services/patientService.js";
import { requireRole } from "../middleware/authMiddleware.js";

test("PDF generator produces valid multi-page PDF 1.4 buffer and escapes special characters", () => {
  const longRecommendations = Array.from({ length: 18 }, (_, i) => ({
    id: `rec_${i}`,
    priority: "medium",
    title: `Recommendation ${i + 1} (test\\escape)`,
    message: "This is a detailed non-diagnostic research recommendation line that wraps across lines to verify multi-page pagination."
  }));

  const pdfBuffer = generateAssessmentPdfBuffer({
    screeningId: 101,
    patientLabel: "STUDY-101 (Safe)",
    assessmentDate: "2026-11-20",
    multimodalSummary: {
      engineVersion: "multimodal-heuristic/1.0.0",
      recommendationEngineVersion: "recommendation-rules/1.0.0",
      completeness: { percent: 90, completedCount: 9, expectedCount: 10, missingTasks: ["voice"], skippedTasks: [] },
      modalities: {
        cognitive: { experimentalIndicatorPercent: 84, rawScores: { memory: 80, attention: 88 } },
        drawing: { availability: "available", experimentalIndicatorPercent: 85, rawMetrics: { circularity_score: 0.9, quadrant_balance_score: 0.85, drawing_completeness_score: 0.9 } },
        voice: { availability: "not_assessed", language: "unknown", qualityWarnings: [] }
      },
      recommendations: longRecommendations
    },
    clinicianReviews: [
      { review_status: "reviewed", created_at: "2026-11-20", clinician_name: "Dr. Rao", notes: "Consistent attention." }
    ]
  });

  const pdfText = pdfBuffer.toString("utf8");
  assert.ok(pdfText.startsWith("%PDF-1.4\n"));
  assert.ok(pdfText.trimEnd().endsWith("%%EOF"));
  assert.ok(pdfText.includes("Page 1 of 2"));
  assert.ok(pdfText.includes("Page 2 of 2"));
  assert.ok(pdfText.includes("\\(test\\\\escape\\)"));
  assert.ok(pdfText.includes("NOT a medical diagnosis"));
});

test("buildAssessmentPdfLines includes required disclaimers and sections", () => {
  const lines = buildAssessmentPdfLines({ screeningId: 5 });
  const joined = lines.map((l) => l.text).join("\n");
  assert.ok(joined.includes("1. ASSESSMENT COMPLETENESS"));
  assert.ok(joined.includes("2. COGNITIVE ASSESSMENT FINDINGS"));
  assert.ok(joined.includes("8. ENGINE VERSIONS & LIMITATIONS"));
});

test("assessment comparison computes deltas without diagnostic claims", () => {
  const comp = buildAssessmentComparison(
    {
      screeningId: 1,
      generatedAt: "2026-11-01",
      completeness: { percent: 80 },
      modalities: {
        cognitive: { experimentalIndicatorPercent: 70 },
        drawing: { experimentalIndicatorPercent: 75 },
        voice: { experimentalIndicatorPercent: null }
      }
    },
    {
      screeningId: 2,
      generatedAt: "2026-11-20",
      completeness: { percent: 100 },
      modalities: {
        cognitive: { experimentalIndicatorPercent: 78 },
        drawing: { experimentalIndicatorPercent: 80 },
        voice: { experimentalIndicatorPercent: 82 }
      }
    }
  );
  assert.equal(comp.changes.completenessDeltaPercent, 20);
  assert.equal(comp.changes.cognitiveIndicatorDelta, 8);
  assert.equal(comp.changes.drawingIndicatorDelta, 5);
  assert.equal(comp.changes.voiceIndicatorDelta, null);
});

test("requireRole blocks patient access to clinician endpoints with 403", () => {
  const guard = requireRole("clinician");
  let code = null;
  let body = null;
  const res = {
    status(c) { code = c; return this; },
    json(b) { body = b; return this; }
  };
  guard({ user: { userId: 10, role: "patient" } }, res, () => {});
  assert.equal(code, 403);
  assert.ok(body.message.includes("Access denied"));
});
