import {
  generateAndPersistMultimodalSummary,
  getPersistedMultimodalSummary
} from "../services/riskAssessmentService.js";
import { generateAssessmentPdfBuffer } from "../services/pdfReportService.js";
import { pool } from "../config/db.js";

export const createMultimodalSummaryController = async (req, res) => {
  try {
    const summary = await generateAndPersistMultimodalSummary(
      req.params.id,
      req.user.userId,
      req.user.role || "patient"
    );
    return res.status(200).json({ summary });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message || "Unable to generate assessment summary" });
  }
};

export const getMultimodalSummaryController = async (req, res) => {
  try {
    const summary = await getPersistedMultimodalSummary(
      req.params.id,
      req.user.userId,
      req.user.role || "patient"
    );
    return res.status(200).json({ summary });
  } catch (error) {
    return res.status(error.statusCode || 404).json({ message: error.message || "Assessment summary not found" });
  }
};

export const getModalityFindingsController = async (req, res) => {
  try {
    const summary = await getPersistedMultimodalSummary(
      req.params.id,
      req.user.userId,
      req.user.role || "patient"
    );
    return res.status(200).json({
      screeningId: summary.screeningId,
      modalities: summary.modalities,
      findings: summary.findings
    });
  } catch (error) {
    return res.status(404).json({ message: error.message || "Modality findings not found" });
  }
};

export const getRecommendationsController = async (req, res) => {
  try {
    const summary = await getPersistedMultimodalSummary(
      req.params.id,
      req.user.userId,
      req.user.role || "patient"
    );
    return res.status(200).json({
      screeningId: summary.screeningId,
      recommendationEngineVersion: summary.recommendationEngineVersion,
      recommendations: summary.recommendations
    });
  } catch (error) {
    return res.status(404).json({ message: error.message || "Recommendations not found" });
  }
};

export const getCompletenessController = async (req, res) => {
  try {
    const summary = await getPersistedMultimodalSummary(
      req.params.id,
      req.user.userId,
      req.user.role || "patient"
    );
    return res.status(200).json({
      screeningId: summary.screeningId,
      completeness: summary.completeness
    });
  } catch (error) {
    return res.status(404).json({ message: error.message || "Assessment completeness not found" });
  }
};

export const downloadPdfReportController = async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const role = req.user.role || "patient";
    const summary = await getPersistedMultimodalSummary(sid, req.user.userId, role);

    const [profileRes, reviewsRes] = await Promise.all([
      pool.query(
        "SELECT patient_identifier, created_at FROM screening_patient_profiles WHERE screening_id = $1",
        [sid]
      ),
      pool.query(
        `SELECT cr.notes, cr.review_status, cr.created_at, u.name AS clinician_name
         FROM clinician_reviews cr JOIN users u ON u.id = cr.clinician_id
         WHERE cr.screening_id = $1 ORDER BY cr.created_at DESC`,
        [sid]
      )
    ]);

    const pdfBuffer = generateAssessmentPdfBuffer({
      screeningId: sid,
      patientLabel: profileRes.rows[0]?.patient_identifier || "Study Participant",
      assessmentDate: summary.generatedAt || profileRes.rows[0]?.created_at || null,
      multimodalSummary: summary,
      clinicianReviews: reviewsRes.rows || []
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="mindscan-report-${sid}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return res.status(error.statusCode || 404).json({ message: error.message || "Unable to generate PDF report" });
  }
};
