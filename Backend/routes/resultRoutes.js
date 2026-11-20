import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getScreeningHistory } from "../controller/resultController.js";
import { getDrawingHistoryController } from "../controller/drawingController.js";
import { compareAssessmentsController } from "../controller/patientController.js";

const router = express.Router();

router.get("/history", authMiddleware, getScreeningHistory);
router.get("/drawing-history", authMiddleware, getDrawingHistoryController);
router.get("/compare", authMiddleware, compareAssessmentsController);

export default router;