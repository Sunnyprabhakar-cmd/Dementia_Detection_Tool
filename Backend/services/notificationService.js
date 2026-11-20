import { pool } from "../config/db.js";

export const listUserNotifications = async (userId) => {
  const { rows } = await pool.query(
    `SELECT id, title, message, type, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
};

export const createNotification = async (userId, { title, message, type = "info" }) => {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, message, type, is_read, created_at`,
    [userId, String(title).slice(0, 160), String(message), String(type).slice(0, 40)]
  );
  return rows[0];
};

export const markNotificationRead = async (notificationId, userId) => {
  const { rows } = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING id, title, message, type, is_read, created_at`,
    [notificationId, userId]
  );
  return rows[0] || null;
};
