import { getAssessmentHistory } from "../services/screeningService.js";

export const getScreeningHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const records = await getAssessmentHistory(userId);

    const history = records.map((entry) => ({
      id: entry.screening_id,
      screeningId: entry.screening_id,
      timestamp: entry.created_at,
      overview: "Digital task report",
      score: null,
      overall: entry.overall_score == null ? null : Number(entry.overall_score),
      cognitiveTaskScore: entry.task_scores?.__cognitiveTaskScore || entry.task_scores?.__descriptiveTaskSummary || null,
      voiceAnalysisSummary: entry.task_scores?.__voiceAnalysisSummary || null,
      cognitivePrediction: entry.task_scores?.__cognitivePrediction || entry.task_scores?.__modelOutput || null,
      voicePrediction: entry.task_scores?.__voicePrediction || null,
      modelOutput: entry.task_scores?.__modelOutput || {
        status: "unavailable",
        code: "model_unavailable",
        model_version: null,
        output: null,
        evaluation_status: "not_run",
        missing_inputs: [],
        reason: "No model output was saved for this assessment.",
        limitations: [
          "Research/educational output only; not a diagnosis or clinical risk assessment."
        ]
      },
      recommendation: entry.recommendation || "Research prototype; not a diagnosis."
    }));

    return res.status(200).json({
      message: "Assessment history retrieved",
      history
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to fetch history"
    });
  }
};
