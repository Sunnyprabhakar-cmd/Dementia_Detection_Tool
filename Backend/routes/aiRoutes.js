import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { analyzeScreeningWithAgents } from "../controller/aiController.js";

const router = express.Router();

router.post("/analyze", authMiddleware, analyzeScreeningWithAgents);

export default router;
