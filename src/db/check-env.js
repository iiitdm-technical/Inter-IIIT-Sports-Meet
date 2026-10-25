import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

import { createDatabasePool } from "./index.js";
import { checkStorage, storageMode } from "../lib/storage/index.js";
import { iiits } from "../data/iiits.js";

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

function validateSettings() {
  const databaseUrl = new URL(requireValue("DATABASE_URL"));
  if (databaseUrl.protocol !== "mysql:") throw new Error("DATABASE_URL must be a MySQL URL using mysql://");
  if ((process.env.SESSION_SECRET || "").length < 32) console.warn("WARN SESSION_SECRET is not set to 32+ characters; sessions still work (SHA-256 token hashes) but setting it adds an HMAC key");

  if (storageMode() === "local") {
    requireValue("PROOF_STORAGE_DIR");
  } else {
    const endpoint = new URL(requireValue("AWS_ENDPOINT_URL_S3"));
    if (endpoint.protocol !== "https:") throw new Error("AWS_ENDPOINT_URL_S3 must use HTTPS");
    requireValue("AWS_ACCESS_KEY_ID");
    requireValue("AWS_SECRET_ACCESS_KEY");
    requireValue("AWS_REGION");
    requireValue("NEON_STORAGE_BUCKET");
  }

  if (process.env.PAYMENT_UPI_ID || process.env.PAYMENT_PAYEE_NAME) {
    const upiId = requireValue("PAYMENT_UPI_ID");
    if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(upiId)) throw new Error("PAYMENT_UPI_ID is invalid");
    const payeeName = requireValue("PAYMENT_PAYEE_NAME");
    if (payeeName.length > 100) throw new Error("PAYMENT_PAYEE_NAME is too long");
  } else {
    console.warn("WARN official UPI settings are unset; the optional payment QR remains disabled.");
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL);
    if (siteUrl.protocol !== "https:" && siteUrl.hostname !== "localhost") {
      throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS outside localhost");
    }
  }
  return databaseUrl;
}

async function checkDatabase(databaseUrl) {
  const pool = createDatabasePool(databaseUrl.toString());
  try {
    const tableNames = ["users", "registration_drafts", "registrations", "students", "student_event_participations", "payment_transactions", "sessions", "rate_limits", "audit_log"];
    const [columns] = await pool.execute(`
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tableNames.map(() => "?").join(", ")})
    `, tableNames);
    const found = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
    const requiredColumns = [
      "users.username", "users.email", "users.display_name", "users.password_hash", "users.role", "users.iiit_code",
      "registration_drafts.iiit_code", "registration_drafts.contact_details", "registration_drafts.slots_map", "registration_drafts.revision",
      "registrations.id", "registrations.iiit_code", "registrations.status", "registrations.total_students_count",
      "students.registration_id", "students.iiit_code", "students.roll_number", "students.gender",
      "student_event_participations.registration_id", "student_event_participations.student_id", "student_event_participations.sport_id",
      "payment_transactions.registration_id", "payment_transactions.proof_pathname", "payment_transactions.verification_status",
      "sessions.id", "sessions.user_id", "sessions.expires_at", "rate_limits.key", "rate_limits.count", "audit_log.action",
    ];
    for (const expected of requiredColumns) {
      if (!found.has(expected)) throw new Error(`Database migration missing: ${expected}`);
    }
    const [sessionRows] = await pool.query("SELECT @@session.time_zone AS session_timezone");
    if (sessionRows[0]?.session_timezone !== "+00:00") {
      throw new Error(`MySQL session timezone is not UTC (${sessionRows[0]?.session_timezone ?? "unknown"})`);
    }

    const [accountRows] = await pool.query(`
      SELECT COUNT(CASE WHEN role = 'iiit' THEN 1 END) AS iiits,
             COUNT(CASE WHEN role = 'admin' AND email IS NOT NULL THEN 1 END) AS named_admins,
             COUNT(CASE WHEN role = 'admin' THEN 1 END) AS admins
      FROM users
    `);
    const accounts = {
      iiits: Number(accountRows[0].iiits),
      namedAdmins: Number(accountRows[0].named_admins),
      admins: Number(accountRows[0].admins),
    };
    if (accounts.iiits !== iiits.length) throw new Error(`Expected ${iiits.length} IIIT accounts, found ${accounts.iiits}`);
    if (accounts.namedAdmins < 1) throw new Error("Database has no admin with an email; run npm run db:set-admin");
    if (accounts.admins !== 1) console.warn(`WARN ${accounts.admins} admin accounts exist; the organizer setup expects exactly one (npm run db:set-admin -- --remove-other-admins)`);
    console.log(`PASS MySQL schema and accounts (${accounts.iiits} IIITs, ${accounts.namedAdmins} named admin)`);
  } finally {
    await pool.end();
  }
}

try {
  const databaseUrl = validateSettings();
  console.log("PASS required payment and session settings");
  await checkDatabase(databaseUrl);
  console.log(`PASS payment proof storage write, read and delete (${await checkStorage()})`);
  console.log("Environment ready");
} catch (error) {
  console.error(`Environment check failed: ${error.message}`);
  process.exitCode = 1;
}
