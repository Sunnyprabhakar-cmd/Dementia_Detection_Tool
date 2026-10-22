import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getScreeningHistory } from "../controller/resultController.js";

const router = express.Router();

router.get("/history", authMiddleware, getScreeningHistory);

export default router;