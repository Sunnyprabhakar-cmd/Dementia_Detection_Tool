import { getScreeningSummary } from "../services/screeningService.js";
import {
  buildAssessmentFeatureRecord,
  runPredictionModel
} from "../services/mlService.js";

export const predictRisk = async (req, res) => {
  const body = req.body;
  if (
    !body
    || typeof body !== "object"
    || Array.isArray(body)
    || Object.keys(body).some((key) => key !== "screeningId")
  ) {
    return res.status(400).json({
      status: "invalid_input",
      message: "Only screeningId is accepted; model features are read from saved tasks."
    });
  }

  const screeningId = Number(body.screeningId);
  if (!Number.isSafeInteger(screeningId) || screeningId <= 0) {
    return res.status(400).json({
      status: "invalid_input",
      message: "A valid screeningId is required."
    });
  }

  try {
    const summary = await getScreeningSummary(screeningId, req.user.userId);
    const features = buildAssessmentFeatureRecord(summary.taskResults);
    const result = await runPredictionModel(features);
    if (result.status === "invalid_input") {
      return res.status(400).json(result);
    }
    if (result.status === "unavailable") {
      return res.status(503).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    if (/not found/i.test(error.message)) {
      return res.status(404).json({
        status: "unavailable",
        message: "Assessment not found for this account."
      });
    }
    if (/complete these required tasks/i.test(error.message)) {
      return res.status(400).json({
        status: "unavailable",
        message: "Required assessment tasks are incomplete."
      });
    }
    return res.status(500).json({
      status: "unavailable",
      message: "Unable to run the research model."
    });
  }
};
