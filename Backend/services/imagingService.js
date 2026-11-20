import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/db.js";
import { isClinicianAuthorizedForScreening } from "./clinicianService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const storageRoot = path.join(projectRoot, "Backend", "storage", "imaging");
const localPython = path.join(projectRoot, ".venv", "Scripts", "python.exe");
const MAX_IMAGING_BYTES = 50 * 1024 * 1024;

export const resolveSafeImagingExtension = (filename = "") => {
  const lower = String(filename).trim().toLowerCase();
  if (lower.endsWith(".nii.gz")) return ".nii.gz";
  if (lower.endsWith(".nii")) return ".nii";
  if (lower.endsWith(".dcm")) return ".dcm";
  if (lower.endsWith(".zip")) return ".zip";
  throw new Error("Unsupported imaging format. Allowed: .nii, .nii.gz, .dcm, .zip");
};

const defaultRunImagingAnalyzer = ({ filePath, modality }) => {
  const pythonPath = process.env.PYTHON_EXECUTABLE
    || (fs.existsSync(localPython) ? localPython : "python");
  return new Promise((resolve, reject) => {
    execFile(
      pythonPath,
      ["-m", "Backend.ml.analyze_imaging", "--file", filePath, "--modality", modality],
      {
        cwd: projectRoot,
        windowsHide: true,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, PYTHONPATH: projectRoot }
      },
      (error, stdout) => {
        if (stdout) {
          try {
            resolve(JSON.parse(stdout));
            return;
          } catch {
            // fall through
          }
        }
        reject(error || new Error("Imaging analyzer failed."));
      }
    );
  });
};

export const uploadAndAnalyzeBrainScan = async (
  { screeningId, userId, modality, originalFilename, buffer },
  { analyzer = defaultRunImagingAnalyzer, dbPool = pool } = {}
) => {
  const sid = Number(screeningId);
  const uid = Number(userId);
  const cleanModality = String(modality || "").trim().toLowerCase();
  if (!Number.isSafeInteger(sid) || sid <= 0) throw new Error("Invalid screening ID");
  if (!["mri", "ct"].includes(cleanModality)) throw new Error("Modality must be 'mri' or 'ct'");
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_IMAGING_BYTES) {
    throw new Error("Imaging file must be non-empty and 50 MB or smaller.");
  }

  const ext = resolveSafeImagingExtension(originalFilename);
  const sessionCheck = await dbPool.query(
    "SELECT id FROM screening_sessions WHERE id = $1 AND user_id = $2",
    [sid, uid]
  );
  if (!sessionCheck.rows.length) {
    const err = new Error("Screening not found for this user");
    err.statusCode = 403;
    throw err;
  }

  const userDir = path.join(storageRoot, String(uid));
  await mkdir(userDir, { recursive: true });
  const storageKey = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(userDir, storageKey);
  await writeFile(fullPath, buffer, { flag: "wx", mode: 0o600 });

  let analysis;
  try {
    analysis = await analyzer({ filePath: fullPath, modality: cleanModality });
    if (!analysis || analysis.status !== "validated") {
      throw new Error(analysis?.message || "Imaging file failed validation.");
    }
  } catch (error) {
    await rm(fullPath, { force: true }).catch(() => {});
    throw error;
  }

  const formatCode = analysis.deidentified_metadata?.format || "nifti";
  const { rows } = await dbPool.query(
    `INSERT INTO brain_imaging_scans
       (screening_id, user_id, modality, original_format, storage_key, file_sha256,
        file_size_bytes, deidentified_metadata, quality_warnings, preprocessing_summary,
        model_output, processing_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, 'validated')
     RETURNING id, screening_id, modality, original_format, file_sha256, file_size_bytes,
               deidentified_metadata, quality_warnings, preprocessing_summary, model_output,
               processing_status, created_at`,
    [
      sid,
      uid,
      cleanModality,
      formatCode,
      `${uid}/${storageKey}`,
      analysis.file_sha256,
      buffer.length,
      JSON.stringify(analysis.deidentified_metadata || {}),
      JSON.stringify(analysis.quality_warnings || []),
      JSON.stringify(analysis.preprocessing_summary || {}),
      JSON.stringify(analysis.model_output || {})
    ]
  );
  return rows[0];
};

export const listScansForScreening = async (screeningId, userId, role = "patient") => {
  const sid = Number(screeningId);
  if (!Number.isSafeInteger(sid) || sid <= 0) throw new Error("Invalid screening ID");
  if (role === "clinician") {
    const auth = await isClinicianAuthorizedForScreening(userId, sid);
    if (!auth) {
      const err = new Error("Not authorized to view imaging for this screening");
      err.statusCode = 403;
      throw err;
    }
    const { rows } = await pool.query(
      `SELECT id, screening_id, modality, original_format, file_sha256, file_size_bytes,
              deidentified_metadata, quality_warnings, preprocessing_summary, model_output,
              processing_status, created_at
       FROM brain_imaging_scans WHERE screening_id = $1 ORDER BY created_at DESC`,
      [sid]
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT id, screening_id, modality, original_format, file_sha256, file_size_bytes,
            deidentified_metadata, quality_warnings, preprocessing_summary, model_output,
            processing_status, created_at
     FROM brain_imaging_scans WHERE screening_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
    [sid, Number(userId)]
  );
  return rows;
};

export const deleteUserBrainScan = async (scanId, userId) => {
  const id = Number(scanId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid scan ID");
  const { rows } = await pool.query(
    "DELETE FROM brain_imaging_scans WHERE id = $1 AND user_id = $2 RETURNING id, storage_key",
    [id, Number(userId)]
  );
  if (!rows.length) {
    const err = new Error("Scan not found for this user");
    err.statusCode = 404;
    throw err;
  }
  const safePath = path.resolve(storageRoot, rows[0].storage_key);
  if (safePath.startsWith(storageRoot)) {
    await rm(safePath, { force: true }).catch(() => {});
  }
  return { deleted: true, id: rows[0].id };
};
