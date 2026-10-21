import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import pg from "pg";
import { randomUUID } from "node:crypto";
import { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { iiits } from "../data/iiits.js";

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

function validateSettings() {
  const databaseUrl = new URL(requireValue("DATABASE_URL"));
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) throw new Error("DATABASE_URL must be a PostgreSQL URL");
  if (requireValue("SESSION_SECRET").length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");

  const endpoint = new URL(requireValue("AWS_ENDPOINT_URL_S3"));
  if (endpoint.protocol !== "https:") throw new Error("AWS_ENDPOINT_URL_S3 must use HTTPS");
  requireValue("AWS_ACCESS_KEY_ID");
  requireValue("AWS_SECRET_ACCESS_KEY");
  requireValue("AWS_REGION");
  requireValue("NEON_STORAGE_BUCKET");

  const upiId = requireValue("PAYMENT_UPI_ID");
  if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(upiId)) throw new Error("PAYMENT_UPI_ID is invalid");
  const payeeName = requireValue("PAYMENT_PAYEE_NAME");
  if (payeeName.length > 100) throw new Error("PAYMENT_PAYEE_NAME is too long");

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL);
    if (siteUrl.protocol !== "https:" && siteUrl.hostname !== "localhost") {
      throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS outside localhost");
    }
  }
  return databaseUrl;
}

async function checkDatabase(databaseUrl) {
  const local = ["localhost", "127.0.0.1"].includes(databaseUrl.hostname);
  const pool = new pg.Pool({ connectionString: databaseUrl.toString(), ssl: local ? false : { rejectUnauthorized: true }, max: 1 });
  try {
    const columns = await pool.query(`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name = any($1)
    `, [["users", "registration_drafts", "registrations", "students", "student_event_participations", "payment_transactions", "sessions", "rate_limits", "audit_log"]]);
    const found = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
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
    const accounts = await pool.query(`
      select count(*) filter (where role = 'iiit')::int as iiits,
             count(*) filter (where role = 'admin' and email is not null)::int as named_admins,
             count(*) filter (where role = 'admin')::int as admins
      from users
    `);
    if (accounts.rows[0].iiits !== iiits.length) throw new Error(`Expected ${iiits.length} IIIT accounts, found ${accounts.rows[0].iiits}`);
    if (accounts.rows[0].named_admins < 1) throw new Error("Database has no admin with an email; run npm run db:set-admin");
    if (accounts.rows[0].admins !== 1) console.warn(`WARN ${accounts.rows[0].admins} admin accounts exist; the organizer setup expects exactly one (npm run db:set-admin -- --remove-other-admins)`);
    console.log(`PASS PostgreSQL schema and accounts (${accounts.rows[0].iiits} IIITs, ${accounts.rows[0].named_admins} named admin)`);
  } finally {
    await pool.end();
  }
}

async function checkStorage() {
  const client = new S3Client({
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  try {
    const bucket = process.env.NEON_STORAGE_BUCKET;
    const key = `env-check/${randomUUID()}.txt`;
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    try {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "storage-ready", ContentType: "text/plain" }));
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const content = await object.Body.transformToString();
      if (content !== "storage-ready") throw new Error("Neon Object Storage returned unexpected content");
      console.log("PASS private Neon Object Storage upload and retrieval");
    } finally {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
  } finally {
    client.destroy();
  }
}

try {
  const databaseUrl = validateSettings();
  console.log("PASS required payment and session settings");
  await checkDatabase(databaseUrl);
  await checkStorage();
  console.log("Environment ready");
} catch (error) {
  console.error(`Environment check failed: ${error.message}`);
  process.exitCode = 1;
}
