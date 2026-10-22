import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  featureNamesByModality,
  buildAssessmentFeatureRecord,
  buildCognitiveFeatureRecord,
  buildVoiceFeatureRecord,
  runPredictionModel
} from "../services/mlService.js";

test("feature extraction uses saved task responses and omits unmeasured values", () => {
  const features = buildAssessmentFeatureRecord({
    memory: {
      measurements: {
        wordsShown: ["River", "STONE", "River"],
        wordsRecalled: ["river", "unknown", "river"]
      }
    },
    attention: {
      measurements: {
        correct: 3,
        wrong: 1,
        missed: 2,
        reactionTimesMs: [400, 600]
      }
    }
  });

  assert.equal(features.memory_recall_count, 1);
  assert.equal(features.memory_presented_count, 2);
  assert.equal(features.attention_correct_count, 3);
  assert.equal(features.attention_mean_reaction_time_ms, 500);
  assert.equal(features.orientation_correct_count, null);
  assert.equal(Object.hasOwn(features, "Age"), false);
  assert.equal(Object.hasOwn(features, "eTIV"), false);
});

test("feature extraction maps only observed orientation, language, and speech data", () => {
  const features = buildAssessmentFeatureRecord({
    orientation: {
      measurements: {
        orientationMetrics: { correctCount: 2, scoredItems: 3 }
      }
    },
    language: {
      measurements: {
        measurements: {
          sentenceCharacterCount: 24,
          animalResponseCount: 4
        }
      }
    },
    voice: {
      measurements: {
        speech_features: {
          features: {
            audio_duration_seconds: 9,
            speaking_duration_seconds: 4,
            transcript_word_count: 10,
            transcript_character_count: 50,
            speech_rate_words_per_minute: 150,
            pause_count: 1,
            mean_pause_seconds: 2,
            maximum_pause_seconds: 2
          }
        }
      }
    }
  });

  test("cognitive and voice inference contracts are independent", async () => {
    const taskResults = {
      memory: { measurements: { wordsShown: ["a"], wordsRecalled: ["a"] } },
      voice: {
        measurements: {
          speech_features: { features: { transcript_word_count: 4, lexical_diversity: 0.75 } }
        }
      }
    };
    const cognitive = buildCognitiveFeatureRecord(taskResults);
    const voice = buildVoiceFeatureRecord(taskResults);
    assert.equal(cognitive.memory_recall_count, 1);
    assert.equal("voice_transcript_word_count" in cognitive, false);
    assert.equal(voice.voice_transcript_word_count, 4);
    assert.equal("memory_recall_count" in voice, false);

    const cognitiveUnavailable = await runPredictionModel(cognitive, {
      modality: "cognitive_tasks",
      modelVersion: ""
    });
    const voiceUnavailable = await runPredictionModel(voice, {
      modality: "speech",
      modelVersion: ""
    });
    assert.equal(cognitiveUnavailable.code, "cognitive_model_unavailable");
    assert.equal(voiceUnavailable.code, "voice_model_unavailable");
    assert.equal(voiceUnavailable.modality, "speech");
  });

  assert.equal(features.orientation_correct_count, 2);
  assert.equal(features.orientation_scored_count, 3);
  assert.equal(features.language_sentence_character_count, 24);
  assert.equal(features.language_list_response_count, 4);
  assert.equal(features.voice_speech_rate_words_per_minute, 150);
  assert.equal(features.voice_mean_pause_seconds, 2);
  assert.equal(features.voice_lexical_diversity, null);
  assert.deepEqual(
    Object.keys(features).sort(),
    [...featureNamesByModality.cognitive_tasks, ...featureNamesByModality.speech].sort()
  );
});

test("missing configured model returns explicit unavailable without spawning", async () => {
  let spawnCalled = false;
  const result = await runPredictionModel(
    { memory_recall_count: 1 },
    {
      modelVersion: "",
      spawnProcess: () => {
        spawnCalled = true;
        throw new Error("must not run");
      }
    }
  );

  assert.equal(result.status, "unavailable");
  assert.equal(result.output, null);
  assert.equal(spawnCalled, false);
});

test("model runner timeout returns unavailable and kills the subprocess", async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stdin = new EventEmitter();
  child.stdin.end = () => {};
  let killed = false;
  child.kill = () => {
    killed = true;
    return true;
  };

  const result = await runPredictionModel(
    { memory_recall_count: 1 },
    {
      modelVersion: "test-1",
      artifactDirectory: process.cwd(),
      timeoutMs: 5,
      spawnProcess: () => child
    }
  );

  assert.equal(result.status, "unavailable");
  assert.match(result.reason, /timed out/i);
  assert.equal(killed, true);
});

test("model runner API errors are converted to a non-sensitive unavailable response", async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stdin = new EventEmitter();
  child.stdin.end = () => {
    child.stdout.emit(
      "data",
      JSON.stringify({ status: "unavailable", reason: "No compatible model artifact is installed." })
    );
    child.emit("close", 3);
  };
  child.kill = () => true;

  const result = await runPredictionModel(
    { memory_recall_count: 1 },
    {
      modelVersion: "test-1",
      artifactDirectory: process.cwd(),
      spawnProcess: () => child
    }
  );

  assert.equal(result.status, "unavailable");
  assert.equal(result.output, null);
  assert.equal(result.reason, "No compatible model artifact is installed.");
});

test("model runner process errors do not expose subprocess details", async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stdin = new EventEmitter();
  child.stdin.end = () => {};
  child.kill = () => true;

  const result = await runPredictionModel(
    { memory_recall_count: 1 },
    {
      modelVersion: "test-1",
      artifactDirectory: process.cwd(),
      spawnProcess: () => {
        queueMicrotask(() => child.emit("error", new Error("private traceback")));
        return child;
      }
    }
  );

  assert.equal(result.status, "unavailable");
  assert.equal(result.output, null);
  assert.doesNotMatch(JSON.stringify(result), /private traceback/i);
});
