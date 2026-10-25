import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import * as schema from "./schema.js";

const poolSymbol = Symbol.for("inter-iiit-sports-meet.mysql-pool");

/** Build strict, explicit mysql2 options from a mysql:// DATABASE_URL. */
export function getDatabasePoolOptions(databaseUrl, { tlsMode } = {}) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid mysql:// URL");
  }

  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql: protocol");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) throw new Error("DATABASE_URL must include a MySQL hostname");

  let database;
  let user;
  let password;
  try {
    database = decodeURIComponent(url.pathname.slice(1));
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error("DATABASE_URL contains invalid percent-encoding");
  }
  if (!database) throw new Error("DATABASE_URL must include a database name");

  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const selectedTlsMode = tlsMode ?? process.env.MYSQL_TLS_MODE ?? (isLocalhost ? "disabled" : "verify");
  if (!["verify", "require", "disabled"].includes(selectedTlsMode)) {
    throw new Error('MYSQL_TLS_MODE must be "verify", "require", or "disabled"');
  }
  if (selectedTlsMode === "disabled" && !isLocalhost) {
    throw new Error("MYSQL_TLS_MODE=disabled is only permitted for loopback MySQL hosts");
  }

  const ssl = selectedTlsMode === "disabled"
    ? false
    : {
      rejectUnauthorized: selectedTlsMode === "verify",
      verifyIdentity: selectedTlsMode === "verify",
    };
  return {
    host: hostname,
    port: url.port ? Number(url.port) : 3306,
    user,
    password,
    database,
    charset: "utf8mb4",
    timezone: "Z",
    ssl,
    waitForConnections: true,
    connectionLimit: 2,
  };
}

/** Create a promise pool and pin every server session to UTC before use. */
export function createDatabasePool(databaseUrl, options) {
  const poolOptions = getDatabasePoolOptions(databaseUrl, options);
  const pool = createPool(poolOptions);
  if (poolOptions.ssl && !poolOptions.ssl.rejectUnauthorized) {
    console.warn("WARNING: MYSQL_TLS_MODE=require encrypts MySQL traffic without verifying the server certificate or identity; this is vulnerable to man-in-the-middle attacks.");
  }
  pool.on("connection", (connection) => {
    // mysql2 emits this synchronously before handing a new connection to its
    // caller, so this command is queued ahead of the caller's first query.
    connection.query("SET SESSION time_zone = '+00:00'", (error) => {
      if (error) connection.destroy();
    });
  });
  return pool;
}

export function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not defined. Please set it in your .env.local file.");
  }

  if (!globalThis[poolSymbol]) globalThis[poolSymbol] = createDatabasePool(databaseUrl);
  return globalThis[poolSymbol];
}

export function getDb() {
  return drizzle(getPool(), { schema, mode: "default" });
}

export const db = new Proxy({}, {
  get(_target, prop) {
    const instance = getDb();
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
