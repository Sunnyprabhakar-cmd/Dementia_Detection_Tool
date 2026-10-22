import { URL } from "node:url";

const DATABASE_URL_KEYS = new Set([
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert"
]);

const asBoolean = (value, fallback) => {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() !== "false";
};

const sanitizedConnectionString = (value) => {
  const url = new URL(value);
  for (const key of DATABASE_URL_KEYS) url.searchParams.delete(key);
  return url.toString();
};

export const getDatabaseConfig = (environment = process.env, options = {}) => {
  const nodeEnv = environment.NODE_ENV || "development";
  const production = nodeEnv === "production";
  const databaseUrl = String(environment.DATABASE_URL || "").trim();
  const databaseName = options.databaseOverride || environment.DB_NAME;

  if (databaseUrl) {
    let connectionString;
    try {
      connectionString = sanitizedConnectionString(databaseUrl);
    } catch {
      throw new Error("DATABASE_URL is invalid; provide a PostgreSQL connection string.");
    }
    const rejectUnauthorized = asBoolean(
      environment.DATABASE_SSL_REJECT_UNAUTHORIZED,
      true
    );
    if (production && !rejectUnauthorized) {
      throw new Error("DATABASE_SSL_REJECT_UNAUTHORIZED=false is not allowed in production.");
    }
    return {
      connectionString,
      ssl: { rejectUnauthorized },
      connectionTimeoutMillis: 10000
    };
  }

  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((key) => !String(environment[key] || "").trim());
  if (production && missing.length) {
    throw new Error(`Missing production database environment variable(s): ${missing.join(", ")}.`);
  }

  const port = Number(environment.DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be a valid TCP port.");
  }
  const useTls = asBoolean(environment.DATABASE_SSL, production);
  const rejectUnauthorized = asBoolean(
    environment.DATABASE_SSL_REJECT_UNAUTHORIZED,
    true
  );
  if (production && !useTls) {
    throw new Error("DATABASE_SSL=false is not allowed in production.");
  }
  if (production && !rejectUnauthorized) {
    throw new Error("DATABASE_SSL_REJECT_UNAUTHORIZED=false is not allowed in production.");
  }

  return {
    host: environment.DB_HOST || "localhost",
    port,
    user: environment.DB_USER || "postgres",
    password: environment.DB_PASSWORD || undefined,
    database: databaseName || undefined,
    ...(useTls ? { ssl: { rejectUnauthorized } } : {}),
    connectionTimeoutMillis: 10000
  };
};

export const getDatabaseConfigurationError = (environment = process.env) => {
  try {
    getDatabaseConfig(environment);
    return null;
  } catch (error) {
    return error.message;
  }
};
