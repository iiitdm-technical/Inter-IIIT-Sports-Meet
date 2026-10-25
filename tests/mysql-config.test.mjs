import { test } from "node:test";
import assert from "node:assert/strict";
import { createDatabasePool, getDatabasePoolOptions } from "../src/db/index.js";

function withDefaultTlsMode(callback) {
  const previous = process.env.MYSQL_TLS_MODE;
  delete process.env.MYSQL_TLS_MODE;
  try {
    callback();
  } finally {
    if (previous === undefined) delete process.env.MYSQL_TLS_MODE;
    else process.env.MYSQL_TLS_MODE = previous;
  }
}

test("MySQL pool options decode URL credentials and require verified remote TLS", () => {
  withDefaultTlsMode(() => {
    const options = getDatabasePoolOptions("mysql://user%40example:pa%3Ass@db.example.com:3307/sports%20meet?ssl=disabled");

    assert.equal(options.host, "db.example.com");
    assert.equal(options.port, 3307);
    assert.equal(options.user, "user@example");
    assert.equal(options.password, "pa:ss");
    assert.equal(options.database, "sports meet");
    assert.equal(options.charset, "utf8mb4");
    assert.equal(options.timezone, "Z");
    assert.deepEqual(options.ssl, { rejectUnauthorized: true, verifyIdentity: true });
  });
});

test("MySQL pool disables TLS only for explicit loopback hosts", () => {
  withDefaultTlsMode(() => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const options = getDatabasePoolOptions(`mysql://user:password@${host}/sports`);
      assert.equal(options.ssl, false, `${host} should default to no TLS`);
      assert.equal(options.timezone, "Z");
      assert.equal(options.connectionLimit, 2);
      assert.equal(options.waitForConnections, true);
      assert.equal(options.port, 3306);
      assert.equal(options.charset, "utf8mb4");
    }
  });
});

test("require mode encrypts but skips certificate verification, including loopback", () => {
  for (const url of [
    "mysql://user:password@db.example.com/sports",
    "mysql://user:password@localhost/sports",
  ]) {
    assert.deepEqual(getDatabasePoolOptions(url, { tlsMode: "require" }).ssl, {
      rejectUnauthorized: false,
      verifyIdentity: false,
    });
  }
});

test("MYSQL_TLS_MODE environment setting overrides the host default", () => {
  const previous = process.env.MYSQL_TLS_MODE;
  process.env.MYSQL_TLS_MODE = "require";
  try {
    assert.deepEqual(
      getDatabasePoolOptions("mysql://user:password@db.example.com/sports").ssl,
      { rejectUnauthorized: false, verifyIdentity: false },
    );
  } finally {
    if (previous === undefined) delete process.env.MYSQL_TLS_MODE;
    else process.env.MYSQL_TLS_MODE = previous;
  }
});

test("disabled TLS is loopback-only and invalid modes are rejected", () => {
  assert.equal(getDatabasePoolOptions("mysql://user:password@localhost/sports", { tlsMode: "disabled" }).ssl, false);
  assert.throws(
    () => getDatabasePoolOptions("mysql://user:password@db.example.com/sports", { tlsMode: "disabled" }),
    /only permitted for loopback/,
  );
  assert.throws(
    () => getDatabasePoolOptions("mysql://user:password@db.example.com/sports", { tlsMode: "verify-ca" }),
    /MYSQL_TLS_MODE must be/,
  );
});

test("require mode warns once per pool without exposing credentials", async () => {
  const originalWarn = console.warn;
  const warnings = [];
  let pool;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    pool = createDatabasePool("mysql://user:very-secret-password@db.example.com/sports", { tlsMode: "require" });
  } finally {
    console.warn = originalWarn;
    if (pool) await pool.end();
  }

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /man-in-the-middle/);
  assert.doesNotMatch(warnings[0], /very-secret-password/);
});

test("database pool config rejects malformed URLs and non-MySQL protocols", () => {
  assert.throws(() => getDatabasePoolOptions("not a URL"), /valid mysql:\/\//);
  assert.throws(() => getDatabasePoolOptions("postgres://user:password@db.example.com/sports"), /mysql: protocol/);
  assert.throws(() => getDatabasePoolOptions("mysql:///sports"), /hostname/);
  assert.throws(() => getDatabasePoolOptions("mysql://db.example.com/"), /database name/);
});
