import { test } from "node:test";
import assert from "node:assert/strict";
import { sameDatabase } from "./database-target.mjs";

test("DB test safety compares database identity regardless of credentials", () => {
  assert.equal(sameDatabase("mysql://a:pw@localhost/live", "mysql://b:other@localhost:3306/live"), true);
  assert.equal(sameDatabase("mysql://a@localhost/test", "mysql://a@localhost/live"), false);
  assert.equal(sameDatabase("mysql://a@localhost:33316/test", "mysql://a@localhost/test"), false);
  assert.equal(sameDatabase("mysql://a@localhost/%6cive", "mysql://a@localhost/live"), true);
  assert.equal(sameDatabase("mysql://a@localhost/test", undefined), false);
});
