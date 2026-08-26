import { memoryDbStore } from "../config/db.js";

const allowedTasks = ["memory", "attention", "language", "orientation", "voice"];

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const calculateScore = (taskType, responseData) => {
  if (taskType === "memory") {
    const wordsShown = Array.isArray(responseData.wordsShown) ? responseData.wordsShown.map((word) => String(word).toLowerCase()) : [];
    const wordsRecalled = Array.isArray(responseData.wordsRecalled) ? responseData.wordsRecalled.map((word) => String(word).trim().toLowerCase()).filter(Boolean) : [];
    const matches = [...new Set(wordsRecalled.filter((word) => wordsShown.includes(word)))];
    return wordsShown.length ? (matches.length / wordsShown.length) * 100 : 0;
  }

  if (taskType === "attention") {
    const correct = safeNumber(responseData.correct, 0);
    const wrong = safeNumber(responseData.wrong, 0);
    const missed = safeNumber(responseData.missed, 0);
    const total = correct + wrong + missed;
    return total ? (correct / total) * 100 : 0;
  }

  if (taskType === "orientation") {
    const fields = [responseData.date, responseData.month, responseData.year, responseData.place];
    const valid = fields.filter(Boolean).length;
    return (valid / fields.length) * 100;
  }

  if (taskType === "language") {
    const sentence = String(responseData.sentence || "").trim();
    const animals = String(responseData.animals || "").trim();
    const sentenceScore = sentence ? 50 : 0;
    const animalWords = animals ? animals.split(/\s+/).filter(Boolean).length : 0;
    const animalScore = animalWords >= 4 ? 50 : (animalWords / 4) * 50;
    return sentenceScore + animalScore;
  }

  if (taskType === "voice") {
    if (responseData && responseData.recorded) {
      return 100;
    }
    return 0;
  }

  return 0;
};

export const createScreening = async (userId) => {
  const screening = {
    id: `screen_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    user_id: userId,
    created_at: new Date().toISOString()
  };

  memoryDbStore.screenings.push(screening);
  return screening;
};

export const upsertAssessmentResult = async (screeningId, userId, payload = {}) => {
  const screening = memoryDbStore.screenings.find((entry) => entry.id === screeningId && entry.user_id === userId);
  if (!screening) {
    memoryDbStore.screenings.push({
      id: screeningId,
      user_id: userId,
      created_at: new Date().toISOString()
    });
  }

  const existing = memoryDbStore.assessmentResults.find((entry) => entry.screening_id === screeningId && entry.user_id === userId);
  const record = {
    id: existing?.id || `result_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    screening_id: screeningId,
    user_id: userId,
    overall_score: safeNumber(payload.overallScore, 0),
    risk_score: safeNumber(payload.riskScore, 0),
    risk_level: payload.riskLevel || 'Low risk',
    recommendation: payload.recommendation || 'Routine monitoring',
    task_scores: payload.taskScores || {},
    flags: Array.isArray(payload.flags) ? payload.flags : [],
    created_at: new Date().toISOString(),
    idempotency_key: `${screeningId}:${userId}`
  };

  if (existing) {
    const index = memoryDbStore.assessmentResults.findIndex((entry) => entry.screening_id === screeningId && entry.user_id === userId);
    memoryDbStore.assessmentResults[index] = { ...existing, ...record };
    return memoryDbStore.assessmentResults[index];
  }

  memoryDbStore.assessmentResults.push(record);
  return record;
};

export const getAssessmentHistory = async (userId) => {
  return memoryDbStore.assessmentResults
    .filter((entry) => entry.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const saveTaskResponse = async (screeningId, userId, taskType, responseData, reactionTime) => {
  const screening = memoryDbStore.screenings.find((entry) => entry.id === screeningId && entry.user_id === userId);
  if (!screening) {
    throw new Error("Screening not found");
  }

  if (!allowedTasks.includes(taskType)) {
    throw new Error("Invalid task type");
  }

  const score = calculateScore(taskType, responseData);
  const record = {
    id: `response_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    screening_id: screeningId,
    user_id: userId,
    task_type: taskType,
    response_data: responseData,
    score,
    reaction_time: safeNumber(reactionTime, 0),
    created_at: new Date().toISOString()
  };

  memoryDbStore.taskResponses.push(record);
  return record;
};

export const getScreeningSummary = async (screeningId, userId) => {
  const screening = memoryDbStore.screenings.find((entry) => entry.id === screeningId && entry.user_id === userId);
  if (!screening) {
    throw new Error("Screening not found");
  }

  const tasks = memoryDbStore.taskResponses.filter((entry) => entry.screening_id === screeningId && entry.user_id === userId);
  if (!tasks.length) {
    throw new Error("No assessment data available");
  }

  const scores = tasks.reduce((acc, task) => {
    acc[task.task_type] = task.score;
    return acc;
  }, {});

  const overallScore = Math.round(
    (
      (scores.memory || 0) * 0.35 +
      (scores.attention || 0) * 0.25 +
      (scores.orientation || 0) * 0.2 +
      (scores.language || 0) * 0.2
    )
  );

  let riskScore = 100 - overallScore;
  if ((scores.memory || 0) < 50) riskScore += 10;
  if ((scores.attention || 0) < 60) riskScore += 8;
  if ((scores.orientation || 0) < 70) riskScore += 7;
  if ((scores.language || 0) < 60) riskScore += 9;

  riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));

  let riskLevel = "Low risk";
  let recommendation = "Continue routine monitoring";
  let flags = ["Performance remains within normal expectation."];

  if (riskScore >= 60) {
    riskLevel = "High risk";
    recommendation = "Referred for specialist clinical evaluation";
    flags = [
      "Noticeable cognitive decline pattern detected.",
      "Memory and language performance are below expected baseline.",
      "Clinical follow-up is recommended for confirmatory testing."
    ];
  } else if (riskScore >= 35) {
    riskLevel = "Moderate risk";
    recommendation = "Repeat assessment and schedule review";
    flags = [
      "Some domains are below expected norm.",
      "Mild cognitive concern detected."
    ];
  }

  return {
    screeningId,
    overallScore,
    riskScore,
    riskLevel,
    recommendation,
    flags,
    taskScores: scores
  };
};