import express from "express";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/authRoutes.js";
import screeningRoutes from "./routes/screeningRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import mlRoutes from "./routes/mlRoutes.js";
import audioRoutes from "./routes/audioRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";
import { checkDatabaseConnection } from "./config/db.js";
import { getDatabaseConfigurationError } from "./config/databaseConfig.js";

const PORT = Number(process.env.PORT) || 3001;
const app = express();

const configuredOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin: configuredOrigins.length
    ? (origin, callback) => {
        if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by CORS."));
      }
    : true
}));

app.get("/", (req, res) => {
  res.json({
    message: "MindScan AI server is running",
    status: "healthy"
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const database = await checkDatabaseConnection();
    return res.status(200).json({
      status: "healthy",
      database: "connected",
      databaseName: database.database
    });
  } catch (error) {
    console.error("Health check database query failed.", error.code || error.name || "unknown");
    return res.status(503).json({
      status: "unavailable",
      database: "unavailable",
      message: "The API is running but cannot connect to PostgreSQL."
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/screening", screeningRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/results", resultRoutes);

const server = app.listen(PORT, () => {
  const configurationErrors = [];
  const databaseConfigurationError = getDatabaseConfigurationError();
  if (databaseConfigurationError) {
    configurationErrors.push(databaseConfigurationError);
  }
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    configurationErrors.push("JWT_SECRET is required in production.");
  }
  if (process.env.NODE_ENV === "production" && !configuredOrigins.length) {
    configurationErrors.push("CORS_ORIGIN is required in production.");
  }
  if (configurationErrors.length) {
    console.error(`Startup configuration is invalid: ${configurationErrors.join(" ")}`);
    server.close(() => process.exit(1));
    return;
  }
  console.log(`MindScan AI server is running on port ${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the process using that specific port or set PORT to another value.`);
  } else {
    console.error(`MindScan AI server failed to start: ${error.message}`);
  }
  process.exitCode = 1;
});