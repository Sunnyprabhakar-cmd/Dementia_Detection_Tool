import { runMultiAgentAnalysis } from "../services/aiService.js";

export const analyzeScreeningWithAgents = async (req, res) => {
  try {
    const { screeningId, taskScores, riskScore, overallScore } = req.body;

    if (!screeningId) {
      return res.status(400).json({ message: "Screening ID is required" });
    }

    const result = runMultiAgentAnalysis(taskScores || {}, riskScore || 0, overallScore || 0);

    return res.status(200).json({
      message: "Multi-agent analysis completed",
      result
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "AI analysis failed"
    });
  }
};
