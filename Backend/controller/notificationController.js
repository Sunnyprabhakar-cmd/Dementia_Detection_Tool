import {
  listUserNotifications,
  markNotificationRead
} from "../services/notificationService.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await listUserNotifications(req.user.userId);
    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch notifications" });
  }
};

export const readNotification = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }
    const updated = await markNotificationRead(id, req.user.userId);
    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }
    return res.status(200).json({ notification: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update notification" });
  }
};
