import test from "node:test";
import assert from "node:assert/strict";
import { getDemoReport } from "../controller/demoController.js";
import { buildSyntheticDemoReport, isDemoModeEnabled } from "../services/demoService.js";

const withEnvironment = async (values, action) => {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, values);
  try {
    await action();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("demo mode requires explicit development opt-in", () => {
  assert.equal(isDemoModeEnabled({ MINDSCAN_DEMO_MODE: "true", NODE_ENV: "development" }), true);
  assert.equal(isDemoModeEnabled({ MINDSCAN_DEMO_MODE: "false", NODE_ENV: "development" }), false);
  assert.equal(isDemoModeEnabled({ MINDSCAN_DEMO_MODE: "true", NODE_ENV: "production" }), false);
});

test("synthetic report uses deterministic fixtures and cannot be confused with model output", () => {
  const first = buildSyntheticDemoReport();
  const second = buildSyntheticDemoReport();

  assert.deepEqual(first, second);
  assert.equal(first.simulated, true);
  assert.equal(first.modelOutput.status, "simulated_demo");
  assert.equal(first.modelOutput.evaluation_status, "not_evaluated");
  assert.equal(first.modelOutput.output.demo_label, "SIMULATED_EXAMPLE_ONLY");
  assert.equal(first.derivedFeatures.memory_recall_count, 3);
  assert.equal(first.derivedFeatures.voice_transcript_word_count, null);
  assert.match(first.taskResults.voice.measurements.transcript, /Synthetic transcript fixture/);
  assert.equal(Object.hasOwn(first, "assessmentRecord"), false);
  assert.equal(Object.hasOwn(first, "screeningId"), false);
});

test("demo endpoint is disabled by default and does not persist demo reports", async () => {
  await withEnvironment(
    { MINDSCAN_DEMO_MODE: "false", NODE_ENV: "development" },
    async () => {
      const disabledResponse = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        }
      };
      getDemoReport({}, disabledResponse);
      assert.equal(disabledResponse.statusCode, 404);
      assert.equal(disabledResponse.body.status, "unavailable");
    }
  );

  await withEnvironment(
    { MINDSCAN_DEMO_MODE: "true", NODE_ENV: "development" },
    async () => {
      const response = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        }
      };
      getDemoReport({}, response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.status, "simulated_demo");
      assert.equal(response.body.report.simulated, true);
      assert.equal(Object.hasOwn(response.body.report, "assessmentRecord"), false);
    }
  );
});
