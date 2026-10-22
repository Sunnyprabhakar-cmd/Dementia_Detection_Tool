import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "..", "ml", "feature_schema.json");

export const assessmentFeatureSchema = JSON.parse(
  fs.readFileSync(schemaPath, "utf8")
);

if (
  assessmentFeatureSchema.schema_version !== 1
  || !assessmentFeatureSchema.modalities
  || !Array.isArray(assessmentFeatureSchema.modalities.cognitive_tasks?.features)
  || !Array.isArray(assessmentFeatureSchema.modalities.speech?.features)
) {
  throw new Error("The shared assessment feature schema is invalid.");
}

export const featureNamesByModality = Object.fromEntries(
  Object.entries(assessmentFeatureSchema.modalities).map(([modality, definition]) => [
    modality,
    definition.features.map(({ name }) => name)
  ])
);

export const allAssessmentFeatureNames = new Set(
  Object.values(featureNamesByModality).flat()
);
