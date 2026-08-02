import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool, memoryDbStore } from "../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dementia-dev-secret";

// DEMO_EMAIL="sunny@gmail.com"
// DEMO_PASSWORD="123456"
export const Login = async (email, password) => {
  try {
    const result = await pool.query("Select * from users where email=$1", [email]);

    let user = null;
    if (result.rows.length > 0) {
      user = result.rows[0];
    }

    const demoUser = memoryDbStore.users.find((entry) => entry.email.toLowerCase() === String(email).toLowerCase());
    const isDemoLogin = email === "sunny@gmail.com" && password === "123456";

    if (isDemoLogin && demoUser) {
      user = demoUser;
    }

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const validPassword = isDemoLogin || (await bcrypt.compare(password, user.password_hash));
    if (!validPassword) {
      throw new Error("Invalid email or password");
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1d" });

    return {
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    };
  } catch (error) {
    throw error;
  }
};

export const Register = async (name, email, password, refer_by) => {
  try {
    const exists = memoryDbStore.users.some((user) => user.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      throw new Error("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: `user_${Date.now()}`,
      name,
      email,
      password_hash: hashedPassword,
      refer_by: refer_by || null
    };

    memoryDbStore.users.push(user);

    return {
      message: "Account creation successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    };
  } catch (error) {
    throw error;
  }
};
