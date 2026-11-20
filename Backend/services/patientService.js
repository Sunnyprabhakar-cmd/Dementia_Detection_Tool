import { pool } from "../config/db.js";
import { getActiveScreening, getAssessmentHistory } from "./screeningService.js";
import { listUserNotifications } from "./notificationService.js";

export const getPatientDashboardData = async (userId) => {
  const uid = Number(userId);
  const [userRes, activeScreening, history, notifications] = await Promise.all([
    pool.query(
      "SELECT id, name, email, role, preferred_language, created_at FROM users WHERE id = $1",
      [uid]
    ),
    getActiveScreening(uid),
    getAssessmentHistory(uid),
    listUserNotifications(uid)
  ]);

  const user = userRes.rows[0] || null;
  const latestResult = history[0] || null;
  const unreadNotifications = notifications.filter((n) => !n.is_read).length;

  return {
    profile: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferred_language || "en",
      createdAt: user.created_at
    } : null,
    activeScreening: activeScreening ? {
      screeningId: activeScreening.session.id,
      startedAt: activeScreening.session.started_at,
      completedTaskCount: activeScreening.tasks.length,
      completedTasks: activeScreening.tasks.map((t) => t.task_type)
    } : null,
    latestSummary: latestResult?.task_scores?.__multimodalSummary || null,
    historyCount: history.length,
    unreadNotifications
  };
};

export const updatePatientPreferences = async (userId, { name, preferredLanguage }) => {
  const uid = Number(userId);
  const cleanLang = typeof preferredLanguage === "string" && ["en", "si", "ta"].includes(preferredLanguage.trim())
    ? preferredLanguage.trim()
    : null;
  const cleanName = typeof name === "string" && name.trim().length >= 2
    ? name.trim().slice(0, 100)
    : null;

  const { rows } = await pool.query(
    `UPDATE users
     SET preferred_language = COALESCE($2, preferred_language),
         name = COALESCE($3, name)
     WHERE id = $1
     RETURNING id, name, email, role, preferred_language`,
    [uid, cleanLang, cleanName]
  );
  return rows[0] || null;
};

export const buildAssessmentComparison = (summaryA, summaryB) => {
  if (!summaryA || !summaryB) {
    throw new Error("Two assessment summaries are required for comparison");
  }
  const cogA = summaryA.modalities?.cognitive?.experimentalIndicatorPercent ?? null;
  const cogB = summaryB.modalities?.cognitive?.experimentalIndicatorPercent ?? null;
  const drawA = summaryA.modalities?.drawing?.experimentalIndicatorPercent ?? null;
  const drawB = summaryB.modalities?.drawing?.experimentalIndicatorPercent ?? null;
  const voiceA = summaryA.modalities?.voice?.experimentalIndicatorPercent ?? null;
  const voiceB = summaryB.modalities?.voice?.experimentalIndicatorPercent ?? null;

  const delta = (a, b) => (typeof a === "number" && typeof b === "number" ? Number((b - a).toFixed(2)) : null);

  return {
    baselineScreeningId: summaryA.screeningId,
    comparisonScreeningId: summaryB.screeningId,
    baselineDate: summaryA.generatedAt || null,
    comparisonDate: summaryB.generatedAt || null,
    changes: {
      completenessDeltaPercent: delta(summaryA.completeness?.percent, summaryB.completeness?.percent),
      cognitiveIndicatorDelta: delta(cogA, cogB),
      drawingIndicatorDelta: delta(drawA, drawB),
      voiceIndicatorDelta: delta(voiceA, voiceB)
    },
    note: "Descriptive measurement differences between two sessions only. Changes do not automatically indicate clinical deterioration or improvement."
  };
};
