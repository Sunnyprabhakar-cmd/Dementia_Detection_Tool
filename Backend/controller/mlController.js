import { runPredictionModel } from "../services/mlService.js";

export const predictRisk = async (req, res) => {
  try {
    const record = req.body || {};
    const prediction = await runPredictionModel(record);

    return res.status(200).json({
      message: "Prediction completed using the trained tabular baseline",
      prediction
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Prediction failed"
    });
  }
};
