import assert from "node:assert/strict";
import test from "node:test";
import { buildMultimodalAssessmentSummary } from "../services/riskAssessmentService.js";
import { generateRecommendations } from "../services/recommendationService.js";

test("complete multimodal assessment yields 100% completeness and reproducible scores", () => {
  const input = {
    screeningId: 42,
    voiceAnalysisSummary: { score_percent: 82 },
    taskResults: {
      memory: { status: "completed", score: 80 },
      delayed_memory: { status: "completed", score: 80 },
      digit_span: { status: "completed", score: 83.33 },
      picture_recognition: { status: "completed", score: 100 },
      pattern_recognition: { status: "completed", score: 75 },
      orientation: { status: "completed", score: 100 },
      attention: { status: "completed", score: 90 },
      language: { status: "completed", score: null, measurements: { sentence: "Hello", measurements: { animalResponseCount: 10 } } },
      clock_drawing: {
        status: "completed",
        score: 88,
        measurements: {
          completionTimeSeconds: 20,
          imageAnalysis: {
            circularity_score: 0.9,
            quadrant_balance_score: 0.85,
            drawing_completeness_score: 0.9,
            image_quality_score: 0.8
          }
        }
      },
      voice: {
        status: "completed",
        measurements: {
          status: "completed",
          language: "en",
          speech_features: { features: { speech_rate_words_per_minute: 120, pause_count: 2 } },
          transcript_analysis: { observations: { word_count: 25 } }
        }
      }
    }
  };

  const s1 = buildMultimodalAssessmentSummary(input);
  const s2 = buildMultimodalAssessmentSummary(input);
  assert.equal(s1.completeness.percent, 100);
  assert.equal(s1.modalities.cognitive.experimentalIndicatorPercent, s2.modalities.cognitive.experimentalIndicatorPercent);
  assert.equal(s1.researchModels.isolatedClinicalTabularModel.status, "isolated_not_applicable_to_digital_tasks");
  assert.ok(s1.recommendations.some((r) => r.id === "routine_follow_up"));
});

test("missing and skipped tasks are excluded from averages and never scored as zero", () => {
  const partial = buildMultimodalAssessmentSummary({
    screeningId: 7,
    taskResults: {
      memory: { status: "completed", score: 80 },
      attention: { status: "completed", score: 100 },
      delayed_memory: { status: "skipped", score: 0, measurements: { skipped: true } },
      clock_drawing: { status: "skipped", score: null, measurements: { skipped: true } }
    }
  });

  assert.equal(partial.modalities.cognitive.experimentalIndicatorPercent, 90);
  assert.equal(partial.modalities.cognitive.rawScores.delayed_memory, null);
  assert.equal(partial.modalities.drawing.availability, "skipped");
  assert.ok(partial.completeness.missingTasks.includes("digit_span"));
  assert.ok(partial.recommendations.some((r) => r.id === "complete_missing_tasks"));
});

test("audio quality warnings, unsupported language, and poor drawing trigger targeted recommendations", () => {
  const summary = buildMultimodalAssessmentSummary({
    screeningId: 9,
    taskResults: {
      memory: { status: "completed", score: 40 },
      attention: { status: "completed", score: 50 },
      orientation: { status: "completed", score: 45 },
      clock_drawing: {
        status: "completed",
        score: 35,
        measurements: {
          imageAnalysis: {
            circularity_score: 0.3,
            quadrant_balance_score: 0.4,
            drawing_completeness_score: 0.3,
            image_quality_score: 0.15
          }
        }
      },
      voice: {
        status: "completed",
        measurements: {
          status: "completed",
          language: "fr",
          quality_warnings: ["clipping_detected", "high_background_noise"],
          speech_features: { features: {} }
        }
      }
    }
  });

  const recIds = new Set(summary.recommendations.map((r) => r.id));
  assert.ok(recIds.has("repeat_voice_task"));
  assert.ok(recIds.has("unsupported_speech_language"));
  assert.ok(recIds.has("repeat_drawing_task"));
  assert.ok(recIds.has("discuss_with_clinician"));
});

test("recommendation engine never outputs diagnostic or medication advice", () => {
  const recs = generateRecommendations({
    completeness: { missingTasks: [], completedCount: 5 },
    modalities: { cognitive: { experimentalIndicatorPercent: 30 }, drawing: {}, voice: {} }
  });
  const text = JSON.stringify(recs).toLowerCase();
  assert.equal(text.includes("prescribe"), false);
  assert.equal(text.includes("medication"), false);
  assert.equal(text.includes("diagnosed with"), false);
});
