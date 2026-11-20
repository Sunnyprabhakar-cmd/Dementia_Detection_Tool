import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDrawingSubmission, parseImageDataUrl, submitClockDrawing } from "../services/drawingService.js";

// Minimal valid 1x1 PNG signature check + 80x80 clock PNG generated via Python or test helper
test("parseImageDataUrl rejects invalid or non-PNG/JPEG inputs", () => {
  assert.throws(() => parseImageDataUrl("not-a-data-url"));
  assert.throws(() => parseImageDataUrl("data:image/gif;base64,R0lGODlh"));
  // Valid PNG header but wrong bytes
  assert.throws(() => parseImageDataUrl("data:image/png;base64,AAAA"));
});

test("submitClockDrawing supports skipped state without running analyzer", async () => {
  let savedArgs = null;
  const fakeSaver = async (sid, uid, taskType, responseData, reactionTime) => {
    savedArgs = { sid, uid, taskType, responseData, reactionTime };
    return { id: 1, task_type: taskType, response_data: responseData };
  };
  const result = await submitClockDrawing(
    10,
    2,
    { skipped: true, skipReason: "Tremor", completionTimeSeconds: 4.5 },
    { saver: fakeSaver }
  );
  assert.equal(result.task_type, "clock_drawing");
  assert.equal(savedArgs.responseData.skipped, true);
  assert.equal(savedArgs.reactionTime, 4.5);
});

test("analyzeDrawingSubmission invokes drawing analyzer and returns spatial features", async () => {
  // Valid PNG header (89 50 4E 47 0D 0A 1A 0A)
  const fakePngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString("base64");
  const fakeAnalyzer = async ({ imagePath, strokesPath, completionTimeSeconds }) => {
    assert.ok(imagePath.endsWith(".png"));
    assert.ok(strokesPath.endsWith(".json"));
    assert.equal(completionTimeSeconds, 19.2);
    return {
      status: "complete",
      method: "transparent_rule_based_cv_heuristics",
      limitation: "Not a clinical diagnosis.",
      features: { circularity_score: 0.88, quadrant_balance_score: 0.82 }
    };
  };

  const res = await analyzeDrawingSubmission(
    {
      imageDataUrl: `data:image/png;base64,${fakePngBase64}`,
      strokes: [{ points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }],
      completionTimeSeconds: 19.2
    },
    { runAnalyzer: fakeAnalyzer }
  );
  assert.equal(res.status, "complete");
  assert.equal(res.features.circularity_score, 0.88);
});
