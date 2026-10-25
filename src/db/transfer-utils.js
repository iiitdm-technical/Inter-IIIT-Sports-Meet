import { createHash } from "node:crypto";

const column = (name, type, { nullable = false, length } = {}) => Object.freeze({
  name,
  type,
  nullable,
  ...(length === undefined ? {} : { length }),
});

const int = (name, options) => column(name, "integer", options);
const varchar = (name, length, options) => column(name, "varchar", { ...options, length });
const text = (name, options) => column(name, "text", options);
const datetime = (name, options) => column(name, "timestamp", options);
const json = (name, options) => column(name, "json", options);

const table = (name, primaryKey, columns, { autoIncrement = false, uniqueKeys = [], foreignKeys = [] } = {}) => Object.freeze({
  name,
  primaryKey,
  autoIncrement,
  columns: Object.freeze(columns),
  uniqueKeys: Object.freeze(uniqueKeys.map((key) => Object.freeze(key))),
  foreignKeys: Object.freeze(foreignKeys.map((key) => Object.freeze({ ...key }))),
});

/**
 * The transfer allowlist is deliberately independent of the runtime Drizzle
 * schema. It is a reviewed mapping between the current PostgreSQL schema and
 * the expected MySQL schema; any added, missing, or changed column blocks a
 * transfer until this mapping is explicitly updated.
 */
export const TRANSFER_TABLES = Object.freeze([
  table("users", "id", [
    int("id"), varchar("username", 64), varchar("email", 254, { nullable: true }),
    varchar("display_name", 128, { nullable: true }), text("password_hash"),
    varchar("role", 20), varchar("iiit_name", 128, { nullable: true }),
    varchar("iiit_code", 64, { nullable: true }), datetime("created_at"), datetime("updated_at"),
  ], { autoIncrement: true, uniqueKeys: [["username"], ["email"], ["iiit_code"]] }),
  table("registrations", "id", [
    int("id"), varchar("iiit_code", 64), varchar("iiit_name", 128), varchar("status", 20),
    datetime("submitted_at"), varchar("submitted_by", 64), varchar("contact_name", 128),
    varchar("contact_email", 128), varchar("contact_phone", 32), int("total_students_count"),
    text("notes", { nullable: true }), datetime("created_at"), datetime("updated_at"),
  ], {
    autoIncrement: true,
    uniqueKeys: [["iiit_code"]],
    foreignKeys: [{ column: "iiit_code", referencedTable: "users", referencedColumn: "iiit_code" }],
  }),
  table("registration_drafts", "iiit_code", [
    varchar("iiit_code", 64), json("contact_details"), json("slots_map"), int("revision"), datetime("updated_at"),
  ], {
    foreignKeys: [{ column: "iiit_code", referencedTable: "users", referencedColumn: "iiit_code" }],
  }),
  table("students", "id", [
    int("id"), int("registration_id"), varchar("iiit_code", 64), varchar("roll_number", 64),
    varchar("name", 128), varchar("gender", 1), datetime("created_at"), datetime("updated_at"),
  ], {
    autoIncrement: true,
    uniqueKeys: [["iiit_code", "roll_number"]],
    foreignKeys: [{ column: "registration_id", referencedTable: "registrations", referencedColumn: "id" }],
  }),
  table("student_event_participations", "id", [
    int("id"), int("registration_id"), int("student_id"), varchar("sport_id", 64), varchar("event_id", 64),
    varchar("gender", 10), column("is_reserve", "boolean"), datetime("created_at"),
  ], {
    autoIncrement: true,
    uniqueKeys: [["student_id", "sport_id", "event_id"]],
    foreignKeys: [
      { column: "registration_id", referencedTable: "registrations", referencedColumn: "id" },
      { column: "student_id", referencedTable: "students", referencedColumn: "id" },
    ],
  }),
  table("payment_transactions", "id", [
    int("id"), int("registration_id"), int("unique_student_count"), int("amount"), datetime("transaction_date"),
    varchar("transaction_id", 128), varchar("bank_name", 128, { nullable: true }),
    varchar("payment_mode", 20, { nullable: true }), varchar("other_payment_mode", 128, { nullable: true }),
    varchar("proof_pathname", 255), varchar("proof_file_name", 255), varchar("proof_content_type", 64),
    int("proof_size"), varchar("verification_status", 20), datetime("verified_at", { nullable: true }),
    varchar("verified_by", 64, { nullable: true }), datetime("created_at"),
  ], {
    autoIncrement: true,
    uniqueKeys: [["registration_id"]],
    foreignKeys: [{ column: "registration_id", referencedTable: "registrations", referencedColumn: "id" }],
  }),
  table("sessions", "id", [
    varchar("id", 64), int("user_id"), datetime("created_at"), datetime("last_seen_at"), datetime("expires_at"),
    varchar("user_agent", 256, { nullable: true }), varchar("ip", 64, { nullable: true }),
  ], {
    foreignKeys: [{ column: "user_id", referencedTable: "users", referencedColumn: "id" }],
  }),
  table("rate_limits", "key", [
    varchar("key", 200), datetime("window_start"), int("count"),
  ]),
  table("audit_log", "id", [
    int("id"), datetime("at"), varchar("actor", 254, { nullable: true }),
    varchar("role", 20, { nullable: true }), varchar("action", 64), varchar("target", 128, { nullable: true }),
    varchar("ip", 64, { nullable: true }), json("details", { nullable: true }),
  ], { autoIncrement: true }),
]);

