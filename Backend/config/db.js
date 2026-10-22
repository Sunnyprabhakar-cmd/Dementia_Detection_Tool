
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: false,
  connectionTimeoutMillis: 10000
});

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
