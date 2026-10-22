import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVoiceTaskPayload,
  calculateSimulatedDementiaProbability,
  formatLocalAssessmentDate,
  formatPredictionScores,
  isRenderablePrediction,
  measureLanguageResponse,
  scoreMemoryResponses,
  summarizeAttentionTrials,
  summarizeModelOutput,
  summarizeTranscriptAnalysis
} from "../src/assessmentUtils.js";

test("orientation date uses the same local calendar date shown by the task", () => {
  assert.equal(formatLocalAssessmentDate(new Date(2026, 9, 22, 23, 59)), "2026-10-22");
  assert.equal(formatLocalAssessmentDate(new Date(Number.NaN)), null);
});

test("memory scoring is case-insensitive and does not award duplicates", () => {
  assert.deepEqual(
    scoreMemoryResponses(["Apple", "River"], [" apple ", "APPLE", "wrong"]),
    { correctCount: 1, wordsShown: 2, scorePercent: 50 }
  );
});

test("attention summary preserves missed and false responses and reports measured timing", () => {
  assert.deepEqual(summarizeAttentionTrials({
    correct: 3,
    wrong: 2,
    missed: 1,
    reactionTimesMs: [300, 500]
  }), {
    correct: 3,
    wrong: 2,
    missed: 1,
    reactionTimesMs: [300, 500],
    meanReactionTimeMs: 400,
    timingNote: "Browser and input-device latency are not calibrated."
  });
});

test("language metrics retain raw responses and split list entries", () => {
  const result = measureLanguageResponse({ sentence: "A line.", animals: "cat, dog\nbird" });
  assert.equal(result.animalResponseCount, 3);
  assert.equal(result.rawAnimals, "cat, dog\nbird");
});

test("report and history use the same explicit unavailable model state", () => {
  const fromReport = summarizeModelOutput({
    status: "unavailable",
    model_version: null,
    output: null,
    reason: "No compatible model artifact is installed.",
    missing_inputs: ["compatible_trained_model"]
  });
  const fromHistory = summarizeModelOutput({
    status: "unavailable",
    model_version: null,
    output: null,
    reason: "No compatible model artifact is installed.",
    missing_inputs: ["compatible_trained_model"]
  });

  assert.deepEqual(fromReport, fromHistory);
  assert.equal(fromReport.status, "unavailable");
  assert.equal(fromReport.modelVersion, null);
  assert.deepEqual(fromReport.missingInputs, ["compatible_trained_model"]);
});

test("model helper never promotes fabricated or absent output to available", () => {
  assert.equal(
    summarizeModelOutput({
      status: "available_research_only",
      output: null,
      model_version: "0.1.0"
    }).status,
    "unavailable"
  );
  assert.equal(summarizeModelOutput(null).status, "unavailable");
});

test("public report renders only a concrete successful prediction", () => {
  assert.equal(isRenderablePrediction({
    status: "available_research_only",
    output: { predicted_label: "Nondemented" }
  }), true);
  assert.equal(isRenderablePrediction({
    status: "available_research_only",
    output: null
  }), false);
  assert.equal(isRenderablePrediction({
    status: "unavailable",
    output: { predicted_label: "Demented" }
  }), false);
  assert.equal(isRenderablePrediction({
    status: "available_research_only",
    output: { predicted_label: "" }
  }), false);
});

test("prediction scores preserve the model class mapping", () => {
  assert.deepEqual(
    formatPredictionScores({
      Nondemented: 0.883848,
      Demented: 0.116152
    }),
    [
      { label: "Nondemented", score: 88.3848 },
      { label: "Demented", score: 11.6152 }
    ]
  );
});

test("simulated dementia probability maps only the cognitive score and clamps bounds", () => {
  assert.equal(calculateSimulatedDementiaProbability(16.65), 83.35);
  assert.equal(calculateSimulatedDementiaProbability(-5), 100);
  assert.equal(calculateSimulatedDementiaProbability(120), 0);
  assert.equal(calculateSimulatedDementiaProbability(null), null);
  assert.equal(calculateSimulatedDementiaProbability(Number.NaN), null);
});

test("voice report payload keeps descriptive features but never retains transcript text", () => {
  const payload = buildVoiceTaskPayload({
    status: "completed",
    duration: 12.5,
    transcript: "Sensitive transcript text",
    language: "en",
    speech_features: { status: "complete", features: { transcript_word_count: 4 } }
  });

  assert.deepEqual(payload, {
    recorded: true,
    status: "completed",
    responseTime: 12.5,
    language: "en",
    speech_features: { status: "complete", features: { transcript_word_count: 4 } },
    transcript_analysis: null
  });
  assert.equal("transcript" in payload, false);
});

test("saved speech observations contain literal counts but omit transcript text", () => {
  const analysis = summarizeTranscriptAnalysis({
    status: "complete",
    language: "en",
    transcript: "Sensitive synthetic transcript",
    observations: {
      word_count: 8,
      sentence_count: 2,
      average_words_per_sentence: 4,
      filler_word_counts: { um: 1 },
      repeated_adjacent_word_count: 0,
      repeated_short_phrase_count: 0,
      unique_word_ratio: 0.875,
      self_correction_marker_counts: { sorry: 1 },
      selected_vague_expression_counts: { thing: 2 }
    }
  });
  const payload = buildVoiceTaskPayload({
    status: "completed",
    transcript: "Sensitive synthetic transcript",
    transcript_analysis: {
      language: "en",
      status: "complete",
      transcript: "Sensitive synthetic transcript",
      observations: analysis.observations
    }
  });

  assert.equal(payload.transcript_analysis.observations.word_count, 8);
  assert.equal(payload.transcript_analysis.observations.filler_word_counts.um, 1);
  assert.equal("transcript" in payload.transcript_analysis, false);
  assert.doesNotMatch(JSON.stringify(payload), /Sensitive synthetic transcript/);
});

test("unmeasured English-only speech rules stay unavailable in saved observations", () => {
  const summary = summarizeTranscriptAnalysis({
    status: "complete",
    language: "ta",
    observations: {
      word_count: 5,
      sentence_count: 1,
      filler_word_counts: null,
      repeated_adjacent_word_count: 0,
      repeated_short_phrase_count: 0,
      unique_word_ratio: 1,
      self_correction_marker_counts: null,
      selected_vague_expression_counts: null
    },
    unavailable_observations: ["english_filler_counts"]
  });

  assert.equal(summary.observations.filler_word_counts, null);
  assert.equal(summary.observations.self_correction_marker_counts, null);
  assert.equal(summary.unavailable_observations[0], "english_filler_counts");
});
