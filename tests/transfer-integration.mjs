/**
 * End-to-end PostgreSQL -> MySQL transfer rehearsal.
 *
 * This script writes to both databases. It requires two explicitly supplied,
 * loopback-only `transfer_test` databases and an explicit disposable-target
 * acknowledgment. Schemas must already be migrated (archived PostgreSQL
 * migrations and the current MySQL DATETIME(6) baseline):
 *
 *   TEST_TRANSFER_DISPOSABLE=1 \
 *   TEST_SOURCE_DATABASE_URL=postgres://postgres:...@127.0.0.1:33317/transfer_test \
 *   TEST_TARGET_DATABASE_URL=mysql://root:...@127.0.0.1:33316/transfer_test \
 *   node tests/transfer-integration.mjs
 *
 * Cleanup uses only this test's exact keys (and fixture markers where present).
 * No schema or database is dropped.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import pg from "pg";
import mysql from "mysql2/promise";

const { Pool } = pg;

const TABLES = [
  "users",
  "registrations",
  "registration_drafts",
  "students",
  "student_event_participations",
  "payment_transactions",
  "sessions",
  "rate_limits",
  "audit_log",
];

const EXPECTED_COUNTS = {
  users: 5,
  registrations: 3,
  registration_drafts: 2,
  students: 5,
  student_event_participations: 6,
  payment_transactions: 2,
  sessions: 3,
  rate_limits: 3,
  audit_log: 6,
};

const USER_CODES = ["XFER-ALPHA", "XFER-BETA", "XFER-GAMMA", "XFER-DELTA"];
const USER_IDS = [7, 19, 43, 61, 71];
const REGISTRATION_IDS = [11, 29, 53];
const DRAFT_CODES = ["XFER-BETA", "XFER-DELTA"];
const STUDENT_IDS = [17, 31, 47, 68, 89];
const PARTICIPATION_IDS = [23, 37, 59, 83, 101, 127];
const PAYMENT_IDS = [13, 61];
const SESSION_IDS = ["f".repeat(64), "e".repeat(64), "d".repeat(64)];
const RATE_LIMIT_KEYS = [
  "xfer-fixture:login:alpha",
  "xfer-fixture:login:beta",
  "xfer-fixture:submission:gamma",
];
const AUDIT_IDS = [113, 127, 151, 173, 199, 223];
const JSON_NULL = Symbol("JSON null; distinct from SQL NULL");

const FIXTURES = [
  {
    table: "users",
    columns: ["id", "username", "email", "display_name", "password_hash", "role", "iiit_name", "iiit_code", "created_at", "updated_at"],
    rows: [
      [7, "xfer-fixture-alpha", "alpha@example.test", "Alpha 🏸", "fixture-hash-alpha", "iiit", "Alpha Institute", "XFER-ALPHA", "2026-10-25T08:15:16.123456Z", "2026-10-25T08:16:17.456789Z"],
      [19, "xfer-fixture-beta", null, null, "fixture-hash-beta", "iiit", "Béta Institute", "XFER-BETA", new Date("2026-10-25T08:17:18.234Z"), new Date("2026-10-25T08:18:19.567Z")],
      [43, "xfer-fixture-gamma", "gamma@example.test", "गामा टीम", "fixture-hash-gamma", "iiit", "Gamma Institute", "XFER-GAMMA", new Date("2026-10-25T08:19:20.345Z"), new Date("2026-10-25T08:20:21.678Z")],
      [61, "xfer-fixture-delta", "delta@example.test", "Delta Draft", "fixture-hash-delta", "iiit", "Delta Institute", "XFER-DELTA", new Date("2026-10-25T08:21:22.345Z"), new Date("2026-10-25T08:21:23.456Z")],
      [71, "xfer-fixture-admin", null, "Transfer Fixture Admin", "fixture-hash-admin", "admin", null, null, new Date("2026-10-25T08:21:22.456Z"), new Date("2026-10-25T08:22:23.789Z")],
    ],
  },
  {
    table: "registrations",
    columns: ["id", "iiit_code", "iiit_name", "status", "submitted_at", "submitted_by", "contact_name", "contact_email", "contact_phone", "total_students_count", "notes", "created_at", "updated_at"],
    rows: [
      [11, "XFER-ALPHA", "Alpha Institute", "submitted", "2026-10-25T09:10:11.123456Z", "fixture-alpha", "Asha Rao", "asha@example.test", "+91-555-0101", 2, "Synthetic roster; मौसम अच्छा है.", new Date("2026-10-25T09:11:12.234Z"), new Date("2026-10-25T09:12:13.345Z")],
      [29, "XFER-BETA", "Béta Institute", "payment_pending", new Date("2026-10-25T09:13:14.456Z"), "fixture-beta", "Zoë 李", "zoe@example.test", "+91-555-0102", 2, null, new Date("2026-10-25T09:14:15.567Z"), new Date("2026-10-25T09:15:16.678Z")],
      [53, "XFER-GAMMA", "Gamma Institute", "submitted", new Date("2026-10-25T09:16:17.789Z"), "fixture-gamma", "கவி", "kavi@example.test", "+91-555-0103", 1, "Unicode and millisecond timestamp fixture.", new Date("2026-10-25T09:17:18.890Z"), new Date("2026-10-25T09:18:19.901Z")],
    ],
  },
  {
    table: "registration_drafts",
    columns: ["iiit_code", "contact_details", "slots_map", "revision", "updated_at"],
    jsonColumns: ["contact_details", "slots_map"],
    rows: [
      ["XFER-BETA", { contact: { name: "Zoë 李", email: "zoe@example.test" }, phones: ["+91-555-0102", null], consent: true }, { badminton: { singles: ["B-01", "B-02"], reserve: false }, athletics: [] }, 4, new Date("2026-10-25T10:01:02.345Z")],
      ["XFER-DELTA", { name: "दिया", nested: { note: "draft only", nullable: null } }, { kabaddi: [{ team: "Delta", slots: 7 }, { team: "reserve", slots: 1 }] }, 2, new Date("2026-10-25T10:03:04.567Z")],
    ],
  },
  {
    table: "students",
    columns: ["id", "registration_id", "iiit_code", "roll_number", "name", "gender", "created_at", "updated_at"],
    rows: [
      [17, 11, "XFER-ALPHA", "A-001", "Aarav Kumar", "M", new Date("2026-10-25T11:01:02.123Z"), new Date("2026-10-25T11:02:03.234Z")],
      [31, 11, "XFER-ALPHA", "A-002", "आन्या शर्मा", "F", new Date("2026-10-25T11:03:04.345Z"), new Date("2026-10-25T11:04:05.456Z")],
      [47, 29, "XFER-BETA", "B-001", "李明", "M", new Date("2026-10-25T11:05:06.567Z"), new Date("2026-10-25T11:06:07.678Z")],
      [68, 29, "XFER-BETA", "B-002", "Zoë O’Connor", "F", new Date("2026-10-25T11:07:08.789Z"), new Date("2026-10-25T11:08:09.890Z")],
      [89, 53, "XFER-GAMMA", "G-001", "கார்த்திக்", "M", new Date("2026-10-25T11:09:10.901Z"), new Date("2026-10-25T11:10:11.012Z")],
    ],
  },
  {
    table: "student_event_participations",
    columns: ["id", "registration_id", "student_id", "sport_id", "event_id", "gender", "is_reserve", "created_at"],
    rows: [
      [23, 11, 17, "badminton", "singles", "M", false, new Date("2026-10-25T12:01:02.123Z")],
      [37, 11, 31, "badminton", "singles", "F", true, new Date("2026-10-25T12:03:04.234Z")],
      [59, 29, 47, "cricket", "team", "M", false, new Date("2026-10-25T12:05:06.345Z")],
      [83, 29, 68, "table-tennis", "doubles", "mixed", true, new Date("2026-10-25T12:07:08.456Z")],
      [101, 53, 89, "athletics", "100m", "M", false, new Date("2026-10-25T12:09:10.567Z")],
      [127, 53, 89, "athletics", "relay", "mixed", true, new Date("2026-10-25T12:11:12.678Z")],
    ],
  },
  {
    table: "payment_transactions",
    columns: ["id", "registration_id", "unique_student_count", "amount", "transaction_date", "transaction_id", "bank_name", "payment_mode", "other_payment_mode", "proof_pathname", "proof_file_name", "proof_content_type", "proof_size", "verification_status", "verified_at", "verified_by", "created_at"],
    rows: [
      [13, 11, 2, 5000, new Date("2026-10-25T13:14:15.123Z"), "XFER-UTR-ALPHA-001", "Example Bank", "UPI", null, "fixture-payments/alpha/proof.pdf", "proof-alpha.pdf", "application/pdf", 12345, "verified", new Date("2026-10-25T13:20:21.456Z"), "fixture-admin", new Date("2026-10-25T13:15:16.234Z")],
      [61, 53, 1, 2500, new Date("2026-10-25T14:15:16.789Z"), "XFER-UTR-GAMMA-001", null, "OTHER", "Campus transfer", "fixture-payments/gamma/proof.png", "proof-gamma.png", "image/png", 6789, "pending", null, null, new Date("2026-10-25T14:16:17.890Z")],
    ],
  },
  {
    table: "sessions",
    columns: ["id", "user_id", "created_at", "last_seen_at", "expires_at", "user_agent", "ip"],
    rows: [
      [SESSION_IDS[0], 7, new Date("2026-10-25T15:01:02.123Z"), new Date("2026-10-25T15:02:03.234Z"), new Date("2026-11-01T15:01:02.345Z"), "Fixture Browser/1.0 (🏸)", "192.0.2.17"],
      [SESSION_IDS[1], 19, new Date("2026-10-25T15:03:04.456Z"), new Date("2026-10-25T15:04:05.567Z"), new Date("2026-11-01T15:03:04.678Z"), null, null],
      [SESSION_IDS[2], 71, new Date("2026-10-25T15:05:06.789Z"), new Date("2026-10-25T15:06:07.890Z"), new Date("2026-11-01T15:05:06.901Z"), "Synthetic admin session", "198.51.100.71"],
    ],
  },
  {
    table: "rate_limits",
    columns: ["key", "window_start", "count"],
    rows: [
      [RATE_LIMIT_KEYS[0], new Date("2026-10-25T16:01:02.123Z"), 7],
      [RATE_LIMIT_KEYS[1], new Date("2026-10-25T16:03:04.456Z"), 0],
      [RATE_LIMIT_KEYS[2], new Date("2026-10-25T16:05:06.789Z"), 19],
    ],
  },
  {
    table: "audit_log",
    columns: ["id", "at", "actor", "role", "action", "target", "ip", "details"],
    jsonColumns: ["details"],
    rows: [
      [113, "2026-10-25T17:01:02.123456Z", "fixture-admin@example.test", "admin", "fixture_transfer", "fixture/alpha", "192.0.2.113", { message: "नमस्ते 🏸", context: { campus: "Alpha", approved: true, optional: null }, sequence: [1, "二", false] }],
      [127, new Date("2026-10-25T17:03:04.234Z"), null, null, "fixture_transfer", "fixture/beta", null, "synthetic scalar: λ"],
      [151, new Date("2026-10-25T17:05:06.345Z"), "fixture-alpha", "iiit", "fixture_transfer", "fixture/gamma", "198.51.100.151", 2048],
      [173, new Date("2026-10-25T17:07:08.456Z"), "fixture-beta", "iiit", "fixture_transfer", "fixture/delta", null, false],
      [199, new Date("2026-10-25T17:09:10.567Z"), "fixture-gamma", "iiit", "fixture_transfer", "fixture/json-null", "203.0.113.199", JSON_NULL],
      [223, new Date("2026-10-25T17:11:12.678Z"), "fixture-admin@example.test", "admin", "fixture_transfer", "fixture/sql-null", null, null],
    ],
  },
];

const CLEANUP = [
  { table: "student_event_participations", key: "id", values: PARTICIPATION_IDS, markerColumn: "sport_id", markers: ["badminton", "cricket", "table-tennis", "athletics"] },
  { table: "payment_transactions", key: "id", values: PAYMENT_IDS, markerColumn: "transaction_id", markers: ["XFER-UTR-ALPHA-001", "XFER-UTR-GAMMA-001"] },
  { table: "sessions", key: "id", values: SESSION_IDS },
  { table: "students", key: "id", values: STUDENT_IDS, markerColumn: "roll_number", markers: ["A-001", "A-002", "B-001", "B-002", "G-001"] },
  { table: "registration_drafts", key: "iiit_code", values: DRAFT_CODES },
  { table: "registrations", key: "id", values: REGISTRATION_IDS, markerColumn: "iiit_code", markers: USER_CODES.slice(0, 3) },
  { table: "audit_log", key: "id", values: AUDIT_IDS, markerColumn: "action", markers: ["fixture_transfer"] },
  { table: "rate_limits", key: "key", values: RATE_LIMIT_KEYS },
  { table: "users", key: "id", values: USER_IDS, markerColumn: "username", markers: ["xfer-fixture-alpha", "xfer-fixture-beta", "xfer-fixture-gamma", "xfer-fixture-delta", "xfer-fixture-admin"] },
];

const TABLE_SQL = {
  postgres: (name) => `"${name}"`,
  mysql: (name) => `\`${name}\``,
};

function parseDatabaseUrl(raw, label, expectedProtocol) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid database URL`);
  }
  const protocol = url.protocol.toLowerCase();
  if (!expectedProtocol.includes(protocol)) {
    throw new Error(`${label} must use ${expectedProtocol.join(" or ")} (received ${protocol})`);
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error(`${label} must point to a loopback host; refusing ${hostname || "an empty host"}`);
  }
  if (decodeURIComponent(url.pathname) !== "/transfer_test") {
    throw new Error(`${label} must name the dedicated /transfer_test database`);
  }
  return url;
}

function databaseIdentity(raw) {
  const url = new URL(raw);
  const defaultPort = ["mysql:", "mysql2:"].includes(url.protocol.toLowerCase()) ? "3306" : "5432";
  return `${url.hostname.toLowerCase()}:${url.port || defaultPort}${decodeURIComponent(url.pathname)}`;
}

function ensureSafeTargets() {
  if (process.env.TEST_TRANSFER_DISPOSABLE !== "1") {
    throw new Error("Refusing to run without TEST_TRANSFER_DISPOSABLE=1; both databases will be written");
  }

  const sourceUrl = process.env.TEST_SOURCE_DATABASE_URL;
  const targetUrl = process.env.TEST_TARGET_DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new Error("Set TEST_SOURCE_DATABASE_URL and TEST_TARGET_DATABASE_URL explicitly; this rehearsal never loads .env files");
  }

  parseDatabaseUrl(sourceUrl, "TEST_SOURCE_DATABASE_URL", ["postgres:", "postgresql:"]);
  parseDatabaseUrl(targetUrl, "TEST_TARGET_DATABASE_URL", ["mysql:"]);
  if (databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) {
    throw new Error("Refusing to use the same database as transfer source and target");
  }

  for (const testUrl of [sourceUrl, targetUrl]) {
    for (const envName of ["SOURCE_DATABASE_URL", "TARGET_DATABASE_URL", "DATABASE_URL"]) {
      const liveUrl = process.env[envName];
      if (liveUrl && databaseIdentity(testUrl) === databaseIdentity(liveUrl)) {
        throw new Error(`Refusing to use ${envName} as a test database target`);
      }
    }
  }

  return { sourceUrl, targetUrl };
}

function mysqlConfig(raw) {
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    timezone: "Z",
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  };
}

function encodeValue(table, column, value) {
  const fixture = FIXTURES.find(({ table: name }) => name === table);
  if (!fixture?.jsonColumns?.includes(column)) return value;
  if (value === null) return null; // SQL NULL, not JSON null.
  return JSON.stringify(value === JSON_NULL ? null : value);
}

async function insertFixtures(database, dialect, fixtures = FIXTURES) {
  const quote = TABLE_SQL[dialect];
  for (const fixture of fixtures) {
    const columns = fixture.columns.map(quote).join(", ");
    const placeholders = fixture.columns.map((_, index) => dialect === "postgres" ? `$${index + 1}` : "?").join(", ");
    const query = `INSERT INTO ${quote(fixture.table)} (${columns}) VALUES (${placeholders})`;
    for (const row of fixture.rows) {
      const values = row.map((value, index) => encodeValue(fixture.table, fixture.columns[index], value));
      if (dialect === "postgres") {
        await database.query(query, values);
      } else {
        await database.execute(query, values);
      }
    }
  }
}

async function withTransaction(database, dialect, callback) {
  if (dialect === "postgres") {
    const connection = await database.connect();
    try {
      await connection.query("BEGIN");
      await callback(connection);
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
    return;
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await callback(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function cleanupFixtures(database, dialect) {
  await withTransaction(database, dialect, async (connection) => {
    for (const item of CLEANUP) {
      const quote = TABLE_SQL[dialect];
      const valuePlaceholders = item.values.map((_, index) => dialect === "postgres" ? `$${index + 1}` : "?");
      const values = [...item.values];
      let predicate = `${quote(item.key)} IN (${valuePlaceholders.join(", ")})`;

      if (item.markerColumn) {
        const markerPlaceholders = item.markers.map((_, index) => dialect === "postgres" ? `$${values.length + index + 1}` : "?");
        values.push(...item.markers);
        predicate += ` AND ${quote(item.markerColumn)} IN (${markerPlaceholders.join(", ")})`;
      }

      const query = `DELETE FROM ${quote(item.table)} WHERE ${predicate}`;
      if (dialect === "postgres") {
        await connection.query(query, values);
      } else {
        await connection.execute(query, values);
      }
    }
  });
}

async function tableCounts(database, dialect) {
  const counts = {};
  for (const table of TABLES) {
    const quote = TABLE_SQL[dialect];
    let result;
    if (dialect === "postgres") {
      [result] = (await database.query(`SELECT count(*)::int AS count FROM ${quote(table)}`)).rows;
    } else {
      [[result]] = await database.query(`SELECT COUNT(*) AS count FROM ${quote(table)}`);
    }
    counts[table] = Number(result.count);
  }
  return counts;
}

function assertCounts(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}

function emptyCounts() {
  return Object.fromEntries(TABLES.map((table) => [table, 0]));
}

function runTransfer(args, sourceUrl, targetUrl) {
  const result = spawnSync(process.execPath, ["src/db/transfer-to-mysql.js", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      SOURCE_DATABASE_URL: sourceUrl,
      TARGET_DATABASE_URL: targetUrl,
    },
  });

  if (result.error) throw result.error;
  return {
    status: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

function assertSuccessfulRun(result, description) {
  assert.equal(result.status, 0, `${description} failed (exit ${result.status}):\n${result.output}`);
}

function assertRefusedRun(result, description) {
  assert.notEqual(result.status, 0, `${description} unexpectedly succeeded:\n${result.output}`);
}

let testTargets;
try {
  testTargets = ensureSafeTargets();
} catch (error) {
  console.error(`Refusing transfer integration rehearsal: ${error.message}`);
  process.exit(1);
}

const source = new Pool({ connectionString: testTargets.sourceUrl, max: 2, ssl: false });
const target = mysql.createPool(mysqlConfig(testTargets.targetUrl));
let failure;
let completed = false;

try {
  // Remove only a prior rehearsal's known rows; then refuse any non-fixture data.
  await cleanupFixtures(source, "postgres");
  await cleanupFixtures(target, "mysql");
  assertCounts(await tableCounts(source, "postgres"), emptyCounts(), "source must contain only this rehearsal's fixture rows");
  assertCounts(await tableCounts(target, "mysql"), emptyCounts(), "target must be empty before rehearsal");

  await withTransaction(source, "postgres", (connection) => insertFixtures(connection, "postgres"));
  assertCounts(await tableCounts(source, "postgres"), EXPECTED_COUNTS, "source fixture counts");
  const microsecondCheck = await source.query(`
    SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
    FROM users WHERE id = $1
  `, [USER_IDS[0]]);
  assert.equal(microsecondCheck.rows[0]?.created_at, "2026-10-25T08:15:16.123456Z", "source fixture must retain nonzero microseconds");

  const dryRun = runTransfer([], testTargets.sourceUrl, testTargets.targetUrl);
  assertSuccessfulRun(dryRun, "default read-only dry run");
  for (const table of TABLES) assert.ok(dryRun.output.includes(table), `dry-run report omitted ${table}:\n${dryRun.output}`);
  assertCounts(await tableCounts(target, "mysql"), emptyCounts(), "default dry run must not write target rows");

  const unacknowledgedApply = runTransfer(["--apply"], testTargets.sourceUrl, testTargets.targetUrl);
  assertRefusedRun(unacknowledgedApply, "apply without --writes-frozen");
  assert.match(unacknowledgedApply.output, /writes-frozen/i, `missing explicit write-freeze refusal:\n${unacknowledgedApply.output}`);
  assertCounts(await tableCounts(target, "mysql"), emptyCounts(), "unacknowledged apply must not write target rows");

  // PostgreSQL TEXT can contain more bytes than MySQL TEXT. This makes the
  // import fail while copying registrations, after the users table was
  // inserted, so an empty destination proves the multi-table target
  // transaction rolled those earlier inserts back.
  await source.query("UPDATE registrations SET notes = $1 WHERE id = $2", ["x".repeat(70_000), REGISTRATION_IDS[0]]);
  const invalidApply = runTransfer(["--apply", "--writes-frozen"], testTargets.sourceUrl, testTargets.targetUrl);
  assertRefusedRun(invalidApply, "oversized TEXT import probe");
  assert.match(invalidApply.output, /ER_DATA_TOO_LONG|canonical row checksum verification failed for registrations/i, `failure did not reach the intended TEXT copy/checksum failure:\n${invalidApply.output}`);
  assertCounts(await tableCounts(target, "mysql"), emptyCounts(), "failed import must roll back all previously copied tables");

  await source.query("UPDATE registrations SET notes = $1 WHERE id = $2", ["Synthetic roster; मौसम अच्छा है.", REGISTRATION_IDS[0]]);
  assertCounts(await tableCounts(source, "postgres"), EXPECTED_COUNTS, "source counts after restoring valid fixture data");

  const applied = runTransfer(["--apply", "--writes-frozen"], testTargets.sourceUrl, testTargets.targetUrl);
  assertSuccessfulRun(applied, "acknowledged import");
  assertCounts(await tableCounts(target, "mysql"), EXPECTED_COUNTS, "all nine target table counts after import");
  for (const table of TABLES) assert.ok(applied.output.includes(`Verified ${table}: row count and canonical checksum match.`), `apply did not verify ${table}:\n${applied.output}`);

  const targetBeforeRepeat = await tableCounts(target, "mysql");
  const repeatedApply = runTransfer(["--apply", "--writes-frozen"], testTargets.sourceUrl, testTargets.targetUrl);
  assertRefusedRun(repeatedApply, "import into non-empty target");
  assert.match(repeatedApply.output, /not empty|non-empty/i, `repeat import was refused for an unexpected reason:\n${repeatedApply.output}`);
  assertCounts(await tableCounts(target, "mysql"), targetBeforeRepeat, "refused repeat import must not alter target rows");

  // A fresh read-only run re-reads both databases and exercises the transfer
  // tool's canonical content/checksum verification for every table.
  const verification = runTransfer([], testTargets.sourceUrl, testTargets.targetUrl);
  assertSuccessfulRun(verification, "post-import content verification");
  for (const table of TABLES) {
    assert.ok(verification.output.includes(`Checksum ${table}: PASS (${EXPECTED_COUNTS[table]} row(s)).`), `checksum verification omitted ${table}:\n${verification.output}`);
  }
  completed = true;
} catch (error) {
  failure = error;
} finally {
  const cleanupErrors = [];
  for (const [database, dialect] of [[target, "mysql"], [source, "postgres"]]) {
    try {
      await cleanupFixtures(database, dialect);
      assertCounts(await tableCounts(database, dialect), emptyCounts(), `${dialect} fixture cleanup must leave application tables empty`);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  await Promise.all([
    source.end().catch((error) => cleanupErrors.push(error)),
    target.end().catch((error) => cleanupErrors.push(error)),
  ]);

  if (cleanupErrors.length) {
    const cleanupFailure = new AggregateError(cleanupErrors, "Fixture cleanup failed");
    if (failure) console.error(cleanupFailure);
    else failure = cleanupFailure;
  }
}

if (failure) {
  console.error("FAIL transfer integration rehearsal");
  console.error(failure);
  process.exitCode = 1;
} else if (completed) {
  console.log("PASS transfer integration rehearsal: dry-run safety, write-freeze guard, failed-import rollback, all-table copy/counts/checksums, and non-empty-target refusal.");
}
