import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTappingMetrics,
  evaluateOrientation,
  validateClinicianObservation,
  validatePatientProfile,
  validateVoiceResponse
} from "../services/assessmentValidation.js";

test("patient intake requires valid age and explicit consent", () => {
  assert.throws(() => validatePatientProfile({ age: "", consent: true }), /Age is required/);
  assert.throws(() => validatePatientProfile({ age: 72, consent: false }), /Consent is required/);
  assert.equal(validatePatientProfile({ age: "72", consent: true }).age, 72);
});

test("orientation checks date, month, and year against the supplied local date", () => {
  const metrics = evaluateOrientation({
    assessmentDate: "2026-10-22",
    locale: "en",
    year: "2026",
    month: "Oct",
    date: "22",
    place: "home"
  });
  assert.equal(metrics.correctCount, 3);
  assert.equal(metrics.placeReported, true);
  assert.equal(evaluateOrientation({
    assessmentDate: "2026-10-22",
    locale: "en",
    year: "2024",
    month: "September",
    date: "21"
  }).score, 0);
});

test("tapping metrics preserve timestamps and reject accidental double clicks", () => {
  const metrics = calculateTappingMetrics({
    timestampsMs: [100, 150, 420, 1450],
    durationSeconds: 2,
    hand: "left",
    inputDevice: "touch",
    completed: true
  });
  assert.equal(metrics.tapCount, 3);
  assert.equal(metrics.rejectedDoubleClicks, 1);
  assert.equal(metrics.pausesOverOneSecond, 1);
  assert.deepEqual(metrics.timestampsMs, [100, 150, 420, 1450]);
});

test("clinician form distinguishes skipped and not-assessed observations", () => {
  assert.throws(() => validateClinicianObservation({ skipped: true }), /reason is required/);
  const observation = validateClinicianObservation({
    skipped: false,
    observationDate: "2026-10-22",
    assessorRole: "Clinician",
    observations: { reflexes: "unable_to_assess" }
  });
  assert.equal(observation.observations.reflexes, "unable_to_assess");
  assert.equal(observation.observations.tremor, "not_assessed");
});

test("voice response retains safe observations but rejects transcript persistence", () => {
  const safe = validateVoiceResponse({
    recorded: true,
    status: "completed",
    responseTime: 8,
    language: "en",
    speech_features: {
      status: "partial",
      features: { transcript_word_count: 8, speech_rate_words_per_minute: null },
      transcription_model: "fixture"
    },
    transcript_analysis: {
      status: "complete",
      language: "en",
      observations: {
        word_count: 8,
        sentence_count: 2,
        average_words_per_sentence: 4,
        filler_word_counts: { um: 1 },
        repeated_adjacent_word_count: 0,
        repeated_short_phrase_count: 0,
        unique_word_ratio: 0.875,
        self_correction_marker_counts: { sorry: 0 },
        selected_vague_expression_counts: { thing: 1 }
      },
      unavailable_observations: []
    }
  });

  assert.equal(safe.transcript_analysis.observations.word_count, 8);
  assert.equal(safe.speech_features.features.transcript_word_count, 8);
  assert.equal("transcript" in safe, false);
  assert.equal("transcription_model" in safe.speech_features, false);
  assert.throws(() => validateVoiceResponse({
    recorded: true,
    status: "completed",
    responseTime: 8,
    language: "en",
    transcript: "Synthetic transcript must not be stored."
  }), /unsupported fields/);
  assert.throws(() => validateVoiceResponse({
    recorded: true,
    status: "completed",
    responseTime: 8,
    language: "en",
    speech_features: {
      status: "complete",
      features: { transcript: "Synthetic nested transcript" }
    }
  }), /unsupported fields/);
});
