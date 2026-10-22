import test from "node:test";
import assert from "node:assert/strict";
import { analyzeScreeningWithAgents } from "../controller/aiController.js";
import { predictRisk } from "../controller/mlController.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("ML endpoint rejects caller-supplied feature values", async () => {
  const response = responseRecorder();
  await predictRisk(
    { body: { screeningId: 7, features: { Age: 70 } }, user: { userId: 1 } },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.status, "invalid_input");
  assert.match(response.body.message, /saved tasks/i);
});

test("unvalidated heuristic risk interpretation is explicitly unavailable", async () => {
  const response = responseRecorder();
  await analyzeScreeningWithAgents(
    { body: { screeningId: "test", riskScore: 90 } },
    response
  );

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.status, "unavailable");
  assert.match(response.body.message, /not clinically validated/i);
});
