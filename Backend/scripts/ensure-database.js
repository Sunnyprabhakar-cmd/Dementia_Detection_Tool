import "dotenv/config";
import pg from "pg";
import { checkDatabaseConnection, pool } from "../config/db.js";
import { getDatabaseConfig } from "../config/databaseConfig.js";

const { Pool } = pg;
const databaseName = process.env.DB_NAME;
const validDatabaseName = /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/;

if (process.env.DATABASE_URL) {
  try {
    console.log(JSON.stringify(await checkDatabaseConnection()));
  } catch (error) {
    console.error(
      "Database connection check failed. Confirm DATABASE_URL is a valid Neon connection string and that its password is current.",
      error.code || error.name || "unknown error"
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
} else if (process.env.NODE_ENV === "production") {
  console.error(
    "Refusing automatic database creation in production. Configure DATABASE_URL and run the explicit migration command."
  );
  process.exitCode = 1;
} else if (!databaseName || !validDatabaseName.test(databaseName)) {
  console.error("DB_NAME is missing or invalid; use a simple PostgreSQL database name.");
  process.exitCode = 1;
} else {
  let maintenance;
  try {
    maintenance = new Pool(getDatabaseConfig(process.env, { databaseOverride: "postgres" }));
    const existing = await maintenance.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName]
    );
    if (!existing.rowCount) {
      try {
        await maintenance.query(`CREATE DATABASE "${databaseName}"`);
        console.log(`Created local database: ${databaseName}`);
      } catch (error) {
        if (error.code !== "42P04") throw error;
      }
    } else {
      console.log(`Database already exists: ${databaseName}`);
    }
    console.log(JSON.stringify(await checkDatabaseConnection()));
  } catch (error) {
    console.error(
      "Database setup failed. Confirm PostgreSQL is running and DB_USER has permission to create/connect to the configured database.",
      error.code || error.name || "unknown error"
    );
    process.exitCode = 1;
  } finally {
    await maintenance?.end();
    await pool.end();
  }
}
