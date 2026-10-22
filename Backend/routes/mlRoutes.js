import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getDemoReport } from "../controller/demoController.js";
import { predictRisk } from "../controller/mlController.js";

const router = express.Router();

router.get("/demo-report", getDemoReport);
router.post("/predict", authMiddleware, predictRisk);

export default router;
