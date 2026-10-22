import {
  createScreening,
  deleteScreening,
  getActiveScreening,
  getScreeningDetails,
  getScreeningSummary,
  saveTaskResponse,
  updatePatientProfile,
  upsertAssessmentResult
} from "../services/screeningService.js";
import { validatePatientProfile } from "../services/assessmentValidation.js";
import {
  buildCognitiveFeatureRecord,
  buildVoiceFeatureRecord,
  runPredictionModel
} from "../services/mlService.js";

export const startScreening = async (req, res) => {
  let patientProfile;
  try {
    patientProfile = validatePatientProfile(req.body?.patientProfile);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const userId = req.user.userId;
    const screening = await createScreening(userId, patientProfile);

    return res.status(201).json({
      message: "Screening started",
      screening
    });
  } catch (error) {
    console.error("Failed to start screening:", error.code || error.message || "unknown error");
    return res.status(500).json({
      message: "Failed to start screening"
    });
  }
};

export const getScreening = async (req, res) => {
  try {
    const screening = await getScreeningDetails(req.params.id, req.user.userId);
    return res.status(200).json({ screening });
  } catch (error) {
    return res.status(/not found/i.test(error.message) ? 404 : 400).json({
      message: error.message || "Unable to retrieve screening"
    });
  }
};

export const getActive = async (req, res) => {
  try {
    const screening = await getActiveScreening(req.user.userId);
    return res.status(200).json({ screening });
  } catch (error) {
    return res.status(500).json({ message: "Unable to retrieve active assessment" });
  }
};

export const updatePatient = async (req, res) => {
  let normalizedProfile;
  try {
    normalizedProfile = validatePatientProfile(req.body?.patientProfile);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const patientProfile = await updatePatientProfile(
      req.params.id,
      req.user.userId,
      normalizedProfile
    );
    return res.status(200).json({ patientProfile });
  } catch (error) {
    return res.status(/not found/i.test(error.message) ? 404 : 400).json({
      message: error.message || "Unable to update patient profile"
    });
  }
};

export const removeScreening = async (req, res) => {
  try {
    const result = await deleteScreening(req.params.id, req.user.userId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(/not found/i.test(error.message) ? 404 : 400).json({
      message: error.message || "Unable to delete screening"
    });
  }
};

export const submitResponse = async (req, res) => {
  try {
    const screeningId = req.params.id;
    const userId = req.user.userId;
    const { taskType, responseData, reactionTime } = req.body;

    if (!taskType || !responseData) {
      return res.status(400).json({
        message: "taskType and responseData are required"
      });
    }

    const response = await saveTaskResponse(screeningId, userId, taskType, responseData, reactionTime);

    return res.status(201).json({
      message: "Task response saved",
      response
    });
  } catch (error) {
    return res.status(/not found/i.test(error.message) ? 404 : 400).json({
      message: error.message || "Unable to save task response"
    });
  }
};

export const getScreeningResult = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = await getScreeningSummary(id, userId);
    const cognitivePrediction = await runPredictionModel(
      buildCognitiveFeatureRecord(result.taskResults),
      { modality: "cognitive_tasks" }
    );
    const voicePrediction = await runPredictionModel(
      buildVoiceFeatureRecord(result.taskResults),
      { modality: "speech" }
    );
    const assessmentRecord = await upsertAssessmentResult(id, userId, {
      ...result,
      modelOutput: cognitivePrediction,
      cognitivePrediction,
      voicePrediction,
      descriptiveTaskSummary: result.descriptiveTaskSummary,
      cognitiveTaskScore: result.cognitiveTaskScore,
      voiceAnalysisSummary: result.voiceAnalysisSummary,
      overallScore: result.overallScore,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      recommendation: result.recommendation,
      flags: result.flags,
      taskScores: result.taskScores
    });

    return res.status(200).json({
      message: "Assessment complete",
      result: {
        ...result,
        modelOutput: cognitivePrediction,
        cognitivePrediction,
        voicePrediction,
        assessmentRecord
      }
    });
  } catch (error) {
    console.error("Failed to complete screening:", error.code || error.message || "unknown error");
    return res.status(400).json({
      message: error.message
    });
  }
};