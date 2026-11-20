import {
  buildAssessmentComparison,
  getPatientDashboardData,
  updatePatientPreferences
} from "../services/patientService.js";
import { getPersistedMultimodalSummary } from "../services/riskAssessmentService.js";

export const getPatientDashboardController = async (req, res) => {
  try {
    const dashboard = await getPatientDashboardData(req.user.userId);
    return res.status(200).json({ dashboard });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load patient dashboard" });
  }
};

export const updatePreferencesController = async (req, res) => {
  try {
    const updated = await updatePatientPreferences(req.user.userId, req.body || {});
    if (!updated) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user: updated });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to update preferences" });
  }
};

export const compareAssessmentsController = async (req, res) => {
  try {
    const idA = Number(req.query.a);
    const idB = Number(req.query.b);
    if (!Number.isSafeInteger(idA) || !Number.isSafeInteger(idB) || idA <= 0 || idB <= 0) {
      return res.status(400).json({ message: "Valid screening IDs 'a' and 'b' are required" });
    }
    const role = req.user.role || "patient";
    const [summaryA, summaryB] = await Promise.all([
      getPersistedMultimodalSummary(idA, req.user.userId, role),
      getPersistedMultimodalSummary(idB, req.user.userId, role)
    ]);
    const comparison = buildAssessmentComparison(summaryA, summaryB);
    return res.status(200).json({ comparison });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to compare assessments" });
  }
};
