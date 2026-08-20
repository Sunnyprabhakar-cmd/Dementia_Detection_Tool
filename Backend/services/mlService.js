import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..", "..");
const pythonPath = path.join(workspaceRoot, ".venv", "Scripts", "python.exe");
const modelScript = path.join(workspaceRoot, "Backend", "ml", "predict.py");

export const runPredictionModel = (record) => {
  return new Promise((resolve, reject) => {
    const safeRecord = record && typeof record === "object" ? record : {};
    execFile(
      pythonPath,
      [modelScript, "--record", JSON.stringify(safeRecord)],
      { cwd: workspaceRoot },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }

        try {
          const output = stdout.toString().trim();
          const result = JSON.parse(output);
          if (result?.status === "error") {
            reject(new Error(result.message || "ML inference failed"));
            return;
          }
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse ML model output: ${stdout.toString()}`));
        }
      }
    );
  });
};
