import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/db.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(currentDirectory, "..", "database", "migrations");

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT
    )
  `);
  await pool.query(
    "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT"
  );

  const files = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const name of files) {
    const sql = await readFile(path.join(migrationDirectory, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await pool.query(
      "SELECT checksum FROM schema_migrations WHERE name = $1",
      [name]
    );
    if (existing.rowCount) {
      const recordedChecksum = existing.rows[0].checksum;
      if (recordedChecksum && recordedChecksum !== checksum) {
        throw new Error(`Applied migration was modified: ${name}`);
      }
      if (!recordedChecksum) {
        await pool.query(
          "UPDATE schema_migrations SET checksum = $2 WHERE name = $1 AND checksum IS NULL",
          [name, checksum]
        );
      }
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, checksum]
      );
      await client.query("COMMIT");
      console.log(`Applied migration: ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const requiredColumns = {
    users: ["id", "name", "email", "password_hash"],
    screening_sessions: ["id", "user_id", "status", "started_at", "completed_at"],
    screening_patient_profiles: ["screening_id", "age", "consent_at"],
    task_responses: ["id", "screening_id", "task_type", "response_data", "score"],
    screening_results: [
      "id", "screening_id", "memory_score", "attention_score",
      "language_score", "orientation_score", "task_scores",
      "recommendation", "flags", "risk_score"
    ]
  };
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = $1`,
      [table]
    );
    const available = new Set(result.rows.map((row) => row.column_name));
    const missing = columns.filter((column) => !available.has(column));
    if (missing.length) {
      throw new Error(
        `Schema consistency check failed for ${table}; missing: ${missing.join(", ")}`
      );
    }
  }
  console.log("Database migrations and schema consistency check completed.");
} catch (error) {
  console.error("Database migrations failed.", error.code || error.name || "unknown error");
  process.exitCode = 1;
} finally {
  await pool.end();
}
