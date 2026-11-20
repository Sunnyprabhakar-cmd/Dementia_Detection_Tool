import { pool } from "../config/db.js";
import { createNotification } from "./notificationService.js";

export const isClinicianAuthorizedForScreening = async (clinicianId, screeningId) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id AS patient_id
     FROM screening_sessions s
     JOIN clinician_patient_assignments cpa
       ON cpa.patient_id = s.user_id AND cpa.clinician_id = $1
     WHERE s.id = $2
     LIMIT 1`,
    [Number(clinicianId), Number(screeningId)]
  );
  return rows[0] || null;
};

export const listPatientScreenings = async ({ clinicianId, filter = "all", q = "", limit = 50 } = {}) => {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const search = String(q || "").trim();
  const params = [Number(clinicianId), safeLimit];
  const conditions = ["cpa.clinician_id = $1"];

  if (filter === "incomplete") {
    conditions.push("s.status = 'in_progress'");
  } else if (filter === "recent") {
    conditions.push("s.started_at >= NOW() - INTERVAL '14 days'");
  } else if (filter === "pending_review") {
    conditions.push("r.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clinician_reviews cr WHERE cr.screening_id = s.id AND cr.review_status = 'reviewed')");
  }

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(`(p.patient_identifier ILIKE $${idx} OR u.name ILIKE $${idx})`);
  }

  const { rows } = await pool.query(
    `SELECT
       s.id AS screening_id,
       s.user_id AS patient_id,
       s.status,
       s.started_at,
       s.completed_at,
       u.name AS patient_name,
       p.patient_identifier,
       p.age,
       p.sex,
       r.overall_score,
       r.recommendation,
       r.task_scores->'__multimodalSummary'->'completeness'->>'percent' AS completeness_percent,
       (SELECT cr.review_status FROM clinician_reviews cr WHERE cr.screening_id = s.id ORDER BY cr.created_at DESC LIMIT 1) AS review_status,
       r.created_at AS result_at
     FROM screening_sessions s
     JOIN clinician_patient_assignments cpa ON cpa.patient_id = s.user_id
     JOIN users u ON u.id = s.user_id
     LEFT JOIN screening_patient_profiles p ON p.screening_id = s.id
     LEFT JOIN screening_results r ON r.screening_id = s.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.started_at DESC, s.id DESC
     LIMIT $2`,
    params
  );
  return rows;
};

export const getClinicianScreeningDetail = async (screeningId, clinicianId) => {
  const sid = Number(screeningId);
  if (!Number.isSafeInteger(sid) || sid <= 0) {
    throw new Error("Invalid screening ID");
  }
  const authorized = await isClinicianAuthorizedForScreening(clinicianId, sid);
  if (!authorized) {
    const err = new Error("Not authorized to access this patient screening");
    err.statusCode = 403;
    throw err;
  }

  const [session, profile, tasks, result, reviews] = await Promise.all([
    pool.query("SELECT id, user_id, status, started_at, completed_at FROM screening_sessions WHERE id = $1", [sid]),
    pool.query("SELECT * FROM screening_patient_profiles WHERE screening_id = $1", [sid]),
    pool.query(
      `SELECT DISTINCT ON (task_type) task_type, score, reaction_time, response_data, created_at
       FROM task_responses WHERE screening_id = $1 ORDER BY task_type, created_at DESC, id DESC`,
      [sid]
    ),
    pool.query("SELECT * FROM screening_results WHERE screening_id = $1", [sid]),
    pool.query(
      `SELECT cr.id, cr.notes, cr.review_status, cr.follow_up_recommended, cr.created_at, u.name AS clinician_name
       FROM clinician_reviews cr JOIN users u ON u.id = cr.clinician_id
       WHERE cr.screening_id = $1 ORDER BY cr.created_at DESC`,
      [sid]
    )
  ]);
  if (!session.rows.length) return null;
  return {
    session: session.rows[0],
    patientProfile: profile.rows[0] || null,
    tasks: tasks.rows,
    result: result.rows[0] || null,
    reviews: reviews.rows
  };
};

export const addClinicianReview = async (
  screeningId,
  clinicianId,
  { notes, reviewStatus = "reviewed", followUpRecommended = false }
) => {
  const sid = Number(screeningId);
  if (!Number.isSafeInteger(sid) || sid <= 0) throw new Error("Invalid screening ID");
  const authorized = await isClinicianAuthorizedForScreening(clinicianId, sid);
  if (!authorized) {
    const err = new Error("Not authorized to review this patient screening");
    err.statusCode = 403;
    throw err;
  }
  const cleanNotes = String(notes || "").trim();
  if (!cleanNotes) throw new Error("Review notes are required");
  const status = ["pending", "in_review", "reviewed"].includes(reviewStatus) ? reviewStatus : "reviewed";

  const { rows } = await pool.query(
    `INSERT INTO clinician_reviews (screening_id, clinician_id, patient_id, notes, review_status, follow_up_recommended)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, screening_id, clinician_id, patient_id, notes, review_status, follow_up_recommended, created_at`,
    [sid, clinicianId, authorized.patient_id, cleanNotes.slice(0, 2000), status, Boolean(followUpRecommended)]
  );

  try {
    await createNotification(authorized.patient_id, {
      title: "Clinician review updated",
      message: `A clinician has added observations to screening #${sid} (status: ${status}).`,
      type: "clinician_review"
    });
  } catch {
    // Non-blocking notification failure
  }

  return rows[0];
};
