import express from "express";
import { authMiddleware, requireRole } from "../middleware/authMiddleware.js";
import {
  getScreeningDetailForClinician,
  getScreeningsForClinician,
  postClinicianReview
} from "../controller/clinicianController.js";

const router = express.Router();

router.get("/screenings", authMiddleware, requireRole("clinician"), getScreeningsForClinician);
router.get("/screenings/:id", authMiddleware, requireRole("clinician"), getScreeningDetailForClinician);
router.post("/screenings/:id/review", authMiddleware, requireRole("clinician"), postClinicianReview);

export default router;
