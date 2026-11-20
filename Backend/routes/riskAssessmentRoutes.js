import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createMultimodalSummaryController,
  downloadPdfReportController,
  getCompletenessController,
  getModalityFindingsController,
  getMultimodalSummaryController,
  getRecommendationsController
} from "../controller/riskAssessmentController.js";

const router = express.Router();

router.post("/:id/summary", authMiddleware, createMultimodalSummaryController);
router.get("/:id/summary", authMiddleware, getMultimodalSummaryController);
router.get("/:id/summary/modalities", authMiddleware, getModalityFindingsController);
router.get("/:id/summary/recommendations", authMiddleware, getRecommendationsController);
router.get("/:id/summary/completeness", authMiddleware, getCompletenessController);
router.get("/:id/report.pdf", authMiddleware, downloadPdfReportController);

export default router;
