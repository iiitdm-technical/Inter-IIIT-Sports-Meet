/**
 * Database integration test for roster submission.
 *
 * Writes to a real MySQL database, so it only runs against
 * TEST_DATABASE_URL, and refuses when that matches DATABASE_URL (the live
 * database configured in .env.local). Use a throwaway local MySQL
 * database with migrations applied:
 *
 *   TEST_DATABASE_URL=mysql://… node tests/db-integration.mjs
 */
import dotenv from "dotenv";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sameDatabase } from "./database-target.mjs";

dotenv.config({ path: ".env.local", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
const liveUrl = process.env.DATABASE_URL;

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
const { registrations, users, students, studentEventParticipations, registrationDrafts, paymentTransactions, auditLog, sessions } = await import("../src/db/schema.js");
const { eq, sql } = await import("drizzle-orm");
const { hit, peek, reset } = await import("../src/lib/security/rate-limit.js");
const { verifyPayment, getAdminFilteredEntries } = await import("../src/lib/admin/service.js");

const IIIT = `test-${randomUUID().slice(0, 8)}`;
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
  contactDetails: { contactName: "A", contactEmail: "a@example.org", contactPhone: "123456", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", staffCount: 2 },
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
  });
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
    await db.insert(users).values({ username: other, iiitCode: other, iiitName: "Rules IIIT", passwordHash: "x", role: "iiit" });
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

  await step("maps generated student IDs and booleans correctly", async () => {
    const rows = await db.select().from(students).where(eq(students.iiitCode, IIIT));
    const [reg] = await db.select().from(registrations).where(eq(registrations.iiitCode, IIIT));
    const entries = await db.select().from(studentEventParticipations).where(eq(studentEventParticipations.registrationId, reg.id));
    assert.equal(rows.length, 2);
    assert.equal(entries.length, 3);
    assert(entries.every((entry) => rows.some((student) => student.id === entry.studentId)));
    assert(entries.every((entry) => entry.isReserve === false));
  });

  await step("retains case-insensitive admin search", async () => {
    const result = await getAdminFilteredEntries({ iiit: IIIT, name: "student", rollNumber: "r1" });
    assert.equal(result.total, 2);
  });

  await step("round trips JSON, UTC millisecond dates and sessions", async () => {
    const instant = new Date("2026-10-25T12:34:56.789Z");
    const details = { nested: { a: true, unicode: "தமிழ்", empty: null }, list: [1, "2"] };
    await db.insert(auditLog).values({ actor: IIIT, action: "integration", details, at: instant });
    const [record] = await db.select().from(auditLog).where(eq(auditLog.actor, IIIT));
    assert.deepEqual(record.details, details);
    assert.equal(record.at.toISOString(), instant.toISOString());
    const [user] = await db.select().from(users).where(eq(users.iiitCode, IIIT));
    await db.insert(sessions).values({ id: IIIT, userId: user.id, expiresAt: instant });
    const [session] = await db.select().from(sessions).where(eq(sessions.id, IIIT));
    assert.equal(session.expiresAt.toISOString(), instant.toISOString());
  });

  await step("rolls back JSON draft writes with the transaction", async () => {
    await assert.rejects(db.transaction(async (tx) => {
      await tx.insert(registrationDrafts).values({ iiitCode: IIIT, contactDetails: {}, slotsMap: {} });
      throw new Error("rollback probe");
    }), /rollback probe/);
    assert.deepEqual(await db.select().from(registrationDrafts).where(eq(registrationDrafts.iiitCode, IIIT)), []);
  });

  await step("allows only one concurrent conditional payment approval", async () => {
    const [reg] = await db.select().from(registrations).where(eq(registrations.iiitCode, IIIT));
    await db.update(registrations).set({ status: "submitted" }).where(eq(registrations.id, reg.id));
    await db.insert(paymentTransactions).values({ registrationId: reg.id, uniqueStudentCount: 2, amount: 5000,
      transactionDate: new Date(), transactionId: "TEST-UTR", proofPathname: "test-only/not-an-object",
      proofFileName: "test.pdf", proofContentType: "application/pdf", proofSize: 42 });
    const results = await Promise.allSettled(Array.from({ length: 2 }, () => verifyPayment(IIIT, "TEST-UTR", 5000, "test-admin")));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.find((result) => result.status === "rejected").reason.statusCode, 409);
  });

  await step("counts parallel rate-limit hits atomically and resets expired windows", async () => {
    const rule = { limit: 8, windowSeconds: 60 };
    const results = await Promise.all(Array.from({ length: 20 }, () => hit(IIIT, rule)));
    assert.deepEqual(results.map((result) => result.count).sort((a, b) => a - b), Array.from({ length: 20 }, (_, index) => index + 1));
    assert.equal(results.filter((result) => result.ok).length, 8);
    assert.equal((await peek(IIIT, rule)).ok, false);
    await db.execute(sql`UPDATE rate_limits SET window_start = UTC_TIMESTAMP(3) - INTERVAL 120 SECOND WHERE \`key\` = ${IIIT}`);
    assert.equal((await peek(IIIT, rule)).count, 0);
    assert.equal((await hit(IIIT, rule)).count, 1);
    await reset(IIIT);
  });
} finally {
  await reset(IIIT);
  await db.delete(auditLog).where(eq(auditLog.actor, IIIT));
  await db.delete(users).where(eq(users.username, `${IIIT}-rules`));
  await db.delete(registrations).where(eq(registrations.iiitCode, IIIT));
  await db.delete(users).where(eq(users.username, IIIT));
  await getPool().end();
}

if (failed > 0) process.exit(1);
