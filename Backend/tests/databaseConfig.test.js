import test from "node:test";
import assert from "node:assert/strict";
import { getDatabaseConfig, getDatabaseConfigurationError } from "../config/databaseConfig.js";

test("DATABASE_URL is preferred and configured for verified TLS", () => {
  const config = getDatabaseConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://neondb_owner:secret@example.neon.tech/neondb?sslmode=require",
    DB_HOST: "ignored.example",
    DB_PASSWORD: "ignored"
  });
  assert.equal(config.connectionString.includes("secret"), true);
  assert.equal(new URL(config.connectionString).searchParams.has("sslmode"), false);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(config.database, undefined);
});

test("production individual database settings require all fields and TLS", () => {
  assert.match(
    getDatabaseConfigurationError({
      NODE_ENV: "production",
      DB_HOST: "db.example",
      DB_PORT: "5432",
      DB_USER: "neondb_owner",
      DB_NAME: "neondb"
    }),
    /DB_PASSWORD/
  );
  const config = getDatabaseConfig({
    NODE_ENV: "production",
    DB_HOST: "db.example",
    DB_PORT: "5432",
    DB_USER: "neondb_owner",
    DB_PASSWORD: "secret",
    DB_NAME: "neondb"
  });
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test("production rejects disabled TLS and certificate verification", () => {
  assert.throws(
    () => getDatabaseConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@example.test/neondb",
      DATABASE_SSL_REJECT_UNAUTHORIZED: "false"
    }),
    /not allowed in production/
  );
  assert.throws(
    () => getDatabaseConfig({
      NODE_ENV: "production",
      DB_HOST: "db.example",
      DB_PORT: "5432",
      DB_USER: "user",
      DB_PASSWORD: "pass",
      DB_NAME: "neondb",
      DATABASE_SSL: "false"
    }),
    /DATABASE_SSL=false/
  );
});
