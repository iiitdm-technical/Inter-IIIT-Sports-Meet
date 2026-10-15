import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import pg from "pg";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";

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
      where table_schema = 'public' and (
        (table_name = 'users' and column_name in ('email', 'display_name')) or
        (table_name = 'registrations' and column_name = 'status') or
        (table_name = 'payment_transactions' and column_name = 'verification_status')
      )
    `);
    const found = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
    for (const expected of ["users.email", "users.display_name", "registrations.status", "payment_transactions.verification_status"]) {
      if (!found.has(expected)) throw new Error(`Database migration missing: ${expected}`);
    }
    const accounts = await pool.query(`
      select count(*) filter (where role = 'iiit')::int as iiits,
             count(*) filter (where role = 'admin' and email is not null)::int as named_admins
      from users
    `);
    if (accounts.rows[0].iiits < 1) throw new Error("Database has no IIIT accounts");
    if (accounts.rows[0].named_admins < 1) throw new Error("Database has no named admin with an email");
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
    await client.send(new HeadBucketCommand({ Bucket: process.env.NEON_STORAGE_BUCKET }));
    console.log("PASS private Neon Object Storage bucket reachable");
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
