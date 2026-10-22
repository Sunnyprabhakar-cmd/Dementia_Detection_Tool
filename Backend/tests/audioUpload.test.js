import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createUploadAudioHandler, getAudioAgentAnalysis } from "../controller/audioAgentController.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function createSilentWavFixture() {
  const buffer = Buffer.alloc(46);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24);
  buffer.writeUInt32LE(32000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(2, 40);
  return buffer;
}

function makeRequest({ body = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), contentType = "audio/webm", authenticated = true } = {}) {
  return {
    body,
    user: authenticated ? { userId: 42 } : null,
    get(name) {
      return name.toLowerCase() === "content-type" ? contentType : "";
    }
  };
}

test("valid audio is transcribed in a private temporary file and removed after processing", async () => {
  let temporaryPath;
  const handler = createUploadAudioHandler({
    async transcribe(filePath) {
      temporaryPath = filePath;
      assert.equal(fs.existsSync(filePath), true);
      assert.equal(fs.readFileSync(filePath).toString("ascii", 0, 4), "RIFF");
      return {
        status: "success",
        processing_status: "completed",
        transcript: "A sample sentence.",
        language: "en",
        duration_seconds: 3,
        speech_features: { status: "complete", features: { transcript_word_count: 3 } },
        transcript_analysis: {
          status: "very_short",
          language: "en",
          observations: { word_count: 3, sentence_count: 1 }
        },
        classifier: {
          status: "available_research_only",
          model_version: "audio-test-only",
          prediction: {
            predicted_label: "fixture_class_a",
            class_scores: { fixture_class_a: 0.7, fixture_class_b: 0.3 },
            scores_are_calibrated_probabilities: false
          }
        }
      };
    }
  });
  const response = responseRecorder();

  await handler(makeRequest({
    body: createSilentWavFixture(),
    contentType: "audio/wav"
  }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "success");
  assert.equal(response.body.processing_status, "completed");
  assert.equal(response.body.audio_duration_seconds, 3);
  assert.equal(response.body.transcription.transcript, "A sample sentence.");
  assert.deepEqual(response.body.speech_features.features, { transcript_word_count: 3 });
  assert.deepEqual(response.body.transcript_analysis.observations, {
    word_count: 3,
    sentence_count: 1
  });
  assert.equal(response.body.classifier.status, "available_research_only");
  assert.equal(response.body.classifier.model_version, "audio-test-only");
  assert.equal(fs.existsSync(temporaryPath), false);
});

test("decoded silent or malformed audio returns a validation error and measured duration", async () => {
  const handler = createUploadAudioHandler({
    async transcribe() {
      return {
        status: "error",
        processing_status: "rejected",
        audio_duration_seconds: 2,
        error: {
          code: "silent_audio",
          message: "No audible speech was detected in the recording. Please record again."
        }
      };
    }
  });
  const response = responseRecorder();

  await handler(makeRequest({
    body: createSilentWavFixture(),
    contentType: "audio/wav"
  }), response);

  assert.equal(response.statusCode, 422);
  assert.equal(response.body.processing_status, "rejected");
  assert.equal(response.body.audio_duration_seconds, 2);
  assert.equal(response.body.error.code, "silent_audio");
  assert.equal(response.body.transcription, null);
});

test("empty, invalid-type, mismatched, and oversized audio is rejected before transcription", async () => {
  let transcriberCalled = false;
  const handler = createUploadAudioHandler({
    async transcribe() {
      transcriberCalled = true;
      throw new Error("must not run");
    }
  });
  const cases = [
    [makeRequest({ body: Buffer.alloc(0) }), 400, "empty_audio"],
    [makeRequest({ contentType: "application/octet-stream" }), 415, "unsupported_audio_type"],
    [makeRequest({ body: Buffer.from("not webm") }), 415, "audio_type_mismatch"],
    [makeRequest({ body: Buffer.alloc(12 * 1024 * 1024 + 1) }), 413, "audio_too_large"]
  ];

  for (const [request, expectedStatus, expectedCode] of cases) {
    const response = responseRecorder();
    await handler(request, response);
    assert.equal(response.statusCode, expectedStatus);
    assert.equal(response.body.error.code, expectedCode);
    assert.equal(response.body.transcription, null);
  }
  assert.equal(transcriberCalled, false);
});

test("unauthenticated requests cannot invoke transcription", async () => {
  let transcriberCalled = false;
  const handler = createUploadAudioHandler({
    async transcribe() {
      transcriberCalled = true;
    }
  });
  const response = responseRecorder();

  await handler(makeRequest({ authenticated: false }), response);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, "authentication_required");
  assert.equal(transcriberCalled, false);
});

test("transcription errors return a structured non-sensitive failure", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const handler = createUploadAudioHandler({
      async transcribe() {
        throw Object.assign(new Error("private traceback and transcript"), { code: "ENOENT" });
      }
    });
    const response = responseRecorder();

    await handler(makeRequest(), response);

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.processing_status, "failed");
    assert.equal(response.body.error.code, "transcription_unavailable");
    assert.doesNotMatch(JSON.stringify(response.body), /private traceback|private transcript/i);
  } finally {
    console.error = originalConsoleError;
  }
});

test("empty transcription and missing classifier remain explicit instead of fabricating output", async () => {
  const handler = createUploadAudioHandler({
    async transcribe() {
      return {
        status: "success",
        processing_status: "completed",
        transcript: "",
        speech_features: { status: "empty", features: {} },
        transcript_analysis: { status: "empty", observations: { word_count: 0 } },
        classifier: { status: "unavailable" }
      };
    }
  });
  const response = responseRecorder();

  await handler(makeRequest(), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.transcription.transcript, "");
  assert.equal(response.body.speech_features.status, "empty");
  assert.equal(response.body.transcript_analysis.status, "empty");
  assert.equal(response.body.classifier.status, "unavailable");
});

test("audio analysis endpoint reports classifier unavailable", async () => {
  const response = responseRecorder();

  await getAudioAgentAnalysis({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.result.status, "unavailable");
  assert.equal(response.body.result.output, null);
  assert.match(response.body.result.limitation, /classifier unavailable/i);
});
