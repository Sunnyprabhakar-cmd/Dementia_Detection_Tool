import { execFile } from "node:child_process";
import fs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/db.js";
import { saveTaskResponse } from "./screeningService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const localPython = path.join(projectRoot, ".venv", "Scripts", "python.exe");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const parseImageDataUrl = (dataUrl) => {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("A valid PNG or JPEG image data URL is required.");
  }
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error("Only base64-encoded PNG or JPEG images are supported.");
  }
  const ext = match[1].toLowerCase() === "png" ? "png" : "jpg";
  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Drawing image must be non-empty and 5 MB or smaller.");
  }

  const isPng = ext === "png"
    && buffer.length >= 8
    && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpg = ext === "jpg"
    && buffer.length >= 3
    && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!isPng && !isJpg) {
    throw new Error("Image file signature does not match declared PNG/JPEG format.");
  }

  return { buffer, extension: ext };
};

const defaultRunAnalyzer = ({ imagePath, strokesPath, completionTimeSeconds }) => {
  const pythonPath = process.env.PYTHON_EXECUTABLE
    || (fs.existsSync(localPython) ? localPython : "python");
  const args = ["-m", "Backend.ml.analyze_drawing", "--image", imagePath];
  if (strokesPath) args.push("--strokes", strokesPath);
  if (Number.isFinite(completionTimeSeconds)) {
    args.push("--time", String(completionTimeSeconds));
  }

  return new Promise((resolve, reject) => {
    execFile(
      pythonPath,
      args,
      {
        cwd: projectRoot,
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, PYTHONPATH: projectRoot }
      },
      (error, stdout) => {
        if (stdout) {
          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed);
            return;
          } catch {
            // fall through to error
          }
        }
        reject(error || new Error("Drawing analyzer returned no output."));
      }
    );
  });
};

export const analyzeDrawingSubmission = async (
  { imageDataUrl, strokes = null, completionTimeSeconds = null },
  { runAnalyzer = defaultRunAnalyzer } = {}
) => {
  const { buffer, extension } = parseImageDataUrl(imageDataUrl);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "mindscan-drawing-"));
  try {
    const imagePath = path.join(tmpDir, `clock.${extension}`);
    await writeFile(imagePath, buffer);
    let strokesPath = null;
    if (Array.isArray(strokes)) {
      strokesPath = path.join(tmpDir, "strokes.json");
      await writeFile(strokesPath, JSON.stringify(strokes), "utf8");
    }
    const analysis = await runAnalyzer({ imagePath, strokesPath, completionTimeSeconds });
    if (!analysis || analysis.status !== "complete" || !analysis.features) {
      throw new Error(analysis?.message || "Drawing image could not be analyzed.");
    }
    return analysis;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
};

export const submitClockDrawing = async (
  screeningId,
  userId,
  payload = {},
  { analyzer = analyzeDrawingSubmission, saver = saveTaskResponse } = {}
) => {
  if (payload.skipped === true) {
    return saver(
      screeningId,
      userId,
      "clock_drawing",
      {
        skipped: true,
        skipReason: String(payload.skipReason || "Participant skipped clock drawing"),
        completionTimeSeconds: payload.completionTimeSeconds ?? null
      },
      payload.completionTimeSeconds ?? null
    );
  }

  const analysis = await analyzer({
    imageDataUrl: payload.imageDataUrl,
    strokes: payload.strokes ?? null,
    completionTimeSeconds: payload.completionTimeSeconds ?? null
  });

  const strokeCount = Array.isArray(payload.strokes)
    ? payload.strokes.length
    : (analysis.features?.stroke_count ?? null);

  return saver(
    screeningId,
    userId,
    "clock_drawing",
    {
      skipped: false,
      targetTime: String(payload.targetTime || "11:10"),
      completionTimeSeconds: payload.completionTimeSeconds ?? null,
      strokeCount,
      imageAnalysis: analysis.features,
      analysisMethod: analysis.method,
      analysisLimitation: analysis.limitation
    },
    payload.completionTimeSeconds ?? null
  );
};

export const getScreeningDrawing = async (screeningId, userId) => {
  const sid = Number(screeningId);
  const uid = Number(userId);
  const { rows } = await pool.query(
    `SELECT tr.id, tr.screening_id, tr.score, tr.reaction_time, tr.response_data, tr.created_at
     FROM task_responses tr
     JOIN screening_sessions ss ON ss.id = tr.screening_id
     WHERE tr.screening_id = $1 AND ss.user_id = $2 AND tr.task_type = 'clock_drawing'
     ORDER BY tr.created_at DESC, tr.id DESC
     LIMIT 1`,
    [sid, uid]
  );
  return rows[0] || null;
};

export const getUserDrawingHistory = async (userId) => {
  const uid = Number(userId);
  const { rows } = await pool.query(
    `SELECT tr.id, tr.screening_id, tr.score, tr.reaction_time, tr.response_data, tr.created_at
     FROM task_responses tr
     JOIN screening_sessions ss ON ss.id = tr.screening_id
     WHERE ss.user_id = $1 AND tr.task_type = 'clock_drawing'
     ORDER BY tr.created_at DESC, tr.id DESC
     LIMIT 50`,
    [uid]
  );
  return rows;
};
