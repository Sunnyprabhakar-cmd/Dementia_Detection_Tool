import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import jwt from "jsonwebtoken";
import { createUploadAudioHandler } from "../controller/audioAgentController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateVoiceResponse } from "../services/assessmentValidation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function buildWavBuffer({ seconds = 0.8, sampleRate = 16000, freq = 155, amplitude = 0.35 } = {}) {
  const nSamples = Math.floor(seconds * sampleRate);
  const dataSize = nSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < nSamples; i += 1) {
    const t = i / sampleRate;
    // Include realistic leading/trailing quiet room floor around the voiced segment
    const env = (t < 0.15 || t > seconds - 0.15) ? 0.01 : 1.0;
    const sample = Math.max(-1, Math.min(1, env * amplitude * Math.sin(2 * Math.PI * freq * t)));
    buf.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buf;
}

const runRealPythonAcousticPipeline = (wavPath) =>
  new Promise((resolve, reject) => {
    const pyCode = [
      "import json, sys",
      "from pathlib import Path",
      "from Backend.ml.preprocessing.speech_features import extract_speech_intelligence",
      "res = extract_speech_intelligence(wav_path=Path(sys.argv[1]), transcript='hello world test speech', language='en')",
      "print(json.dumps({'status':'success','duration_seconds':res['timing_summary']['total_duration_seconds'],'language':'en','language_probability':0.99,'transcript':'hello world test speech','speech_features':{'status':'complete','features':{'audio_duration_seconds':res['timing_summary']['total_duration_seconds'],'transcript_word_count':4}},'speech_intelligence':res,'quality_warnings':res['quality_warnings']}))"
    ].join("; ");

    execFile(
      "python",
      ["-c", pyCode, wavPath],
      { cwd: repoRoot, env: { ...process.env, PYTHONPATH: repoRoot }, windowsHide: true, timeout: 15000 },
      (err, stdout) => {
        if (stdout) {
          try {
            resolve(JSON.parse(stdout));
            return;
          } catch {
            // fall through
          }
        }
        reject(err || new Error("Python acoustic extraction failed"));
      }
    );
  });

test("Stage 10.2 E2E: HTTP upload -> real Python acoustic extraction -> quality gating -> privacy-safe validation", async () => {
  const prevSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "stage10-2-e2e-secret";
  const token = jwt.sign({ userId: 12, role: "patient" }, process.env.JWT_SECRET);

  const testApp = express();
  testApp.post(
    "/api/audio/upload",
    authMiddleware,
    express.raw({ type: () => true, limit: "12mb" }),
    createUploadAudioHandler({ transcribe: runRealPythonAcousticPipeline })
  );

  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Clean WAV upload -> real Python MFCC/F0/HNR extraction + reliable quality
    const cleanWav = buildWavBuffer({ amplitude: 0.35 });
    const okRes = await fetch(`${baseUrl}/api/audio/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/wav" },
      body: cleanWav
    });
    assert.equal(okRes.status, 200);
    const okData = await okRes.json();
    assert.equal(okData.status, "success");
    assert.equal(okData.speech_intelligence.quality_reliable, true);
    assert.ok(okData.speech_intelligence.acoustic_features.pitch_mean_hz > 120);
    assert.equal(okData.classifier.status, "unavailable");

    // 2. Clipped WAV upload -> quality_reliable === false + clipping_detected warning
    const clippedWav = buildWavBuffer({ amplitude: 1.8 });
    const clipRes = await fetch(`${baseUrl}/api/audio/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/wav" },
      body: clippedWav
    });
    assert.equal(clipRes.status, 200);
    const clipData = await clipRes.json();
    assert.equal(clipData.speech_intelligence.quality_reliable, false);
    assert.ok(clipData.quality_warnings.includes("clipping_detected"));

    // 3. Corrupt WAV upload -> rejected with 415 audio_type_mismatch
    const corruptRes = await fetch(`${baseUrl}/api/audio/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/wav" },
      body: Buffer.from("not-a-wav-file")
    });
    assert.equal(corruptRes.status, 415);

    // 4. Persistence validation preserves quality flags and rejects raw transcript text
    const validated = validateVoiceResponse({
      recorded: true,
      status: "completed",
      responseTime: 0.8,
      language: "en",
      speech_features: okData.speech_features,
      quality_warnings: clipData.quality_warnings,
      quality_reliable: clipData.speech_intelligence.quality_reliable
    });
    assert.equal(validated.quality_reliable, false);
    assert.deepEqual(validated.quality_warnings, ["clipping_detected"]);
  } finally {
    process.env.JWT_SECRET = prevSecret;
    await new Promise((resolve) => server.close(resolve));
  }
});
