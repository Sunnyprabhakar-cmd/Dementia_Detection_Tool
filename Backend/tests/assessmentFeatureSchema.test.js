import test from "node:test";
import assert from "node:assert/strict";
import { assessmentFeatureSchema } from "../services/assessmentFeatureSchema.js";
import { featureNamesByModality } from "../services/mlService.js";

test("the shared model schema documents exactly the API feature contract", () => {
  assert.equal(assessmentFeatureSchema.schema_version, 1);
  for (const [modality, definition] of Object.entries(assessmentFeatureSchema.modalities)) {
    assert.deepEqual(
      definition.features.map(({ name }) => name),
      featureNamesByModality[modality]
    );
  }
  assert.equal(featureNamesByModality.cognitive_tasks.length, 10);
  assert.equal(featureNamesByModality.speech.length, 14);
  assert.equal(
    Object.values(featureNamesByModality).flat().some((name) => /(^|_)(cdr|mmse|age|etiv|diagnos)/i.test(name)),
    false
  );
});
