import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getNotifications, readNotification } from "../controller/notificationController.js";

const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.patch("/:id/read", authMiddleware, readNotification);

export default router;
