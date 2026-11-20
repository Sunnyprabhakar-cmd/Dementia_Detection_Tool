import assert from "node:assert/strict";
import test from "node:test";
import { buildMultimodalAssessmentSummary, STAGE10_6_DISCLAIMER } from "../services/riskAssessmentService.js";
import { buildAssessmentPdfLines, generateAssessmentPdfBuffer } from "../services/pdfReportService.js";
import { validateVoiceResponse } from "../services/assessmentValidation.js";

test("Stage 10.6 complete assessment computes Assessment Performance Score and separates speech prediction", () => {
  const summary = buildMultimodalAssessmentSummary({
    screeningId: 101,
    taskResults: {
      memory: { status: "completed", score: 80 },
      delayed_memory: { status: "completed", score: 100 },
      digit_span: { status: "completed", score: 75 },
      picture_recognition: { status: "completed", score: 100 },
      pattern_recognition: { status: "completed", score: 75 },
      orientation: { status: "completed", score: 100 },
      attention: { status: "completed", score: 65 },
      language: { status: "completed", measurements: { sentence: "The sun rises.", measurements: { animalResponseCount: 14, sentenceCharacterCount: 14 } } },
      clock_drawing: {
        status: "completed",
        score: 82,
        measurements: {
          completionTimeSeconds: 21,
          imageAnalysis: { circularity_score: 0.9, quadrant_balance_score: 0.85, drawing_completeness_score: 0.9 }
        }
      },
      voice: {
        status: "completed",
        measurements: {
          status: "completed",
          language: "en",
          quality_reliable: true,
          speech_features: { features: { speech_rate_words_per_minute: 145, pause_count: 3 } },
          acoustic_classifier_poc: {
            status: "available_experimental_poc",
            classification_outcome: "Non-dementia",
            model_version: "dementianet-acoustic-v1.0.0",
            model_name: "logistic_regression",
            dataset: "DementiaNet",
            prediction: {
              predicted_label: "nodementia",
              class_scores: { nodementia: 0.697, dementia: 0.303 },
              scores_are_calibrated_probabilities: false
            },
            decision_threshold: {
              threshold_version: "dementianet-val-default-0.50/v1.0",
              cutoff: 0.5,
              clinically_validated: false,
              status_label: "Experimental classification — threshold not clinically validated"
            }
          }
        }
      }
    },
    voiceAnalysisSummary: { score_percent: 85 }
  });

  assert.equal(summary.completeness.percent, 100);
  assert.equal(summary.assessmentPerformanceScore.score, 85);
  assert.equal(summary.assessmentPerformanceScore.measuredTaskCount, 7);
  assert.equal(summary.modalities.voice.experimentalSpeechClassifier.classificationOutcome, "Non-dementia");
  assert.equal(summary.modalities.voice.experimentalSpeechClassifier.scoresAreCalibratedProbabilities, false);
  assert.equal(summary.disclaimer, STAGE10_6_DISCLAIMER);

  const pdfLines = buildAssessmentPdfLines({ screeningId: 101, multimodalSummary: summary }).map((l) => l.text).join(" ");
  assert.match(pdfLines, /Assessment Performance Score: 85\/100/);
  assert.match(pdfLines, /Experimental Speech Model Prediction: Non-dementia/);
  assert.match(pdfLines, /threshold not clinically validated/);
  assert.match(pdfLines, /must not be used to diagnose or exclude dementia/);
  const pdfBuf = generateAssessmentPdfBuffer({ screeningId: 101, multimodalSummary: summary });
  assert.ok(pdfBuf.subarray(0, 8).toString("utf8").startsWith("%PDF-1.4"));
});

test("Stage 10.6 excludes skipped and missing tasks and handles Inconclusive / Dementia / Model unavailable", () => {
  const inconclusiveSummary = buildMultimodalAssessmentSummary({
    screeningId: 102,
    taskResults: {
      memory: { status: "completed", score: 80 },
      delayed_memory: { status: "skipped", score: null, measurements: { skipped: true } },
      voice: {
        status: "completed",
        measurements: {
          status: "completed",
          language: "hi",
          quality_reliable: false,
          acoustic_classifier_poc: {
            status: "unavailable",
            classification_outcome: "Inconclusive",
            model_version: "dementianet-acoustic-v1.0.0",
            missing_inputs: ["english_speech_required"]
          }
        }
      }
    }
  });

  assert.equal(inconclusiveSummary.assessmentPerformanceScore.score, 80);
  assert.equal(inconclusiveSummary.assessmentPerformanceScore.measuredTaskCount, 1);
  assert.equal(inconclusiveSummary.modalities.voice.experimentalSpeechClassifier.classificationOutcome, "Inconclusive");

  const dementiaSummary = buildMultimodalAssessmentSummary({
    screeningId: 103,
    taskResults: {
      voice: {
        status: "completed",
        measurements: {
          status: "completed",
          language: "en",
          acoustic_classifier_poc: {
            status: "available_experimental_poc",
            classification_outcome: "Dementia",
            prediction: { predicted_label: "dementia", class_scores: { nodementia: 0.37, dementia: 0.63 }, scores_are_calibrated_probabilities: false }
          }
        }
      }
    }
  });
  assert.equal(dementiaSummary.assessmentPerformanceScore.score, null);
  assert.equal(dementiaSummary.modalities.voice.experimentalSpeechClassifier.classificationOutcome, "Dementia");

  const emptySummary = buildMultimodalAssessmentSummary({ screeningId: 104, taskResults: {} });
  assert.equal(emptySummary.modalities.voice.experimentalSpeechClassifier.classificationOutcome, "Model unavailable");
});

test("validateVoiceResponse persists sanitized acoustic_classifier_poc without raw transcript", () => {
  const validated = validateVoiceResponse({
    recorded: true,
    status: "completed",
    language: "en",
    quality_reliable: true,
    acoustic_classifier_poc: {
      status: "available_experimental_poc",
      classification_outcome: "Non-dementia",
      model_version: "dementianet-acoustic-v1.0.0",
      prediction: { predicted_label: "nodementia", class_scores: { nodementia: 0.7, dementia: 0.3 }, scores_are_calibrated_probabilities: false }
    }
  });
  assert.equal(validated.acoustic_classifier_poc.classification_outcome, "Non-dementia");
  assert.equal(JSON.stringify(validated).includes("transcript_text"), false);
});
