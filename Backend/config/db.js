
import pg from "pg";
import "dotenv/config";
import { getDatabaseConfig } from "./databaseConfig.js";

const { Pool } = pg;

export const pool = new Pool(getDatabaseConfig());

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error.message);
});

export const checkDatabaseConnection = async () => {
  const result = await pool.query(`
    SELECT current_database() AS database,
           current_user AS username,
           NOW() AS server_time
  `);

  return result.rows[0];
};

export default pool;
