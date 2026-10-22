import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allAssessmentFeatureNames,
  featureNamesByModality
} from "./assessmentFeatureSchema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const pythonScript = path.join(projectRoot, "Backend", "ml", "predict.py");
const defaultArtifactDirectory = path.join(
  projectRoot,
  "artifacts",
  "models",
  "research"
);
const localPython = path.join(projectRoot, ".venv", "Scripts", "python.exe");
const allowedFeatures = allAssessmentFeatureNames;

const unavailable = (reason, modelVersion = null, missingInputs = [], modality = "cognitive_tasks") => ({
  status: "unavailable",
  code: modality === "speech" ? "voice_model_unavailable" : "cognitive_model_unavailable",
  modality,
  model_version: modelVersion,
  output: null,
  evaluation_status: "not_run",
  missing_inputs: missingInputs,
  reason,
  limitations: [
    "Research/educational output only; not a diagnosis or clinical risk assessment.",
    "Class scores are uncalibrated and must not be interpreted as probabilities."
  ]
});

export const buildAssessmentFeatureRecord = (taskResults = {}) => {
  const memory = taskResults.memory?.measurements || {};
  const shown = Array.isArray(memory.wordsShown) ? memory.wordsShown : [];
  const recalled = Array.isArray(memory.wordsRecalled) ? memory.wordsRecalled : [];
  const expectedWords = new Set(
    shown.map((word) => String(word).trim().toLocaleLowerCase()).filter(Boolean)
  );
  const recalledWords = new Set(
    recalled
      .map((word) => String(word).trim().toLocaleLowerCase())
      .filter((word) => expectedWords.has(word))
  );

  const attention = taskResults.attention?.measurements || {};
  const reactionTimes = Array.isArray(attention.reactionTimesMs)
    ? attention.reactionTimesMs.filter(
        (value) => Number.isFinite(value) && value >= 0
      )
    : [];
  const orientation = taskResults.orientation?.measurements || {};
  const orientationMetrics = orientation.orientationMetrics || {};
  const language = taskResults.language?.measurements || {};
  const languageMetrics = language.measurements || {};
  const voice = taskResults.voice?.measurements || {};
  const speech = voice.speech_features?.features || {};

  const features = {
    memory_recall_count: taskResults.memory ? recalledWords.size : null,
    memory_presented_count: expectedWords.size || null,
    attention_correct_count: Number.isInteger(attention.correct) ? attention.correct : null,
    attention_incorrect_count: Number.isInteger(attention.wrong) ? attention.wrong : null,
    attention_missed_count: Number.isInteger(attention.missed) ? attention.missed : null,
    attention_mean_reaction_time_ms: reactionTimes.length
      ? reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length
      : null,
    orientation_correct_count: Number.isInteger(orientationMetrics.correctCount)
      ? orientationMetrics.correctCount
      : null,
    orientation_scored_count: Number.isInteger(orientationMetrics.scoredItems)
      ? orientationMetrics.scoredItems
      : null,
    language_sentence_character_count: Number.isInteger(languageMetrics.sentenceCharacterCount)
      ? languageMetrics.sentenceCharacterCount
      : null,
    language_list_response_count: Number.isInteger(languageMetrics.animalResponseCount)
      ? languageMetrics.animalResponseCount
      : null,
    voice_audio_duration_seconds: finiteOrNull(speech.audio_duration_seconds),
    voice_speaking_duration_seconds: finiteOrNull(speech.speaking_duration_seconds),
    voice_transcript_word_count: finiteOrNull(speech.transcript_word_count),
    voice_transcript_character_count: finiteOrNull(speech.transcript_character_count),
    voice_speech_rate_words_per_minute: finiteOrNull(speech.speech_rate_words_per_minute),
    voice_pause_count: finiteOrNull(speech.pause_count),
    voice_mean_pause_seconds: finiteOrNull(speech.mean_pause_seconds),
    voice_maximum_pause_seconds: finiteOrNull(speech.maximum_pause_seconds),
    voice_estimated_non_speech_ratio: finiteOrNull(speech.estimated_non_speech_ratio),
    voice_filler_word_count: finiteOrNull(speech.filler_word_count),
    voice_filler_word_ratio_percent: finiteOrNull(speech.filler_word_ratio_percent),
    voice_adjacent_repeated_word_count: finiteOrNull(speech.adjacent_repeated_word_count),
    voice_lexical_diversity: finiteOrNull(speech.lexical_diversity),
    voice_mean_sentence_length_words: finiteOrNull(speech.mean_sentence_length_words)
  };

  return Object.fromEntries(
    Object.entries(features).filter(([name]) => allowedFeatures.has(name))
  );
};

export const buildCognitiveFeatureRecord = (taskResults = {}) =>
  Object.fromEntries(
    Object.entries(buildAssessmentFeatureRecord(taskResults))
      .filter(([name]) => featureNamesByModality.cognitive_tasks.includes(name))
  );

