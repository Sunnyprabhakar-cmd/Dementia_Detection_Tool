import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateDelayedMemory,
  evaluateDigitSpan,
  evaluatePatternRecognition,
  evaluatePictureRecognition,
  validateClockDrawing
} from "../services/assessmentValidation.js";
import { requireRole } from "../middleware/authMiddleware.js";

test("delayed memory scores unique recalled words and tracks intrusions/skips", () => {
  const result = evaluateDelayedMemory({
    wordsShown: ["APPLE", "RIVER", "WINDOW", "MANGO", "GARDEN"],
    wordsRecalled: ["apple", "mango", "extra", "", ""]
  });
  assert.equal(result.correctCount, 2);
  assert.equal(result.intrusionCount, 1);
  assert.equal(result.skippedCount, 2);
  assert.equal(result.score, 40);
});

test("digit span evaluates forward and backward spans and skipped trials", () => {
  const result = evaluateDigitSpan({
    trials: [
      { expected: "381", response: "381", direction: "forward" },
      { expected: "7294", response: "7294", direction: "forward" },
      { expected: "592", response: "295", direction: "backward" },
      { expected: "6184", response: "", direction: "backward", skipped: true }
    ]
  });
  assert.equal(result.correctCount, 2);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.maxForwardSpan, 4);
  assert.equal(result.maxBackwardSpan, 0);
  assert.equal(result.score, 50);
});

test("picture recognition computes true/false positives and score", () => {
  const result = evaluatePictureRecognition({
    items: [
      { id: "house", isTarget: true, selected: true },
      { id: "tree", isTarget: true, selected: false },
      { id: "car", isTarget: false, selected: true },
      { id: "boat", isTarget: false, selected: false }
    ]
  });
  assert.equal(result.correctCount, 2);
  assert.equal(result.truePositives, 1);
  assert.equal(result.falsePositives, 1);
  assert.equal(result.falseNegatives, 1);
  assert.equal(result.score, 50);
});

test("pattern recognition scores completed and skipped items", () => {
  const result = evaluatePatternRecognition({
    items: [
      { expected: "16", answer: "16" },
      { expected: "25", answer: "24" },
      { expected: "36", answer: "", skipped: true }
    ]
  });
  assert.equal(result.correctCount, 1);
  assert.equal(result.incorrectCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.score, 33.33);
});

test("clock drawing validates geometric analysis and skipped state", () => {
  const completed = validateClockDrawing({
    targetTime: "11:10",
    completionTimeSeconds: 22.5,
    strokeCount: 14,
    imageAnalysis: {
      circularity_score: 0.9,
      quadrant_balance_score: 0.85,
      outer_ring_ink_ratio: 0.3,
      inner_hand_ink_ratio: 0.15
    }
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.score, 91.25);

  const skipped = validateClockDrawing({ skipped: true, skipReason: "Motor difficulty" });
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.score, null);
});

test("requireRole middleware enforces clinician vs patient access", () => {
  const mw = requireRole("clinician");
  let nextCalled = false;
  mw({ user: { userId: 1, role: "clinician" } }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  let statusCode = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json() { return this; }
  };
  mw({ user: { userId: 2, role: "patient" } }, res, () => {});
  assert.equal(statusCode, 403);
});
