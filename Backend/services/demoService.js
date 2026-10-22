import { buildAssessmentFeatureRecord } from "./mlService.js";

const syntheticTaskResponses = Object.freeze({
  memory: {
    status: "completed",
    measurements: {
      wordsShown: ["river", "stone", "music", "planet", "bridge"],
      wordsRecalled: ["river", "music", "bridge"]
    }
  },
  attention: {
    status: "completed",
    measurements: {
      correct: 4,
      wrong: 1,
      missed: 0,
      reactionTimesMs: [420, 510, 475]
    }
  },
  orientation: {
    status: "completed",
    measurements: {
      orientationMetrics: { correctCount: 2, scoredItems: 3 }
    }
  },
  language: {
    status: "completed",
    measurements: {
      measurements: {
        sentenceCharacterCount: 32,
        animalResponseCount: 5
      }
    }
  },
  voice: {
    status: "demo_fixture_not_transcribed",
    measurements: {
      status: "demo_fixture_not_transcribed",
      transcript: "Synthetic transcript fixture; no audio was recorded or transcribed.",
      language: "en",
      duration: null,
      provenance: {
        model: "not_run",
        task: "demo_fixture",
        source_audio_persisted: false
      },
      speech_features: {
        features: {
          audio_duration_seconds: null,
          speaking_duration_seconds: null,
          transcript_word_count: null,
          transcript_character_count: null,
          speech_rate_words_per_minute: null,
          pause_count: null,
          mean_pause_seconds: null,
          maximum_pause_seconds: null
        },
        missing_inputs: ["demo mode does not record or transcribe audio"]
      }
    }
  },
  motor_tapping: {
    status: "not_assessed",
    measurements: {}
  },
  clinician_observation: {
    status: "not_assessed",
    measurements: {}
  }
});

export const buildSyntheticDemoReport = () => {
  const taskResults = structuredClone(syntheticTaskResponses);
  const features = buildAssessmentFeatureRecord(taskResults);

  return {
    demo: true,
    simulated: true,
    taskResults,
    derivedFeatures: features,
    modelOutput: {
      status: "simulated_demo",
      model_version: "synthetic-fixture-v1",
      model_name: "demo-only-deterministic-fixture",
      modality: "synthetic_task_fixture",
      evaluation_status: "not_evaluated",
      output: {
        demo_label: "SIMULATED_EXAMPLE_ONLY"
      },
      limitations: [
        "This deterministic output is a software demonstration using synthetic fixture values, not a trained clinical or research model.",
        "It is not based on a participant, saved assessment, audio recording, or real dataset.",
        "It is not a diagnosis, risk assessment, or prediction and is never saved to assessment history."
      ]
    },
    recommendation: "Demo fixture only. No individual assessment or recommendation was generated.",
    flags: ["SIMULATED DEMO ONLY", "No participant data used", "No output persisted"]
  };
};

export const isDemoModeEnabled = (environment = process.env) =>
  environment.MINDSCAN_DEMO_MODE === "true"
  && environment.NODE_ENV === "development";
