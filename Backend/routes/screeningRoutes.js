import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getScreening,
  getActive,
  getScreeningResult,
  startScreening,
  submitResponse,
  removeScreening,
  updatePatient
} from "../controller/screeningController.js";

const router = express.Router();

router.post("/start", authMiddleware, startScreening);
router.get("/active", authMiddleware, getActive);
router.get("/:id", authMiddleware, getScreening);
router.put("/:id/patient", authMiddleware, updatePatient);
router.post("/:id/response", authMiddleware, submitResponse);
router.get("/:id/result", authMiddleware, getScreeningResult);
router.delete("/:id", authMiddleware, removeScreening);

export default router;