export const buildVoiceFeatureRecord = (taskResults = {}) =>
  Object.fromEntries(
    Object.entries(buildAssessmentFeatureRecord(taskResults))
      .filter(([name]) => featureNamesByModality.speech.includes(name))
  );

export { featureNamesByModality };

const finiteOrNull = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const runPredictionModel = async (
  features,
  {
    modality = "cognitive_tasks",
    modelVersion = modality === "speech"
      ? process.env.MINDSCAN_AUDIO_MODEL_VERSION || ""
      : process.env.MINDSCAN_MODEL_VERSION || "",
    modelName = modality === "speech"
      ? process.env.MINDSCAN_AUDIO_MODEL_NAME || "logistic_regression"
      : process.env.MINDSCAN_MODEL_NAME || "logistic_regression",
    artifactDirectory = modality === "speech"
      ? process.env.MINDSCAN_AUDIO_MODEL_DIR || defaultArtifactDirectory
      : process.env.MINDSCAN_MODEL_DIR || defaultArtifactDirectory,
    pythonExecutable = process.env.PYTHON_EXECUTABLE
      || (fs.existsSync(localPython) ? localPython : "python"),
    timeoutMs = 10000,
    spawnProcess = spawn
  } = {}
) => {
  if (!["cognitive_tasks", "speech"].includes(modality)) {
    return {
      status: "invalid_input",
      code: "unsupported_model_modality",
      message: "Model modality is not supported."
    };
  }
  const modalityFeatures = new Set(featureNamesByModality[modality]);
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return {
      status: "invalid_input",
      message: "Features must be an object."
    };
  }
  const entries = Object.entries(features);
  if (
    entries.some(([key, value]) =>
      !modalityFeatures.has(key)
      || (value !== null && typeof value !== "number")
      || (typeof value === "number" && !Number.isFinite(value))
    )
  ) {
    return {
      status: "invalid_input",
      message: "Feature names or values are not supported."
    };
  }
  if (!modelVersion) {
    return unavailable(
      modality === "speech"
        ? "No voice research model version is configured."
        : "No cognitive research model version is configured.",
      null,
      [modality === "speech" ? "configured_voice_model_version" : "configured_cognitive_model_version"],
      modality
    );
  }
  if (!["logistic_regression", "random_forest"].includes(modelName)) {
    return unavailable("Configured model type is not supported.", modelVersion, [], modality);
  }

  const artifactPath = path.resolve(artifactDirectory);
  if (!fs.existsSync(artifactPath)) {
    return unavailable(
      "No compatible model artifact is installed.",
      modelVersion,
      [modality === "speech" ? "compatible_trained_voice_model" : "compatible_trained_cognitive_model"],
      modality
    );
  }

  return new Promise((resolve) => {
    let child;
    let stdout = "";
    let settled = false;
    let timedOut = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      child?.kill();
      finish(unavailable("Inference timed out.", modelVersion, [], modality));
    }, timeoutMs);

    try {
      child = spawnProcess(
        pythonExecutable,
        [
          pythonScript,
          "--artifact-dir",
          artifactPath,
          "--model-version",
          modelVersion,
          "--model-name",
          modelName
        ],
        {
          cwd: projectRoot,
          windowsHide: true,
          stdio: ["pipe", "pipe", "ignore"]
        }
      );
    } catch {
      finish(unavailable("The model runner could not be started.", modelVersion, [], modality));
      return;
    }

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (settled) return;
      stdout += chunk;
      if (stdout.length > 1024 * 1024) {
        child.kill();
        finish(unavailable("The model runner returned an oversized response.", modelVersion, [], modality));
      }
    });
    child.stdout.on("error", () => {
      finish(unavailable("The model runner output could not be read.", modelVersion, [], modality));
    });
    child.stdin.on("error", () => {
      finish(unavailable("Inference request could not be sent.", modelVersion, [], modality));
    });
    child.on("error", () => {
      finish(unavailable("The model runner could not be started.", modelVersion, [], modality));
    });
    child.on("close", () => {
      if (settled || timedOut) return;
      try {
        const result = JSON.parse(stdout);
        if (
          result?.status === "available_research_only"
        ) {
          finish(
            result.modality === modality
              ? result
              : unavailable("Model modality does not match the requested prediction pipeline.", modelVersion, [], modality)
          );
          return;
        }
        if (result?.status === "unavailable") {
          finish({
            ...unavailable(
              result.reason || "Model inference is unavailable.",
              modelVersion,
              Array.isArray(result.missing_inputs) ? result.missing_inputs : [],
              modality
            ),
            ...result,
            output: null
          });
          return;
        }
        if (result?.status === "invalid_input") {
          finish({
            status: "invalid_input",
            message: result.message || "Inference input was rejected."
          });
          return;
        }
      } catch {
        // Do not include process output in logs or responses; it may contain data.
      }
      finish(unavailable("The model runner returned an invalid response.", modelVersion, [], modality));
    });

    try {
      child.stdin.end(JSON.stringify({ features }));
    } catch {
      child.kill();
      finish(unavailable("Inference request could not be sent.", modelVersion, [], modality));
    }
  });
};
