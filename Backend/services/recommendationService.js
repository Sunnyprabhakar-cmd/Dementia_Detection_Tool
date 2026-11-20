/**
 * Deterministic, transparent recommendation engine based on recorded assessment
 * completeness, data quality warnings, language support, and observed findings.
 * Never recommends medication or treatment, and never issues diagnostic claims.
 */

export const RECOMMENDATION_ENGINE_VERSION = "recommendation-rules/1.0.0";

export const generateRecommendations = (multimodalSummary = {}) => {
  const recommendations = [];
  const completeness = multimodalSummary.completeness || {};
  const modalities = multimodalSummary.modalities || {};
  const cognitive = modalities.cognitive || {};
  const drawing = modalities.drawing || {};
  const voice = modalities.voice || {};

  const missingTasks = Array.isArray(completeness.missingTasks) ? completeness.missingTasks : [];
  if (missingTasks.length > 0) {
    recommendations.push({
      id: "complete_missing_tasks",
      priority: "medium",
      category: "completeness",
      title: "Complete remaining assessment tasks",
      message: `Some tasks were not completed (${missingTasks.join(", ")}). Completing all tasks provides a more representative assessment summary.`,
      basedOn: ["assessment_completeness"]
    });
  }

  const audioWarnings = Array.isArray(voice.qualityWarnings) ? voice.qualityWarnings : [];
  const poorAudio = audioWarnings.some((w) =>
    ["clipping_detected", "low_volume", "high_background_noise"].includes(w)
  );
  if (poorAudio || voice.availability === "empty" || voice.availability === "unavailable") {
    recommendations.push({
      id: "repeat_voice_task",
      priority: "medium",
      category: "data_quality",
      title: "Repeat the voice recording in a quiet environment",
      message: "Audio quality issues or an empty recording affected speech feature extraction. Re-recording in a quiet room at normal speaking volume is recommended.",
      basedOn: audioWarnings.length ? audioWarnings : ["voice_availability"]
    });
  }

  const unsupportedLang = audioWarnings.find((w) => w.startsWith("unsupported_language:"));
  if (unsupportedLang) {
    recommendations.push({
      id: "unsupported_speech_language",
      priority: "low",
      category: "limitation",
      title: "Language-specific speech rules unavailable",
      message: `Language-specific filler and disfluency rules are not supported for the detected language (${unsupportedLang.split(":")[1] || "unknown"}). Acoustic timing and pitch observations remain available.`,
      basedOn: [unsupportedLang]
    });
  }

  const drawingWarnings = Array.isArray(drawing.qualityWarnings) ? drawing.qualityWarnings : [];
  if (
    drawingWarnings.includes("low_image_quality")
    || drawingWarnings.includes("incomplete_clock")
  ) {
    recommendations.push({
      id: "repeat_drawing_task",
      priority: "medium",
      category: "data_quality",
      title: "Consider repeating the clock drawing task",
      message: "The submitted clock drawing had low contrast or incomplete structural elements. Repeating the drawing with clear strokes may improve spatial feature quality.",
      basedOn: drawingWarnings
    });
  }

  const experimentalCognitive = cognitive.experimentalIndicatorPercent;
  const experimentalDrawing = drawing.experimentalIndicatorPercent;
  const completedCount = completeness.completedCount ?? 0;

  if (
    completedCount >= 3
    && ((typeof experimentalCognitive === "number" && experimentalCognitive < 60)
      || (typeof experimentalDrawing === "number" && experimentalDrawing < 60))
  ) {
    recommendations.push({
      id: "discuss_with_clinician",
      priority: "high",
      category: "clinical_follow_up",
      title: "Discuss observed task results with a healthcare professional",
      message: "One or more completed digital tasks showed lower observed performance. Because this prototype is not a diagnostic instrument, please review these observations with a qualified clinician.",
      basedOn: ["observed_task_performance"]
    });
  } else if (missingTasks.length === 0 && recommendations.length === 0) {
    recommendations.push({
      id: "routine_follow_up",
      priority: "low",
      category: "general",
      title: "Assessment complete — retain for longitudinal comparison",
      message: "All requested tasks were completed without quality warnings. Results are saved for your records and future comparison.",
      basedOn: ["complete_assessment"]
    });
  }

  return recommendations;
};
