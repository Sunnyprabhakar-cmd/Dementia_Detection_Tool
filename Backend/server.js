import express from "express";
import cors from "cors";
import "dotenv/config";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/authRoutes.js";
import screeningRoutes from "./routes/screeningRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import mlRoutes from "./routes/mlRoutes.js";
import audioRoutes from "./routes/audioRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import clinicianRoutes from "./routes/clinicianRoutes.js";
import drawingRoutes from "./routes/drawingRoutes.js";
import riskAssessmentRoutes from "./routes/riskAssessmentRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import imagingRoutes from "./routes/imagingRoutes.js";
import { checkDatabaseConnection, pool } from "./config/db.js";
import { getDatabaseConfigurationError } from "./config/databaseConfig.js";
import { createRateLimiter, securityHeadersMiddleware } from "./middleware/securityMiddleware.js";

const PORT = Number(process.env.PORT) || 3001;
export const PRODUCTION_FRONTEND_ORIGIN = "https://dementia-detection-tool.vercel.app";

const configuredOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const productionOrigins = configuredOrigins.length
  ? configuredOrigins
  : [PRODUCTION_FRONTEND_ORIGIN];

export const corsOptions = {
  origin: configuredOrigins.length || process.env.NODE_ENV === "production"
    ? (origin, callback) => {
        if (!origin || productionOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by CORS."));
      }
    : true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-screening-id", "x-imaging-modality", "x-file-name"],
  optionsSuccessStatus: 204
};

export const app = express();
app.disable("x-powered-by");

app.use(securityHeadersMiddleware);
app.use(express.json({ limit: "6mb" }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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

const authRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 60 });
const audioRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/screening", screeningRoutes);
app.use("/api/screening", drawingRoutes);
app.use("/api/screening", riskAssessmentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/audio", audioRateLimiter, audioRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/clinician", clinicianRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/imaging", imagingRoutes);

app.use((err, req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  console.error("Unhandled API error:", err.code || err.name || "Error");
  return res.status(status).json({
    message: status < 500 ? err.message : "An unexpected server error occurred."
  });
});

export const validateStartupConfiguration = () => {
  const configurationErrors = [];
  const databaseConfigurationError = getDatabaseConfigurationError();
  if (databaseConfigurationError) {
    configurationErrors.push(databaseConfigurationError);
  }
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    configurationErrors.push("JWT_SECRET is required in production.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CORS_ORIGIN &&
    process.env.CORS_ORIGIN !== PRODUCTION_FRONTEND_ORIGIN
  ) {
    configurationErrors.push(
      `CORS_ORIGIN must equal ${PRODUCTION_FRONTEND_ORIGIN} in production.`
    );
  }
  return configurationErrors;
};

export const startServer = () => {
  const server = app.listen(PORT, () => {
    const configurationErrors = validateStartupConfiguration();
    if (configurationErrors.length) {
      console.error(`Startup configuration is invalid: ${configurationErrors.join(" ")}`);
      server.close(() => process.exit(1));
      return;
    }
    if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGIN) {
      console.warn(
        `CORS_ORIGIN is not set; using the built-in exact production origin ${PRODUCTION_FRONTEND_ORIGIN}.`
      );
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

  return server;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = startServer();
  const shutdown = async (signal) => {
    console.log(`Received ${signal}; shutting down gracefully...`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason?.name || "Unknown");
  });
}