import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  deleteImagingController,
  getScreeningScansController,
  uploadImagingController
} from "../controller/imagingController.js";

const router = express.Router();

router.post(
  "/upload",
  authMiddleware,
  express.raw({ type: () => true, limit: "50mb" }),
  uploadImagingController
);
router.get("/screening/:id", authMiddleware, getScreeningScansController);
router.delete("/:scanId", authMiddleware, deleteImagingController);

export default router;
