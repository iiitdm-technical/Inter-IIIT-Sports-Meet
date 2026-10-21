/**
 * Database integration test for roster submission.
 *
 * Writes to a real PostgreSQL database, so it only runs against
 * TEST_DATABASE_URL, and refuses when that matches DATABASE_URL (the live
 * database configured in .env.local). Use a throwaway Neon branch or a local
 * database with migrations applied:
 *
 *   TEST_DATABASE_URL=postgres://… node tests/db-integration.mjs
 */
import dotenv from "dotenv";
import assert from "node:assert/strict";

dotenv.config({ path: ".env.local", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
const liveUrl = process.env.DATABASE_URL;

function sameDatabase(a, b) {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.hostname === right.hostname && left.pathname === right.pathname;
  } catch {
    return a === b;
  }
}

if (!testUrl) {
  console.log("Skipped: set TEST_DATABASE_URL to a disposable database to run the DB integration test.");
  process.exit(0);
}
if (liveUrl && sameDatabase(testUrl, liveUrl)) {
  console.error("Refusing to run: TEST_DATABASE_URL points at the same database as DATABASE_URL.");
  process.exit(1);
}

// Every module below reads DATABASE_URL, so point it at the test database
// before they load.
process.env.DATABASE_URL = testUrl;

const { submitRegistration, submitPayment } = await import("../src/lib/registration/service.js");
const { getDb, getPool } = await import("../src/db/index.js");
const { registrations, users } = await import("../src/db/schema.js");
const { eq } = await import("drizzle-orm");

const IIIT = "test-integration-iiit";
const db = getDb();
let failed = 0;

async function step(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

const registration = {
  contactDetails: { contactName: "A", contactEmail: "a@example.org", contactPhone: "123456" },
  students: [
    { rollNumber: "R1", name: "STUDENT 1", gender: "M" },
    { rollNumber: "R2", name: "STUDENT 2", gender: "M" },
  ],
  entries: [
    { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1", isReserve: false },
    { sportId: "volleyball", eventId: "team", gender: "M", rollNumber: "R1", isReserve: false },
    { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R2", isReserve: false },
  ],
};

try {
  await db.insert(users).values({
    username: IIIT, iiitCode: IIIT, iiitName: "Test Integration IIIT", passwordHash: "not-a-login", role: "iiit",
  }).onConflictDoNothing();
  await db.delete(registrations).where(eq(registrations.iiitCode, IIIT));

  await step("locks a valid roster in payment_pending", async () => {
    const result = await submitRegistration(IIIT, registration, IIIT);
    assert.equal(result.status, "payment_pending");
    assert.equal(result.totalStudentsCount, 2);
    assert.equal(result.totalEntriesCount, 3);
  });

  await step("rejects a second roster for the same IIIT", async () => {
    await assert.rejects(submitRegistration(IIIT, registration, IIIT), (error) => error.statusCode >= 400 && error.statusCode < 500);
  });

  await step("rejects a roster that breaks the rules", async () => {
    const other = `${IIIT}-rules`;
    await db.insert(users).values({ username: other, iiitCode: other, iiitName: "Rules IIIT", passwordHash: "x", role: "iiit" }).onConflictDoNothing();
    const bad = { ...registration, students: [{ rollNumber: "R1", name: "S", gender: "F" }], entries: [registration.entries[0]] };
    await assert.rejects(submitRegistration(other, bad, other), (error) => error.statusCode === 422);
    await db.delete(users).where(eq(users.username, other));
  });

  await step("rejects payment with a proof that is not in storage", async () => {
    await assert.rejects(submitPayment(IIIT, {
      paymentDetails: {
        transactionDate: new Date().toISOString().slice(0, 10),
        transactionId: "TX12345",
        paymentMode: "UPI",
        proofPathname: `payment-proofs/${IIIT}/missing.pdf`,
      },
    }, IIIT), (error) => error.statusCode >= 400 && error.statusCode < 500);
  });
} finally {
  await db.delete(registrations).where(eq(registrations.iiitCode, IIIT));
  await db.delete(users).where(eq(users.username, IIIT));
  await getPool().end();
}

if (failed > 0) process.exit(1);
