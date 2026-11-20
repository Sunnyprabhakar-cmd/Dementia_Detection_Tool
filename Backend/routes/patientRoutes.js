import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getPatientDashboardController,
  updatePreferencesController
} from "../controller/patientController.js";

const router = express.Router();

router.get("/dashboard", authMiddleware, getPatientDashboardController);
router.patch("/preferences", authMiddleware, updatePreferencesController);

export default router;
