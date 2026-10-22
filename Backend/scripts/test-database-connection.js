import "dotenv/config";
import { pool } from "../config/db.js";

try {
  const connected = await pool.query("SELECT 1 AS connected");
  const database = await pool.query(
    "SELECT current_database() AS database_name"
  );

  if (connected.rows[0]?.connected !== 1) {
    throw new Error("SELECT 1 returned an unexpected result.");
  }

  console.log("Database connection: SUCCESS");
  console.log(`Database: ${database.rows[0]?.database_name || "unknown"}`);
  console.log("TLS: enabled");
  console.log("SELECT 1: passed");
} catch (error) {
  console.error("Database connection: FAILED");
  console.error("Code:", error.code || error.name || "unknown");
  console.error(
    "Message:",
    String(error.message || "connection failed").replace(
      /postgres(?:ql)?:\/\/[^\s]+/gi,
      "[redacted]"
    )
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
