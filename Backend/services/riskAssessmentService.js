import { pool } from "../config/db.js";
import { getScreeningSummary, upsertAssessmentResult } from "./screeningService.js";
import { generateRecommendations, RECOMMENDATION_ENGINE_VERSION } from "./recommendationService.js";
import { isClinicianAuthorizedForScreening } from "./clinicianService.js";

export const RISK_ENGINE_VERSION = "multimodal-heuristic/1.1.0";
export const ASSESSMENT_FORMULA_VERSION = "assessment-performance/1.0.0";
export const STAGE10_6_DISCLAIMER =
  "Experimental research assessment. The displayed scores and speech-based predictions are not clinically validated and must not be used to diagnose or exclude dementia. Clinical evaluation by a qualified healthcare professional is required.";

const EXPECTED_ASSESSMENT_TASKS = [
  "memory",
  "delayed_memory",
  "digit_span",
  "picture_recognition",
  "pattern_recognition",
  "orientation",
  "attention",
  "language",
  "clock_drawing",
  "voice"
];

const NUMERIC_COGNITIVE_TASKS = [
  "memory",
  "delayed_memory",
  "digit_span",
  "picture_recognition",
  "pattern_recognition",
  "orientation",
  "attention"
];

const mean = (values) =>
  values.length
    ? Number((values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(2))
    : null;

export const buildMultimodalAssessmentSummary = (screeningSummary = {}) => {
  const taskResults = screeningSummary.taskResults || {};
  const completedTasks = [];
  const skippedTasks = [];
  const missingTasks = [];

  for (const task of EXPECTED_ASSESSMENT_TASKS) {
    const entry = taskResults[task];
    if (!entry) {
      missingTasks.push(task);
    } else if (entry.status === "skipped" || entry.measurements?.skipped === true) {
      skippedTasks.push(task);
    } else if (task === "voice" && ["unavailable", "not_assessed"].includes(entry.measurements?.status)) {
      missingTasks.push(task);
    } else {
      completedTasks.push(task);
    }
  }

  const completenessPercent = Number(
    ((completedTasks.length / EXPECTED_ASSESSMENT_TASKS.length) * 100).toFixed(2)
  );

  // 1. Cognitive Modality (never treat missing/skipped as 0)
  const rawCognitiveScores = {};
  const measuredNumericScores = [];
  const measuredCognitiveTasks = [];
  const excludedCognitiveTasks = [];
  for (const task of NUMERIC_COGNITIVE_TASKS) {
    const score = taskResults[task]?.score;
    const isSkipped = taskResults[task]?.status === "skipped" || taskResults[task]?.measurements?.skipped === true;
    if (!isSkipped && typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100) {
      rawCognitiveScores[task] = Number(score.toFixed(2));
      measuredNumericScores.push(score);
      measuredCognitiveTasks.push(task);
    } else {
      rawCognitiveScores[task] = null;
      excludedCognitiveTasks.push({
        task,
        reason: isSkipped ? "skipped" : "missing_or_unmeasured"
      });
    }
  }
  const languageMeas = taskResults.language?.measurements || {};
  const cognitiveExperimentalIndicator = mean(measuredNumericScores);

  // 2. Drawing Modality
  const drawingEntry = taskResults.clock_drawing;
  const drawingAnalysis = drawingEntry?.measurements?.imageAnalysis || null;
  const drawingWarnings = [];
  let drawingAvailability = "missing";
  if (drawingEntry) {
    if (drawingEntry.status === "skipped" || drawingEntry.measurements?.skipped === true) {
      drawingAvailability = "skipped";
    } else if (drawingAnalysis) {
      drawingAvailability = "available";
      if ((drawingAnalysis.image_quality_score ?? 1) < 0.25) {
        drawingWarnings.push("low_image_quality");
      }
      if ((drawingAnalysis.drawing_completeness_score ?? 1) < 0.5) {
        drawingWarnings.push("incomplete_clock");
      }
    }
  }

  // 3. Voice & Speech Modality
  const voiceEntry = taskResults.voice;
  const voiceMeas = voiceEntry?.measurements || {};
  const voiceStatus = voiceMeas.status || (voiceEntry ? "completed" : "not_assessed");
  const speechFeatures = voiceMeas.speech_features?.features || {};
  const transcriptAnalysis = voiceMeas.transcript_analysis || {};
  const voiceWarnings = [];
  if (Array.isArray(voiceMeas.quality_warnings)) {
    voiceWarnings.push(...voiceMeas.quality_warnings);
  }
  const detectedLang = voiceMeas.language || transcriptAnalysis.language || "unknown";
  if (
    voiceEntry
    && detectedLang
    && detectedLang !== "unknown"
    && !["en", "hi", "pa"].includes(detectedLang.toLowerCase())
  ) {
    voiceWarnings.push(`unsupported_language:${detectedLang}`);
  }
  const voiceIndicator = screeningSummary.voiceAnalysisSummary?.score_percent ?? null;
  const rawPoc = voiceMeas.acoustic_classifier_poc;
  const experimentalSpeechClassifier = rawPoc && typeof rawPoc === "object"
    ? {
        status: rawPoc.status || "unavailable",
        classificationOutcome: rawPoc.classification_outcome || (
          rawPoc.status === "available_experimental_poc"
            ? (rawPoc.prediction?.predicted_label === "dementia" ? "Dementia" : "Non-dementia")
            : (voiceEntry ? "Inconclusive" : "Model unavailable")
        ),
        modelVersion: rawPoc.model_version || null,
        modelName: rawPoc.model_name || null,
        dataset: rawPoc.dataset || null,
        predictedLabel: rawPoc.prediction?.predicted_label || null,
        classScores: rawPoc.prediction?.class_scores || null,
        scoresAreCalibratedProbabilities: false,
        decisionThreshold: rawPoc.decision_threshold || {
          threshold_version: "dementianet-val-default-0.50/v1.0",
          cutoff: 0.5,
          clinically_validated: false,
          status_label: "Experimental classification — threshold not clinically validated"
        },
        message: rawPoc.message || null,
        missingInputs: Array.isArray(rawPoc.missing_inputs) ? rawPoc.missing_inputs : []
      }
    : {
        status: "unavailable",
        classificationOutcome: voiceEntry ? "Inconclusive" : "Model unavailable",
        modelVersion: "dementianet-acoustic-v1.0.0",
        modelName: "logistic_regression",
        dataset: "DementiaNet (weak biographical labels, English YouTube interviews)",
        predictedLabel: null,
        classScores: null,
        scoresAreCalibratedProbabilities: false,
        decisionThreshold: {
          threshold_version: "dementianet-val-default-0.50/v1.0",
          cutoff: 0.5,
          clinically_validated: false,
          status_label: "Experimental classification — threshold not clinically validated"
        },
        message: voiceEntry
          ? "Speech recording did not yield an experimental acoustic classification."
          : "No speech recording available for experimental acoustic classification.",
        missingInputs: voiceEntry ? ["acoustic_classifier_poc_not_recorded"] : ["voice_recording"]
      };

  // 4. Findings (explicitly non-diagnostic)
  const findings = [];
  if (cognitiveExperimentalIndicator != null) {
    findings.push({
      id: "cognitive_observed_summary",
      modality: "cognitive",
      level: cognitiveExperimentalIndicator < 60 ? "warning" : "observed",
      title: "Observed cognitive task performance",
      explanation: `Unweighted mean of ${measuredNumericScores.length} measured cognitive tasks is ${cognitiveExperimentalIndicator}/100. Uncompleted or skipped tasks were excluded.`
    });
  }
  if (drawingAvailability === "available") {
    findings.push({
      id: "drawing_spatial_summary",
      modality: "drawing",
      level: drawingWarnings.length ? "warning" : "observed",
      title: "Clock drawing spatial heuristics",
      explanation: `Circularity ${(drawingAnalysis.circularity_score * 100).toFixed(0)}%, quadrant balance ${(drawingAnalysis.quadrant_balance_score * 100).toFixed(0)}%, completeness ${(drawingAnalysis.drawing_completeness_score * 100).toFixed(0)}%.`
    });
  }
  if (voiceEntry && voiceStatus === "completed") {
    findings.push({
      id: "voice_observed_summary",
      modality: "voice",
      level: voiceWarnings.length ? "warning" : "observed",
      title: "Observed speech and acoustic measurements",
      explanation: `Language: ${detectedLang}; speech rate: ${speechFeatures.speech_rate_words_per_minute ?? "Not measured"} words/min; pauses: ${speechFeatures.pause_count ?? "Not measured"}.`
    });
  }

  const summary = {
    engineVersion: RISK_ENGINE_VERSION,
    formulaVersion: ASSESSMENT_FORMULA_VERSION,
    recommendationEngineVersion: RECOMMENDATION_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    screeningId: screeningSummary.screeningId ?? null,
    disclaimer: STAGE10_6_DISCLAIMER,
    assessmentPerformanceScore: {
      score: cognitiveExperimentalIndicator,
      scale: "0-100",
      label: "Assessment Performance Score",
      formulaVersion: ASSESSMENT_FORMULA_VERSION,
      formula: "Unweighted arithmetic mean of valid, non-skipped numeric cognitive tasks (memory, delayed_memory, digit_span, picture_recognition, pattern_recognition, orientation, attention). Skipped, missing, unscored language, clock_drawing spatial heuristics, and speech tasks are excluded.",
      measuredTasks: measuredCognitiveTasks,
      excludedTasks: excludedCognitiveTasks,
      measuredTaskCount: measuredNumericScores.length,
      totalNumericTasks: NUMERIC_COGNITIVE_TASKS.length
    },
    completeness: {
      expectedCount: EXPECTED_ASSESSMENT_TASKS.length,
      completedCount: completedTasks.length,
      skippedCount: skippedTasks.length,
      missingCount: missingTasks.length,
      percent: completenessPercent,
      completedTasks,
      skippedTasks,
      missingTasks
    },
    modalities: {
      cognitive: {
        availability: measuredNumericScores.length ? "available" : "missing",
        measuredTaskCount: measuredNumericScores.length,
        rawScores: rawCognitiveScores,
        languageObservations: {
          sentenceCharacterCount: languageMeas.sentence?.length ?? languageMeas.measurements?.sentenceCharacterCount ?? null,
          animalResponseCount: languageMeas.measurements?.animalResponseCount ?? null
        },
        experimentalIndicatorPercent: cognitiveExperimentalIndicator,
        scoringMethod: "Unweighted mean of measured numeric cognitive tasks only; missing/skipped tasks are excluded."
      },
      drawing: {
        availability: drawingAvailability,
        qualityWarnings: [...new Set(drawingWarnings)],
        rawMetrics: drawingAnalysis,
        completionTimeSeconds: drawingEntry?.measurements?.completionTimeSeconds ?? null,
        experimentalIndicatorPercent: typeof drawingEntry?.score === "number" ? drawingEntry.score : null,
        scoringMethod: "Rule-based CV spatial heuristics (circularity, quadrant balance, ring/hand ratios); not a clinical diagnosis."
      },
      voice: {
        availability: voiceStatus === "completed" ? "available" : voiceStatus,
        language: detectedLang,
        qualityWarnings: [...new Set(voiceWarnings)],
        speechFeatures,
        transcriptObservations: transcriptAnalysis.observations || null,
        experimentalIndicatorPercent: voiceIndicator,
        experimentalSpeechClassifier,
        scoringMethod: "Descriptive speech timing and language-aware fluency counts; experimental acoustic classifier kept strictly separate."
      },
      mri: {
        availability: screeningSummary.imaging?.mri ? "available" : "missing",
        modelStatus: screeningSummary.imaging?.mri?.model_output?.status || "unavailable",
        modelOutput: screeningSummary.imaging?.mri?.model_output || null,
        qualityWarnings: screeningSummary.imaging?.mri?.quality_warnings || [],
        note: "MRI modality kept strictly independent from cognitive score and speech classification."
      },
      ct: {
        availability: screeningSummary.imaging?.ct ? "available" : "missing",
        modelStatus: "unavailable",
        qualityWarnings: screeningSummary.imaging?.ct?.quality_warnings || [],
        note: "CT modality kept strictly independent; CT AI inference is unavailable (clinician review only)."
      },
      physicalExamination: (() => {
        const peEntry = taskResults.physical_examination;
        const peMeas = peEntry?.measurements || {};
        if (peEntry) {
          if (peEntry.status === "skipped" || peMeas.status === "skipped") {
            return {
              availability: "skipped",
              skipReason: peMeas.skipReason || null,
              examinerName: null,
              examinerRole: null,
              examinedAt: null,
              additionalObservations: null,
              sensoryObservations: [],
              reflexObservations: [],
              note: "Optional in-person physical examination was skipped."
            };
          }
          return {
            availability: "available",
            examinerName: peMeas.examinerName || null,
            examinerRole: peMeas.examinerRole || null,
            examinedAt: peMeas.examinedAt || null,
            additionalObservations: peMeas.additionalObservations || null,
            sensoryObservations: Array.isArray(peMeas.sensoryObservations) ? peMeas.sensoryObservations : [],
            reflexObservations: Array.isArray(peMeas.reflexObservations) ? peMeas.reflexObservations : [],
            note: "Optional in-person observational record only; excluded from cognitive performance score and speech classification."
          };
        }
        const legacyEntry = taskResults.motor_tapping;
        if (legacyEntry) {
          return {
            availability: "legacy_motor_tapping",
            legacyStatus: legacyEntry.status || "completed",
            sensoryObservations: [],
            reflexObservations: [],
            note: "Historical motor tapping record preserved (not used in scoring or classification)."
          };
        }
        return {
          availability: "missing",
          sensoryObservations: [],
          reflexObservations: [],
          note: "Optional in-person physical examination was not performed."
        };
      })()
    },
    findings,
    researchModels: {
      isolatedClinicalTabularModel: {
        modelVersion: "zenodo-13378346-v1.0.0",
        status: "isolated_not_applicable_to_digital_tasks",
        datasetProvenance: "Zenodo 13378346 (CC-BY-4.0, N=283 clinical/biomarker cohort)",
        note: "Not invoked on live MindScan digital tasks; predictions are not clinically validated for this application."
      },
      futureMultimodalInterface: {
        status: "awaiting_authorized_multimodal_cohort",
        supportedModalities: ["cognitive", "drawing", "voice"]
      }
    },
    limitations: [
      "Experimental research prototype only; does not diagnose MCI, Alzheimer's disease, or dementia.",
      "Generated indicators are unvalidated research heuristics and are not clinical probabilities.",
      "Missing or skipped tasks are excluded from averages and never treated as zero."
    ]
  };

  summary.recommendations = generateRecommendations(summary);
  return summary;
};

export const generateAndPersistMultimodalSummary = async (screeningId, userId, role = "patient") => {
  let ownerUserId = userId;
  if (role === "clinician") {
    const authorized = await isClinicianAuthorizedForScreening(userId, screeningId);
    if (!authorized) {
      const err = new Error("Not authorized to access this patient screening");
      err.statusCode = 403;
      throw err;
    }
    ownerUserId = authorized.patient_id;
  }

  const screeningSummary = await getScreeningSummary(screeningId, ownerUserId);
  const multimodal = buildMultimodalAssessmentSummary(screeningSummary);

  await upsertAssessmentResult(screeningId, ownerUserId, {
    ...screeningSummary,
    taskScores: {
      ...screeningSummary.taskScores,
      __multimodalSummary: multimodal
    },
    recommendation: multimodal.recommendations[0]?.message || screeningSummary.recommendation
  });

  return multimodal;
};

export const getPersistedMultimodalSummary = async (screeningId, userId, role = "patient") => {
  const sid = Number(screeningId);
  if (!Number.isSafeInteger(sid) || sid <= 0) throw new Error("Invalid screening ID");

  if (role === "clinician") {
    const authorized = await isClinicianAuthorizedForScreening(userId, sid);
    if (!authorized) {
      const err = new Error("Not authorized to access this patient screening");
      err.statusCode = 403;
      throw err;
    }
  }

  const query = role === "clinician"
    ? `SELECT r.task_scores FROM screening_results r WHERE r.screening_id = $1`
    : `SELECT r.task_scores FROM screening_results r
       JOIN screening_sessions s ON s.id = r.screening_id
       WHERE r.screening_id = $1 AND s.user_id = $2`;
  const params = role === "clinician" ? [sid] : [sid, Number(userId)];
  const { rows } = await pool.query(query, params);
  if (rows[0]?.task_scores?.__multimodalSummary) {
    return rows[0].task_scores.__multimodalSummary;
  }
  if (role !== "clinician") {
    const owned = await pool.query(
      "SELECT id FROM screening_sessions WHERE id = $1 AND user_id = $2",
      [sid, Number(userId)]
    );
    if (!owned.rows.length) {
      const err = new Error("Screening not found for this user");
      err.statusCode = 403;
      throw err;
    }
  }
  return generateAndPersistMultimodalSummary(sid, userId, role);
};
