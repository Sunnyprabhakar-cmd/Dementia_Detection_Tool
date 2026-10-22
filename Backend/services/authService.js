
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export const Login = async (email, password) => {
  const normalizedEmail = String(email).trim().toLowerCase();

  const { rows } = await pool.query(
    `SELECT id, name, email, password_hash
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new Error("Invalid email or password");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return {
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  };
};


export const Register = async (name, email, password, refer_by) => {
  const normalizedName = String(name).trim();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedName || !normalizedEmail || String(password).length < 8) {
    throw new Error("Name, email, and a password of at least 8 characters are required");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, refer_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email`,
    [normalizedName, normalizedEmail, hashedPassword, refer_by || null]
  );
  if (!rows.length) {
    const error = new Error("An account with this email already exists");
    error.statusCode = 409;
    throw error;
  }

  return {
    message: "Account creation successful",
    user: rows[0]
  };
};
