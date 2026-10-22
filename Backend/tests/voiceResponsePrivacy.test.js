import test from "node:test";
import assert from "node:assert/strict";

import { pool } from "../config/db.js";
import { saveTaskResponse } from "../services/screeningService.js";

test("saved voice response contains observations but never transcript text", async (t) => {
  let insertedResponse;
  const client = {
    async query(sql, values = []) {
      if (sql.includes("SELECT id") && sql.includes("screening_sessions")) {
        return { rows: [{ id: 17 }] };
      }
      if (sql.includes("INSERT INTO task_responses")) {
        insertedResponse = JSON.parse(values[2]);
        return { rows: [{ response_data: insertedResponse }] };
      }
      return { rows: [] };
    },
    release() {}
  };
  t.mock.method(pool, "connect", async () => client);

  await saveTaskResponse(17, 23, "voice", {
    recorded: true,
    status: "completed",
    responseTime: 8,
    language: "en",
    transcript: "Private synthetic transcript",
    speech_features: {
      status: "complete",
      features: { transcript_word_count: 6 }
    },
    transcript_analysis: {
      status: "complete",
      language: "en",
      observations: { word_count: 6, unique_word_ratio: 0.8 }
    }
  }, null).then(
    () => assert.fail("Raw transcript should be rejected before database persistence."),
    (error) => assert.match(error.message, /unsupported fields/)
  );

  assert.equal(insertedResponse, undefined);
});

test("valid voice observations are stored in the minimized response shape", async (t) => {
  let insertedResponse;
  const client = {
    async query(sql, values = []) {
      if (sql.includes("SELECT id") && sql.includes("screening_sessions")) {
        return { rows: [{ id: 17 }] };
      }
      if (sql.includes("INSERT INTO task_responses")) {
        insertedResponse = JSON.parse(values[2]);
        return { rows: [{ response_data: insertedResponse }] };
      }
      return { rows: [] };
    },
    release() {}
  };
  t.mock.method(pool, "connect", async () => client);

  await saveTaskResponse(17, 23, "voice", {
    recorded: true,
    status: "completed",
    responseTime: 8,
    language: "en",
    speech_features: {
      status: "partial",
      features: { transcript_word_count: 6, speech_rate_words_per_minute: null },
      transcription_model: "not retained"
    },
    transcript_analysis: {
      status: "complete",
      language: "en",
      observations: {
        word_count: 6,
        sentence_count: 1,
        average_words_per_sentence: 6,
        filler_word_counts: { um: 1 },
        repeated_adjacent_word_count: 0,
        repeated_short_phrase_count: 0,
        unique_word_ratio: 0.8,
        self_correction_marker_counts: {},
        selected_vague_expression_counts: {}
      },
      unavailable_observations: []
    }
  }, null);

  assert.equal(insertedResponse.transcript_analysis.observations.word_count, 6);
  assert.equal(insertedResponse.speech_features.features.transcript_word_count, 6);
  assert.equal("transcription_model" in insertedResponse.speech_features, false);
  assert.equal("transcript" in insertedResponse, false);
});
