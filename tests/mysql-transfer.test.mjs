import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getTransferTargetConnectionOptions } from "../src/db/transfer-to-mysql.js";
import {
  TRANSFER_TABLES,
  canonicalRow,
  canonicalizeJson,
  createRowsChecksum,
  normalizeColumnValue,
  normalizeTimestamp,
  parseTransferArguments,
} from "../src/db/transfer-utils.js";

describe("PostgreSQL to MySQL transfer guards", () => {
  test("defaults to a read-only dry run with a bounded batch size", () => {
    assert.deepEqual(parseTransferArguments([]), {
      apply: false,
      writesFrozen: false,
      help: false,
      batchSize: 100,
    });
    assert.equal(parseTransferArguments(["--batch-size", "250"]).batchSize, 250);
    assert.equal(parseTransferArguments(["--batch-size=500"]).batchSize, 500);
  });

  test("requires explicit apply and write-freeze acknowledgment together", () => {
    assert.throws(() => parseTransferArguments(["--apply"]), /requires --writes-frozen/);
    assert.throws(() => parseTransferArguments(["--writes-frozen"]), /only valid together with --apply/);
    assert.deepEqual(parseTransferArguments(["--apply", "--writes-frozen"]), {
      apply: true,
      writesFrozen: true,
      help: false,
      batchSize: 100,
    });
  });

  test("rejects unknown, duplicate, missing, and unsafe batch-size options", () => {
    for (const args of [
      ["--apply", "--writes-frozen", "--unknown"],
      ["--batch-size"],
      ["--batch-size", "--apply"],
      ["--batch-size", "0"],
      ["--batch-size", "501"],
      ["--batch-size", "1.5"],
      ["--batch-size", "10", "--batch-size", "20"],
    ]) {
      assert.throws(() => parseTransferArguments(args));
    }
  });
});

describe("transfer MySQL TLS configuration", () => {
  test("reuses the application's verified-by-default TLS policy", () => {
    const options = getTransferTargetConnectionOptions("mysql://user:password@mysql.example.com/sports", { tlsMode: "verify" });
    assert.deepEqual(options.ssl, { rejectUnauthorized: true, verifyIdentity: true });
  });

  test("honors explicit MYSQL_TLS_MODE=require as encryption without identity verification", () => {
    const options = getTransferTargetConnectionOptions("mysql://user:password@mysql.example.com/sports", { tlsMode: "require" });
    assert.deepEqual(options.ssl, { rejectUnauthorized: false, verifyIdentity: false });
  });

  test("does not allow disabling TLS for a remote target", () => {
    assert.throws(
      () => getTransferTargetConnectionOptions("mysql://user:password@mysql.example.com/sports", { tlsMode: "disabled" }),
      /MYSQL_TLS_MODE=disabled is only permitted for loopback/,
    );
  });
});

describe("transfer allowlist", () => {
  test("covers all nine application tables in foreign-key-safe copy order", () => {
    assert.deepEqual(TRANSFER_TABLES.map(({ name }) => name), [
      "users",
      "registrations",
      "registration_drafts",
      "students",
      "student_event_participations",
      "payment_transactions",
      "sessions",
      "rate_limits",
      "audit_log",
    ]);
    assert.equal(TRANSFER_TABLES.some(({ name }) => name === "__drizzle_migrations"), false);
    for (const table of TRANSFER_TABLES) {
      assert.ok(table.columns.some(({ name }) => name === table.primaryKey), `${table.name} has an explicit primary key mapping`);
    }
  });
});

describe("canonical transfer values", () => {
  test("canonicalizes JSON object key order, nested keys, and equivalent decimal forms", () => {
    assert.equal(
      canonicalizeJson('{"z":1.00,"nested":{"b":2.0,"a":1e0},"a":1e+3}'),
      '{"a":1e3,"nested":{"a":1,"b":2},"z":1}',
    );
  });

  test("preserves exact large JSON number values instead of rounding through JavaScript Number", () => {
    const precise = "1234567890123456789012345678901234567890.00";
    assert.equal(canonicalizeJson(`{"n":${precise}}`), '{"n":123456789012345678901234567890123456789e1}');
    assert.notEqual(
      canonicalizeJson(`{"n":${precise}}`),
      canonicalizeJson('{"n":1234567890123456789012345678901234567891}'),
    );
  });

  test("preserves PostgreSQL microsecond instants in UTC DATETIME(6) values", () => {
    assert.equal(normalizeTimestamp("2025-02-03 04:05:06.007"), "2025-02-03T04:05:06.007000Z");
    assert.equal(normalizeTimestamp("2025-02-03 04:05:06.007000"), "2025-02-03T04:05:06.007000Z");
    assert.equal(normalizeTimestamp("2025-02-03 04:05:06.007001"), "2025-02-03T04:05:06.007001Z");
    assert.throws(() => normalizeTimestamp("0999-12-31 23:59:59.999"), /DATETIME range/);
  });

  test("canonical row checksums ignore JSON object ordering and preserve DATETIME(6) precision", () => {
    const auditTable = TRANSFER_TABLES.find(({ name }) => name === "audit_log");
    const left = {
      id: 7,
      at: "2025-02-03 04:05:06.007001",
      actor: null,
      role: "admin",
      action: "login",
      target: null,
      ip: "127.0.0.1",
      details: '{"z":1.0,"nested":{"y":2,"x":1}}',
    };
    const right = {
      ...left,
      at: "2025-02-03T04:05:06.007001Z",
      details: '{"nested":{"x":1.00,"y":2.0},"z":1}',
    };
    assert.equal(canonicalRow(auditTable, left), canonicalRow(auditTable, right));

    const checksumA = createRowsChecksum(auditTable);
    const checksumB = createRowsChecksum(auditTable);
    checksumA.update(left);
    checksumB.update(right);
    assert.equal(checksumA.rowCount, 1n);
    assert.equal(checksumA.finish(), checksumB.finish());

    assert.notEqual(
      canonicalRow(auditTable, left),
      canonicalRow(auditTable, { ...right, at: "2025-02-03 04:05:06.007000" }),
    );
    assert.notEqual(
      canonicalRow(auditTable, left),
      canonicalRow(auditTable, { ...left, details: null }),
    );
  });

  test("normalizes PostgreSQL booleans and MySQL tinyint booleans equivalently", () => {
    const reserveColumn = TRANSFER_TABLES
      .find(({ name }) => name === "student_event_participations")
      .columns.find(({ name }) => name === "is_reserve");
    assert.equal(normalizeColumnValue(reserveColumn, true), true);
    assert.equal(normalizeColumnValue(reserveColumn, 1), true);
    assert.equal(normalizeColumnValue(reserveColumn, 0), false);
    assert.throws(() => normalizeColumnValue(reserveColumn, 2), /Boolean value/);
  });
});
