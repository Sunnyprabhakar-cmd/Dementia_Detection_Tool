import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { startScreening, submitResponse, getScreeningResult } from "../controller/screeningController.js";

const router = express.Router();

router.post("/start", authMiddleware, startScreening);
router.post("/:id/response", authMiddleware, submitResponse);
router.get("/:id/result", authMiddleware, getScreeningResult);

export default router;