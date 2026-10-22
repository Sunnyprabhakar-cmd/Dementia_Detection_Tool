export const scoreMemoryResponses = (wordsShown, wordsRecalled) => {
  const expected = new Set(
    (Array.isArray(wordsShown) ? wordsShown : [])
      .map((word) => String(word).trim().toLocaleLowerCase())
      .filter(Boolean)
  );
  const recalled = (Array.isArray(wordsRecalled) ? wordsRecalled : [])
    .map((word) => String(word).trim().toLocaleLowerCase())
    .filter(Boolean);
  const correctWords = new Set(recalled.filter((word) => expected.has(word)));
  return {
    correctCount: correctWords.size,
    wordsShown: expected.size,
    scorePercent: expected.size ? Math.round((correctWords.size / expected.size) * 100) : null
  };
};

export const formatLocalAssessmentDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const summarizeAttentionTrials = (trials = {}) => {
  const correct = Number.isInteger(trials.correct) ? trials.correct : 0;
  const wrong = Number.isInteger(trials.wrong) ? trials.wrong : 0;
  const missed = Number.isInteger(trials.missed) ? trials.missed : 0;
  const reactionTimesMs = Array.isArray(trials.reactionTimesMs)
    ? trials.reactionTimesMs.filter((value) => Number.isFinite(value) && value >= 0)
    : [];
  return {
    correct,
    wrong,
    missed,
    reactionTimesMs,
    meanReactionTimeMs: reactionTimesMs.length
      ? Number((reactionTimesMs.reduce((sum, value) => sum + value, 0) / reactionTimesMs.length).toFixed(2))
      : null,
    timingNote: "Browser and input-device latency are not calibrated."
  };
};

export const measureLanguageResponse = ({ sentence = "", animals = "" } = {}) => {
  const animalResponses = String(animals)
    .split(/[,;\n]/)
    .map((animal) => animal.trim())
    .filter(Boolean);
  return {
    sentenceCharacterCount: String(sentence).trim().length,
    animalResponseCount: animalResponses.length,
    rawSentence: String(sentence),
    rawAnimals: String(animals)
  };
};

export const summarizeModelOutput = (modelOutput) => {
  if (modelOutput?.status !== "available_research_only" || !modelOutput.output) {
    return {
      status: "unavailable",
      modelVersion: modelOutput?.model_version || null,
      reason: modelOutput?.reason
        || modelOutput?.message
        || "No compatible model was run for this assessment.",
      missingInputs: Array.isArray(modelOutput?.missing_inputs)
        ? modelOutput.missing_inputs
        : []
    };
  }

  return {
    status: "available_research_only",
    modelVersion: modelOutput.model_version || null,
    reason: null,
    missingInputs: []
  };
};

export const isRenderablePrediction = (prediction) => Boolean(
  prediction?.status === "available_research_only"
  && prediction.output
  && typeof prediction.output === "object"
  && typeof prediction.output.predicted_label === "string"
  && prediction.output.predicted_label.trim()
);

export const formatPredictionScores = (classScores = {}) =>
  Object.entries(classScores)
    .filter(([, score]) => typeof score === "number" && Number.isFinite(score))
    .map(([label, score]) => ({
      label,
      score: score >= 0 && score <= 1 ? score * 100 : score
    }));

export const calculateSimulatedDementiaProbability = (cognitiveTaskPerformanceScore) => {
  if (typeof cognitiveTaskPerformanceScore !== "number"
    || !Number.isFinite(cognitiveTaskPerformanceScore)) {
    return null;
  }
  const clampedScore = Math.min(100, Math.max(0, cognitiveTaskPerformanceScore));
  return Number((100 - clampedScore).toFixed(2));
};

const safeObservationCounts = (values, allowedNames) => {
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  return Object.fromEntries(
    Object.entries(values).filter(([name, count]) =>
      allowedNames.includes(name) && Number.isInteger(count) && count >= 0
    )
  );
};

export const summarizeTranscriptAnalysis = (analysis) => {
  if (!analysis || typeof analysis !== "object") return null;
  const source = analysis.observations;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const count = (value) => Number.isInteger(value) && value >= 0 ? value : null;
  const boundedNumber = (value, maximum = Number.POSITIVE_INFINITY) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
      ? value
      : null;

  return {
    status: ["complete", "very_short", "empty", "transcription_error"].includes(analysis.status)
      ? analysis.status
      : "unavailable",
    language: typeof analysis.language === "string" ? analysis.language.slice(0, 16) : "unknown",
    observations: {
      word_count: count(source.word_count),
      sentence_count: count(source.sentence_count),
      average_words_per_sentence: boundedNumber(source.average_words_per_sentence),
      filler_word_counts: safeObservationCounts(
        source.filler_word_counts,
        ["ah", "er", "erm", "hmm", "uh", "um"]
      ),
      repeated_adjacent_word_count: count(source.repeated_adjacent_word_count),
      repeated_short_phrase_count: count(source.repeated_short_phrase_count),
      unique_word_ratio: boundedNumber(source.unique_word_ratio, 1),
      self_correction_marker_counts: safeObservationCounts(
        source.self_correction_marker_counts,
        ["i mean", "let me rephrase", "no wait", "or rather", "sorry"]
      ),
      selected_vague_expression_counts: safeObservationCounts(
        source.selected_vague_expression_counts,
        ["some kind of", "some sort of", "somewhere", "something", "stuff", "thing", "things", "whatever"]
      )
    },
    unavailable_observations: Array.isArray(analysis.unavailable_observations)
      ? analysis.unavailable_observations.filter((item) => typeof item === "string").slice(0, 10)
      : []
  };
};

export const buildVoiceTaskPayload = (assessment = {}) => {
  const allowedStatuses = new Set(["completed", "empty", "unavailable", "not_assessed"]);
  const status = allowedStatuses.has(assessment.status) ? assessment.status : "unavailable";
  return {
    recorded: status === "completed" || status === "empty",
    status,
    responseTime: Number.isFinite(assessment.duration) && assessment.duration > 0
      ? assessment.duration
      : null,
    language: typeof assessment.language === "string" && assessment.language
      ? assessment.language
      : "unknown",
    speech_features: assessment.speech_features && typeof assessment.speech_features === "object"
      ? assessment.speech_features
      : null,
    transcript_analysis: summarizeTranscriptAnalysis(assessment.transcript_analysis)
  };
};
