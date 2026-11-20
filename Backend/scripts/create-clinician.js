import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../config/db.js";

const [, , name, email, password] = process.argv;

if (!name || !email || !password || password.length < 8) {
  console.error("Usage: node Backend/scripts/create-clinician.js <name> <email> <password(min 8 chars)>");
  process.exit(1);
}

try {
  const hashed = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'clinician')
     ON CONFLICT (email) DO UPDATE SET role = 'clinician'
     RETURNING id, name, email, role`,
    [name.trim(), email.trim().toLowerCase(), hashed]
  );
  console.log("Clinician provisioned:", rows[0]);
} catch (error) {
  console.error("Clinician provisioning failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
