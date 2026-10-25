import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isUniqueViolation } from "../src/lib/registration/deadline.js";

describe("MySQL query error compatibility", () => {
  test("recognizes mysql2 duplicate-key errors wrapped by Drizzle", () => {
    const driverError = Object.assign(new Error("Duplicate entry"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    });
    const drizzleError = new Error("Failed query", { cause: driverError });

    assert.equal(isUniqueViolation(drizzleError), true);
    assert.equal(isUniqueViolation({ cause: { errno: "1062" } }), true);
  });

  test("preserves PostgreSQL duplicate handling and rejects unrelated errors", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation({ cause: { code: "23505" } }), true);
    assert.equal(isUniqueViolation({ code: "ER_BAD_FIELD_ERROR", errno: 1054 }), false);
    assert.equal(isUniqueViolation(new Error("connection lost")), false);
  });
});