export function parseTransferArguments(args) {
  let apply = false;
  let writesFrozen = false;
  let help = false;
  let batchSize = 100;
  let sawBatchSize = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--apply") {
      if (apply) throw new Error("--apply was provided more than once.");
      apply = true;
    } else if (argument === "--writes-frozen") {
      if (writesFrozen) throw new Error("--writes-frozen was provided more than once.");
      writesFrozen = true;
    } else if (argument === "--batch-size" || argument.startsWith("--batch-size=")) {
      if (sawBatchSize) throw new Error("--batch-size was provided more than once.");
      sawBatchSize = true;
      const rawValue = argument === "--batch-size" ? args[++index] : argument.slice("--batch-size=".length);
      if (rawValue === undefined || rawValue.startsWith("--") || !/^\d+$/.test(rawValue)) {
        throw new Error("--batch-size must be an integer from 1 to 500.");
      }
      batchSize = Number(rawValue);
      if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
        throw new Error("--batch-size must be an integer from 1 to 500.");
      }
    } else {
      throw new Error("Unknown command-line option.");
    }
  }

  if (writesFrozen && !apply) throw new Error("--writes-frozen is only valid together with --apply.");
  if (apply && !writesFrozen) {
    throw new Error("--apply requires --writes-frozen. Freeze source writes first; the transfer snapshot is not a write freeze.");
  }

  return Object.freeze({ apply, writesFrozen, help, batchSize });
}

class JsonNumber {
  constructor(source) {
    this.source = source;
  }
}

function canonicalNumber(raw) {
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) throw new Error("Invalid JSON number in database value.");

  const sign = match[1];
  let digits = `${match[2]}${match[3] ?? ""}`.replace(/^0+/, "");
  if (!digits) return "0";

  let exponent = BigInt(match[4] ?? "0") - BigInt((match[3] ?? "").length);
  const trailingZeros = /0+$/.exec(digits)?.[0].length ?? 0;
  if (trailingZeros) {
    digits = digits.slice(0, -trailingZeros);
    exponent += BigInt(trailingZeros);
  }
  return `${sign}${digits}${exponent === 0n ? "" : `e${exponent}`}`;
}

function stringifyCanonicalJson(value) {
  if (value === null) return "null";
  if (value instanceof JsonNumber) return canonicalNumber(value.source);
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stringifyCanonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stringifyCanonicalJson(value[key])}`).join(",")}}`;
  }
  throw new Error("Unsupported value while canonicalizing JSON.");
}

export function canonicalizeJson(jsonText) {
  if (typeof jsonText !== "string") throw new Error("Database JSON value was not returned as text.");
  const parsed = JSON.parse(jsonText, (key, value, context) => {
    if (typeof value === "number") {
      if (typeof context?.source !== "string") {
        throw new Error("This Node.js runtime cannot preserve exact JSON number values.");
      }
      return new JsonNumber(context.source);
    }
    return value;
  });
  return stringifyCanonicalJson(parsed);
}

export function normalizeTimestamp(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Invalid timestamp value in database row.");
    value = value.toISOString();
  }
  if (typeof value !== "string") throw new Error("Timestamp value was not returned as text.");

  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\.(\d{3})(\d{3})?(?:Z)?$/.exec(value);
  if (!match) throw new Error("Timestamp value has unsupported format.");
  const year = Number(match[1].slice(0, 4));
  if (year < 1000 || year > 9999) throw new Error("Timestamp is outside MySQL DATETIME range.");
  return `${match[1]}T${match[2]}.${match[3]}${match[4] ?? "000"}Z`;
}

export function normalizeColumnValue(columnDefinition, value) {
  if (value === null) return null;
  switch (columnDefinition.type) {
    case "timestamp":
      return normalizeTimestamp(value);
    case "json":
      return canonicalizeJson(value);
    case "boolean":
      if (value === true || value === 1 || value === "1") return true;
      if (value === false || value === 0 || value === "0") return false;
      throw new Error("Boolean value is outside the supported representation.");
    case "integer": {
      const numericValue = typeof value === "number" ? value : Number(value);
      if (!Number.isSafeInteger(numericValue)) throw new Error("Integer value is outside the supported range.");
      return numericValue;
    }
    case "varchar":
    case "text":
      if (typeof value !== "string") throw new Error("Text value was not returned as text.");
      return value;
    default:
      throw new Error("Unknown transfer column type.");
  }
}

export function canonicalRow(tableDefinition, row) {
  return JSON.stringify(tableDefinition.columns.map((columnDefinition) => {
    if (!Object.hasOwn(row, columnDefinition.name)) throw new Error("Mapped column is missing from database row.");
    return normalizeColumnValue(columnDefinition, row[columnDefinition.name]);
  }));
}

export function createRowsChecksum(tableDefinition) {
  const digest = createHash("sha256");
  let rowCount = 0n;
  return Object.freeze({
    update(row) {
      const rowDigest = createHash("sha256").update(canonicalRow(tableDefinition, row)).digest();
      digest.update(rowDigest);
      rowCount += 1n;
    },
    get rowCount() {
      return rowCount;
    },
    finish() {
      return digest.digest("hex");
    },
  });
}
