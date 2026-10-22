
import { pool } from "../config/db.js";
import {
  calculateTappingMetrics,
  evaluateOrientation,
  validateClinicianObservation,
  validatePatientProfile,
  validateVoiceResponse
} from "./assessmentValidation.js";

const allowedTasks = [
  "memory",
  "attention",
  "language",
  "orientation",
  "voice",
  "motor_tapping",
  "clinician_observation"
];

const requiredTasks = [
  "memory",
  "attention",
  "orientation",
  "language"
];

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseId = (value, label = "ID") => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Invalid ${label}`);
  }

  return id;
};

const calculateScore = (taskType, data = {}) => {
  if (taskType === "memory") {
    const shown = Array.isArray(data.wordsShown)
      ? data.wordsShown.map((word) =>
          String(word).trim().toLowerCase()
        )
      : [];

    const recalled = Array.isArray(data.wordsRecalled)
      ? data.wordsRecalled.map((word) =>
          String(word).trim().toLowerCase()
        ).filter(Boolean)
      : [];

    const matches = new Set(
      recalled.filter((word) => shown.includes(word))
    );

    return shown.length
      ? (matches.size / shown.length) * 100
      : 0;
  }

  if (taskType === "attention") {
    const correct = Math.max(0, safeNumber(data.correct));
    const wrong = Math.max(0, safeNumber(data.wrong));
    const missed = Math.max(0, safeNumber(data.missed));
    const total = correct + wrong + missed;

    return total ? (correct / total) * 100 : 0;
  }

  if (taskType === "orientation") {
    return evaluateOrientation(data).score;
  }

  if (taskType === "motor_tapping") {
    calculateTappingMetrics(data);
  }

  if (taskType === "clinician_observation") {
    validateClinicianObservation(data);
  }

  // No validated composite score is defined for these task types.
  return null;
};

export const buildCognitiveTaskScore = (taskResults = {}) => {
  const supportedTasks = ["memory", "attention", "orientation"];
  const measured = supportedTasks
    .map((task) => {
      const score = taskResults[task]?.score;
      return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100
        ? { task, score }
        : null;
    })
    .filter(Boolean);
  const missing = supportedTasks.filter(
    (task) => !measured.some((entry) => entry.task === task)
  );
  return {
    status: measured.length === supportedTasks.length
      ? "complete"
      : measured.length
        ? "partial"
        : "unavailable",
    index_percent: measured.length
      ? Number((measured.reduce((sum, entry) => sum + entry.score, 0) / measured.length).toFixed(2))
      : null,
    included_tasks: measured.map(({ task }) => task),
    not_measured_tasks: missing,
    method: "Unweighted arithmetic mean of the available memory, attention, and orientation task percentages. Language is not included because the current task has no validated numeric scoring rule.",
    limitation: "Task-performance score only; not a validated instrument, diagnosis, clinical risk score, or probability."
  };
};

export const buildDescriptiveTaskSummary = buildCognitiveTaskScore;

const VOICE_COVERAGE_FIELDS = [
  "transcript_word_count",
  "sentence_count",
  "filler_word_count",
  "speech_rate_words_per_minute",
  "audio_duration_seconds",
  "pause_count",
  "mean_pause_seconds",
  "maximum_pause_seconds",
  "lexical_diversity",
  "adjacent_repeated_word_count"
];

export const buildVoiceAnalysisSummary = (voiceResult = {}) => {
  const features = voiceResult?.measurements?.speech_features?.features || {};
  const measuredFields = VOICE_COVERAGE_FIELDS.filter(
    (field) => typeof features[field] === "number" && Number.isFinite(features[field])
  );
  const status = voiceResult?.measurements?.status || voiceResult?.status || "not_assessed";
  const wordCount = features.transcript_word_count;
  const scoreComponents = {};
  if (typeof features.filler_word_ratio_percent === "number" && wordCount > 0) {
    scoreComponents.filler_control = Number(
      Math.max(0, 100 - features.filler_word_ratio_percent).toFixed(2)
    );
  }
  if (
    typeof features.adjacent_repeated_word_count === "number"
    && typeof wordCount === "number"
    && wordCount > 0
  ) {
    scoreComponents.repetition_control = Number(
      Math.max(0, 100 * (1 - Math.min(1, features.adjacent_repeated_word_count / wordCount))).toFixed(2)
    );
  }
  if (
    typeof features.pause_count === "number"
    && typeof wordCount === "number"
    && wordCount > 0
  ) {
    scoreComponents.pause_observation = Number(
      Math.max(0, 100 * (1 - Math.min(1, features.pause_count / wordCount))).toFixed(2)
    );
  }
  if (typeof features.lexical_diversity === "number") {
    scoreComponents.lexical_diversity = Number(
      (Math.max(0, Math.min(1, features.lexical_diversity)) * 100).toFixed(2)
    );
  }
  const availableComponents = Object.values(scoreComponents);
  return {
    status,
    score_percent: availableComponents.length
      ? Number((availableComponents.reduce((sum, value) => sum + value, 0) / availableComponents.length).toFixed(2))
      : null,
    score_components: scoreComponents,
    available_score_components: Object.keys(scoreComponents),
    feature_coverage_percent: VOICE_COVERAGE_FIELDS.length
      ? Number((measuredFields.length / VOICE_COVERAGE_FIELDS.length * 100).toFixed(2))
      : null,
    measured_fields: measuredFields,
    missing_fields: VOICE_COVERAGE_FIELDS.filter((field) => !measuredFields.includes(field)),
    method: "Experimental speech-fluency indicator: equal-weight arithmetic mean of available components only. Filler control = max(0, 100 - filler percentage); repetition control = 100 × (1 - adjacent repeated words / transcript words), capped at 0; pause observation = 100 × (1 - pause count / transcript words), capped at 0; lexical diversity = lexical diversity ratio × 100. Words per minute, duration, and pause durations remain descriptive measurements and are not assigned a better/worse direction.",
    limitation: "Experimental descriptive indicator only. It uses literal transcript and timing features, has no clinical threshold or validated weights, and is not a voice diagnosis, classifier, probability, or dementia score."
  };
};

export const createScreening = async (userId, inputProfile) => {
  const uid = parseId(userId, "user ID");
  const profile = validatePatientProfile(inputProfile);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO screening_sessions
         (user_id, status, started_at)
       VALUES ($1, 'in_progress', NOW())
       RETURNING id, user_id, status, started_at, completed_at`,
      [uid]
    );
    const screening = rows[0];

    await client.query(
      `INSERT INTO screening_patient_profiles
         (screening_id, patient_identifier, age, sex, education_years,
          handedness, socioeconomic_status, medical_history, medications,
          reported_symptoms, symptom_onset, functional_changes,
          family_history, consent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        screening.id,
        profile.patientIdentifier,
        profile.age,
        profile.sex,
        profile.educationYears,
        profile.handedness,
        profile.socioeconomicStatus,
        profile.medicalHistory,
        profile.medications,
        profile.reportedSymptoms,
        profile.symptomOnset,
        profile.functionalChanges,
        profile.familyHistory
      ]
    );
    await client.query("COMMIT");
    return screening;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const saveTaskResponse = async (
  screeningId,
  userId,
  taskType,
  responseData,
  reactionTime
) => {
  const sid = parseId(screeningId, "screening ID");
  const uid = parseId(userId, "user ID");

  if (!allowedTasks.includes(taskType)) {
    throw new Error("Invalid task type");
  }

  if (
    !responseData ||
    typeof responseData !== "object" ||
    Array.isArray(responseData)
  ) {
    throw new Error("responseData must be an object");
  }

  if (Buffer.byteLength(JSON.stringify(responseData), "utf8") > 50000) {
    throw new Error("Task response is too large");
  }

  let storedResponseData = responseData;
  if (taskType === "voice") {
    storedResponseData = validateVoiceResponse(responseData);
  } else if (taskType === "orientation") {
    storedResponseData = {
      ...responseData,
      orientationMetrics: evaluateOrientation(responseData)
    };
  } else if (taskType === "motor_tapping") {
    storedResponseData = calculateTappingMetrics(responseData);
  } else if (taskType === "clinician_observation") {
    storedResponseData = validateClinicianObservation(responseData);
  }

  const score = calculateScore(taskType, storedResponseData);
  const reaction = reactionTime == null
    ? null
    : Math.max(0, safeNumber(reactionTime));

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const session = await client.query(
      `SELECT id
       FROM screening_sessions
       WHERE id = $1
         AND user_id = $2
         AND status = 'in_progress'
       FOR UPDATE`,
      [sid, uid]
    );

    if (!session.rows.length) {
      throw new Error("Active screening not found for this user");
    }

    await client.query(
      `DELETE FROM task_responses
       WHERE screening_id = $1 AND task_type = $2`,
      [sid, taskType]
    );
    const { rows } = await client.query(
      `INSERT INTO task_responses
         (screening_id, task_type, response_data,
          score, reaction_time, created_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
       RETURNING id, screening_id, task_type, response_data,
                 score, reaction_time, created_at`,
      [
        sid,
        taskType,
        JSON.stringify(storedResponseData),
        score,
        reaction
      ]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getScreeningSummary = async (screeningId, userId) => {
  const sid = parseId(screeningId, "screening ID");
  const uid = parseId(userId, "user ID");

  const session = await pool.query(
    `SELECT id, status
     FROM screening_sessions
     WHERE id = $1 AND user_id = $2`,
    [sid, uid]
  );

  if (!session.rows.length) {
    throw new Error("Screening not found");
  }

  const { rows: tasks } = await pool.query(
    `SELECT DISTINCT ON (task_type)
       task_type, score, response_data, created_at
     FROM task_responses
     WHERE screening_id = $1
     ORDER BY task_type, created_at DESC, id DESC`,
    [sid]
  );
  const profileResult = await pool.query(
    `SELECT patient_identifier, age, sex
     FROM screening_patient_profiles
     WHERE screening_id = $1`,
    [sid]
  );

  const scores = {};
  const taskResults = {};

  for (const task of tasks) {
    taskResults[task.task_type] = {
      status: task.response_data?.status || "completed",
      score: task.score == null ? null : Number(task.score),
      measurements: task.response_data,
      timestamp: task.created_at
    };
    if (task.score !== null && task.score !== undefined) {
      scores[task.task_type] = Number(task.score);
    }
  }
  const cognitiveTaskScore = buildCognitiveTaskScore(taskResults);
  const voiceAnalysisSummary = buildVoiceAnalysisSummary(taskResults.voice);

  const completedTasks = new Set(tasks.map((task) => task.task_type));
  const missing = requiredTasks.filter((task) => !completedTasks.has(task));

  if (missing.length) {
    throw new Error(
      `Complete these required tasks first: ${missing.join(", ")}`
    );
  }

  return {
    screeningId: sid,
    overallScore: cognitiveTaskScore.index_percent,
    recommendation: "Discuss concerns with a qualified healthcare professional.",
    flags: [
      "Research and educational prototype; it cannot diagnose or rule out dementia.",
      "Digital task measurements are not validated clinical instruments."
    ],
    taskScores: scores,
    descriptiveTaskSummary: cognitiveTaskScore,
    cognitiveTaskScore,
    voiceAnalysisSummary,
    taskResults,
    completedTasks: [...completedTasks],
    optionalTasks: {
      voice: taskResults.voice?.measurements?.status || taskResults.voice?.status || "not_assessed",
      motor_tapping: taskResults.motor_tapping?.status || "not_assessed",
      clinician_observation: taskResults.clinician_observation?.status || "not_assessed"
    },
    patientReference: profileResult.rows[0] || null
  };
};

export const upsertAssessmentResult = async (
  screeningId,
  userId,
  payload = {}
) => {
  const sid = parseId(screeningId, "screening ID");
  const uid = parseId(userId, "user ID");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const session = await client.query(
      `SELECT id
       FROM screening_sessions
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [sid, uid]
    );

    if (!session.rows.length) {
      throw new Error("Screening not found for this user");
    }

    const taskScores = payload.taskScores || {};
    const storedTaskScores = {
      ...taskScores,
      ...(payload.descriptiveTaskSummary
        ? { __descriptiveTaskSummary: payload.descriptiveTaskSummary }
        : {}),
      ...(payload.cognitiveTaskScore
        ? { __cognitiveTaskScore: payload.cognitiveTaskScore }
        : {}),
      ...(payload.voiceAnalysisSummary
        ? { __voiceAnalysisSummary: payload.voiceAnalysisSummary }
        : {}),
      ...(payload.cognitivePrediction
        ? { __cognitivePrediction: payload.cognitivePrediction }
        : {}),
      ...(payload.voicePrediction
        ? { __voicePrediction: payload.voicePrediction }
        : {}),
      __modelOutput: payload.modelOutput || {
        status: "unavailable",
        code: "model_unavailable",
        model_version: null,
        output: null,
        evaluation_status: "not_run",
        missing_inputs: [],
        reason: "Model output was not requested.",
        limitations: [
          "Research/educational output only; not a diagnosis or clinical risk assessment."
        ]
      }
    };

    const nullableNumber = (value) => value == null ? null : safeNumber(value);
    const values = [
      nullableNumber(taskScores.memory),
      nullableNumber(taskScores.attention),
      nullableNumber(taskScores.language),
      nullableNumber(taskScores.orientation),
      nullableNumber(payload.overallScore),
      null,
      null,
      JSON.stringify(storedTaskScores),
      String(payload.recommendation || "Discuss concerns with a qualified healthcare professional."),
      JSON.stringify(Array.isArray(payload.flags) ? payload.flags : [])
    ];

    const existing = await client.query(
      `SELECT id
       FROM screening_results
       WHERE screening_id = $1`,
      [sid]
    );

    let result;

    if (existing.rows.length) {
      result = await client.query(
        `UPDATE screening_results
         SET memory_score = $2,
             attention_score = $3,
             language_score = $4,
             orientation_score = $5,
             overall_score = $6,
             risk_level = $7,
             risk_score = $8,
             task_scores = $9::jsonb,
             recommendation = $10,
             flags = $11::jsonb,
             created_at = NOW()
         WHERE screening_id = $1
         RETURNING *`,
        [sid, ...values]
      );
    } else {
      result = await client.query(
        `INSERT INTO screening_results
           (screening_id, memory_score, attention_score,
            language_score, orientation_score, overall_score,
            risk_level, risk_score, task_scores,
            recommendation, flags, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 $9::jsonb, $10, $11::jsonb, NOW())
         RETURNING *`,
        [sid, ...values]
      );
    }

    await client.query(
      `UPDATE screening_sessions
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [sid, uid]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getAssessmentHistory = async (userId) => {
  const uid = parseId(userId, "user ID");

  const { rows } = await pool.query(
    `SELECT
       r.id,
       r.screening_id,
       r.overall_score,
       r.risk_score,
       r.risk_level,
       r.recommendation,
       r.task_scores,
       r.flags,
       r.created_at
     FROM screening_results r
     JOIN screening_sessions s
       ON s.id = r.screening_id
     WHERE s.user_id = $1
     ORDER BY r.created_at DESC NULLS LAST, r.id DESC`,
    [uid]
  );

  return rows;
};

export const updatePatientProfile = async (screeningId, userId, inputProfile) => {
  const sid = parseId(screeningId, "screening ID");
  const uid = parseId(userId, "user ID");
  const profile = validatePatientProfile(inputProfile);
  const { rowCount } = await pool.query(
    `UPDATE screening_patient_profiles p
     SET patient_identifier = $3, age = $4, sex = $5,
         education_years = $6, handedness = $7,
         socioeconomic_status = $8, medical_history = $9,
         medications = $10, reported_symptoms = $11,
         symptom_onset = $12, functional_changes = $13,
         family_history = $14, consent_at = NOW(), updated_at = NOW()
     FROM screening_sessions s
     WHERE p.screening_id = $1 AND s.id = p.screening_id
       AND s.user_id = $2 AND s.status = 'in_progress'`,
    [
      sid, uid, profile.patientIdentifier, profile.age, profile.sex,
      profile.educationYears, profile.handedness,
      profile.socioeconomicStatus, profile.medicalHistory, profile.medications,
      profile.reportedSymptoms, profile.symptomOnset,
      profile.functionalChanges, profile.familyHistory
    ]
  );
  if (rowCount !== 1) throw new Error("Active screening not found for this user");
  return { screeningId: sid, ...profile };
};

export const getScreeningDetails = async (screeningId, userId) => {
  const sid = parseId(screeningId, "screening ID");
  const uid = parseId(userId, "user ID");
  const session = await pool.query(
    `SELECT id, status, started_at, completed_at
     FROM screening_sessions WHERE id = $1 AND user_id = $2`,
    [sid, uid]
  );
  if (!session.rows.length) throw new Error("Screening not found");

  const [profile, tasks] = await Promise.all([
    pool.query(
      `SELECT patient_identifier, age, sex, education_years, handedness,
              socioeconomic_status, medical_history, medications,
              reported_symptoms, symptom_onset, functional_changes,
              family_history, consent_at, updated_at
       FROM screening_patient_profiles WHERE screening_id = $1`,
      [sid]
    ),
    pool.query(
      `SELECT DISTINCT ON (task_type)
         task_type, response_data, score, reaction_time, created_at
       FROM task_responses WHERE screening_id = $1
       ORDER BY task_type, created_at DESC, id DESC`,
      [sid]
    )
  ]);

  return {
    session: session.rows[0],
    patientProfile: profile.rows[0] || null,
    tasks: tasks.rows
  };
};

export const getActiveScreening = async (userId) => {
  const uid = parseId(userId, "user ID");
  const { rows } = await pool.query(
    `SELECT id
     FROM screening_sessions
     WHERE user_id = $1 AND status = 'in_progress'
     ORDER BY started_at DESC, id DESC
     LIMIT 1`,
    [uid]
  );
  return rows.length ? getScreeningDetails(rows[0].id, uid) : null;
};

export const deleteScreening = async (screeningId, userId) => {
  const sid = parseId(screeningId, "screening ID");
  const uid = parseId(userId, "user ID");
  const { rowCount } = await pool.query(
    `DELETE FROM screening_sessions WHERE id = $1 AND user_id = $2`,
    [sid, uid]
  );
  if (rowCount !== 1) throw new Error("Screening not found for this user");
  return { screeningId: sid, deleted: true };
};
