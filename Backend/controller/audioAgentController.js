import fs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

const extensionsByMimeType = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg"
};

const responseError = (code, message) => ({
  status: "error",
  processing_status: "failed",
  audio_duration_seconds: null,
  transcription: null,
  speech_features: null,
  transcript_analysis: null,
  classifier: {
    status: "unavailable",
    message: "Research analysis only — classifier unavailable."
  },
  error: { code, message }
});

const isAudioSignatureValid = (buffer, extension) => {
  switch (extension) {
    case "wav":
      return buffer.length >= 12
        && buffer.toString("ascii", 0, 4) === "RIFF"
        && buffer.toString("ascii", 8, 12) === "WAVE";
    case "webm":
      return buffer.length >= 4
        && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    case "mp3":
      return buffer.length >= 3
        && (buffer.toString("ascii", 0, 3) === "ID3"
          || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
    case "mp4":
      return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
    case "ogg":
      return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "OggS";
    default:
      return false;
  }
};

const runTranscriber = async (filePath) => {
  const localPython = path.join(projectRoot, ".venv-audio", "Scripts", "python.exe");
  const pythonPath = process.env.PYTHON_EXECUTABLE
    || (fs.existsSync(localPython) ? localPython : "python");
  const scriptPath = path.join(projectRoot, "Backend", "ml", "transcribe_audio.py");

  return new Promise((resolve, reject) => {
    execFile(
      pythonPath,
      [scriptPath, "--audio", filePath],
      {
        cwd: projectRoot,
        windowsHide: true,
        timeout: 180000,
        maxBuffer: 5 * 1024 * 1024,
        env: {
          ...process.env,
          HF_HUB_OFFLINE: "1",
          HF_HUB_DISABLE_TELEMETRY: "1"
        }
      },
      (error, stdout) => {
        if (stdout) {
          try {
            resolve(JSON.parse(stdout));
            return;
          } catch {
            if (!error) {
              reject(Object.assign(new Error("Transcription service returned invalid JSON."), {
                code: "INVALID_JSON"
              }));
              return;
            }
          }
        }
        if (error) {
          reject(error);
          return;
        }
        reject(Object.assign(new Error("Transcription service returned no result."), {
          code: "EMPTY_RESULT"
        }));
      }
    );
  });
};

export const createUploadAudioHandler = ({ transcribe = runTranscriber } = {}) =>
  async (req, res) => {
    let temporaryDirectory;

    try {
      if (!req.user?.userId) {
        return res.status(401).json(responseError(
          "authentication_required",
          "Please sign in before uploading a recording."
        ));
      }

      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!buffer.length) {
        return res.status(400).json(responseError(
          "empty_audio",
          "No audio was received. Record a short sample and try again."
        ));
      }
      if (buffer.length > MAX_AUDIO_BYTES) {
        return res.status(413).json(responseError(
          "audio_too_large",
          "Audio must be 12 MB or smaller. Please record a shorter sample."
        ));
      }

      const contentType = (req.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const extension = extensionsByMimeType[contentType];
      if (!extension) {
        return res.status(415).json(responseError(
          "unsupported_audio_type",
          "Use a supported WAV, WebM, MP3, MP4, or Ogg audio recording."
        ));
      }
      if (!isAudioSignatureValid(buffer, extension)) {
        return res.status(415).json(responseError(
          "audio_type_mismatch",
          "The recording contents do not match the declared audio type."
        ));
      }

      temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "mindscan-audio-"));
      const filePath = path.join(temporaryDirectory, `recording.${extension}`);
      await writeFile(filePath, buffer, { flag: "wx", mode: 0o600 });

      let transcription;
      try {
        transcription = await transcribe(filePath);
      } catch (error) {
        const timedOut = error?.code === "ETIMEDOUT";
        console.error("Audio transcription failed.", error?.code || error?.name || "unknown");
        return res.status(timedOut ? 504 : 503).json(responseError(
          timedOut ? "transcription_timeout" : "transcription_unavailable",
          timedOut
            ? "Transcription took too long. Please try a shorter recording."
            : "Speech transcription is temporarily unavailable. You may retry or continue without it."
        ));
      }

      if (!transcription || transcription.status !== "success") {
        const error = transcription?.error;
        const errorCode = typeof error?.code === "string"
          ? error.code
          : "transcription_unavailable";
        const message = typeof error?.message === "string"
          ? error.message
          : "Speech transcription is temporarily unavailable. You may retry or continue without it.";
        const rejected = transcription?.processing_status === "rejected";
        return res.status(rejected ? 422 : 503).json({
          ...responseError(errorCode, message),
          processing_status: transcription?.processing_status || "failed",
          audio_duration_seconds: transcription?.audio_duration_seconds ?? null
        });
      }

      const speechFeatures = transcription.speech_features || null;
      const classifier = transcription.classifier
        && typeof transcription.classifier === "object"
        ? transcription.classifier
        : {
            status: "unavailable",
            message: "Research analysis only — classifier unavailable."
          };
      return res.status(200).json({
        status: "success",
        processing_status: "completed",
        audio_duration_seconds: transcription.duration_seconds,
        transcription,
        speech_features: speechFeatures,
        transcript_analysis: transcription.transcript_analysis || null,
        classifier,
        error: null
      });
    } catch (error) {
      console.error("Audio upload processing failed.", error?.code || error?.name || "unknown");
      return res.status(500).json(responseError(
        "audio_processing_failed",
        "The audio could not be processed. Please retry or continue without a transcript."
      ));
    } finally {
      if (temporaryDirectory) {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    }
  };

export const getAudioAgentAnalysis = async (req, res) =>
  res.status(200).json({
    result: {
      status: "unavailable",
      code: "model_unavailable",
      model_version: null,
      output: null,
      missing_inputs: ["authorized_participant_labeled_speech_model"],
      limitation:
        "Research analysis only — classifier unavailable. Transcription and descriptive speech measurements are not dementia-related speech inference."
    }
  });

export const uploadAudioSample = createUploadAudioHandler();
