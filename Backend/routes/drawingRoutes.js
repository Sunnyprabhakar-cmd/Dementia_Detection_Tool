import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  extractDrawingFeaturesController,
  getScreeningDrawingController,
  submitDrawingController,
  validateDrawingController
} from "../controller/drawingController.js";

const router = express.Router();

router.post("/:id/drawing", authMiddleware, submitDrawingController);
router.post("/:id/drawing/validate", authMiddleware, validateDrawingController);
router.post("/:id/drawing/features", authMiddleware, extractDrawingFeaturesController);
router.get("/:id/drawing", authMiddleware, getScreeningDrawingController);

export default router;
