import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { predictRisk } from "../controller/mlController.js";

const router = express.Router();

router.post("/predict", authMiddleware, predictRisk);

export default router;
