/**
 * Database integration test: a paid roster is reopened, edited, and only the
 * difference is paid (or refunded). Writes to a real MySQL database and local
 * proof storage, so it only runs against TEST_DATABASE_URL with
 * PROOF_STORAGE=local and PROOF_STORAGE_DIR set to a throwaway folder:
 *
 *   TEST_DATABASE_URL=mysql://… PROOF_STORAGE=local PROOF_STORAGE_DIR=/tmp/x node tests/reopen-payment-integration.mjs
 */
import dotenv from "dotenv";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sameDatabase } from "./database-target.mjs";

dotenv.config({ path: ".env.local", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || process.env.PROOF_STORAGE !== "local" || !process.env.PROOF_STORAGE_DIR) {
  console.log("Skipped: set TEST_DATABASE_URL, PROOF_STORAGE=local and PROOF_STORAGE_DIR to run this test.");
  process.exit(0);
}
if (process.env.DATABASE_URL && sameDatabase(testUrl, process.env.DATABASE_URL)) {
  console.error("Refusing to run: TEST_DATABASE_URL points at the same database as DATABASE_URL.");
  process.exit(1);
}
process.env.DATABASE_URL = testUrl;

const { getRegistrationForIIIT, submitRegistration, submitPayment } = await import("../src/lib/registration/service.js");
const { reopenRegistration, verifyPayment, getAdminRegistrationsOverview } = await import("../src/lib/admin/service.js");
const { getRegistrationFee } = await import("../src/lib/registration/labels.js");
const { putProof, headProof, listProofs } = await import("../src/lib/storage/index.js");
const { getDb, getPool } = await import("../src/db/index.js");
const { registrations, users, registrationDrafts, earlierPayments } = await import("../src/db/schema.js");
const { eq } = await import("drizzle-orm");

const IIIT = `iiit-reopen-${randomUUID().slice(0, 6)}`;
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

const contact = { contactName: "A", contactEmail: "a@example.org", contactPhone: "123456", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Bus", arrivalPoint: "Koyambedu (CMBT)", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@example.org", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@example.org", staffCount: 2 };
function roster(count) {
  const studentsList = Array.from({ length: count }, (_, i) => ({ rollNumber: `R${i + 1}`, name: `STUDENT ${i + 1}`, gender: "M" }));
  return {
    contactDetails: { ...contact, boysTravelling: count, girlsTravelling: 0 },
    students: studentsList,
    entries: studentsList.map((s) => ({ sportId: "cricket", eventId: "team", gender: "M", rollNumber: s.rollNumber, isReserve: false })),
  };
}
async function saveRoster(count) {
  await db.delete(registrationDrafts).where(eq(registrationDrafts.iiitCode, IIIT));
  await submitRegistration(IIIT, roster(count), IIIT);
  return getRegistrationForIIIT(IIIT);
}
async function receipt() {
  const key = `payment-proofs/${IIIT}/${randomUUID()}.png`;
  await putProof(key, Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]), "image/png");
  return key;
}
const today = new Date().toISOString().slice(0, 10);

try {
  await db.insert(users).values({ username: IIIT, iiitCode: IIIT, iiitName: "Reopen Test IIIT", passwordHash: "x", role: "iiit" });
  const fee2 = getRegistrationFee(2);
  const fee3 = getRegistrationFee(3);
  const fee1 = getRegistrationFee(1);
  let firstKey;

  await step("pays the full fee for 2 students", async () => {
    const state = await saveRoster(2);
    assert.equal(state.paidEarlier, 0);
    firstKey = await receipt();
    const result = await submitPayment(IIIT, { rosterVersion: state.rosterVersion, paymentDetails: { transactionDate: today, transactionId: "UTR-FIRST-1", proofPathname: firstKey } }, IIIT);
    assert.equal(result.amountPaid, fee2);
  });

  await step("reopening keeps the payment and its receipt", async () => {
    const result = await reopenRegistration(IIIT, "test-admin");
    assert.equal(result.carriedPayment, fee2);
    const rows = await db.select().from(earlierPayments).where(eq(earlierPayments.iiitCode, IIIT));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, fee2);
    assert.equal(rows[0].transactionId, "UTR-FIRST-1");
    assert.equal(rows[0].proofPathname, firstKey);
    assert.equal(rows[0].carriedBy, "test-admin");
    await headProof(firstKey); // still stored
    const state = await getRegistrationForIIIT(IIIT);
    assert.equal(state.submitted, false);
    assert.equal(state.paidEarlier, fee2);
  });

  let topUpKey;
  await step("a bigger roster asks only for the difference", async () => {
    const state = await saveRoster(3);
    assert.equal(state.paidEarlier, fee2);
    await assert.rejects(submitPayment(IIIT, { rosterVersion: state.rosterVersion }, IIIT), (e) => e.statusCode === 400, "details are needed when a balance is due");
    topUpKey = await receipt();
    await assert.rejects(submitPayment(IIIT, { rosterVersion: state.rosterVersion, paymentDetails: { transactionDate: today, transactionId: "utr-first-1", proofPathname: topUpKey } }, IIIT),
      (e) => e.statusCode === 409 && /earlier payment/.test(e.message), "the earlier UTR cannot be reused");
    const result = await submitPayment(IIIT, { rosterVersion: state.rosterVersion, paymentDetails: { transactionDate: today, transactionId: "UTR-TOPUP-2", proofPathname: topUpKey } }, IIIT);
    assert.equal(result.amountPaid, fee3 - fee2);
    assert.equal(result.totalFee, fee3);
    assert.equal(result.paidEarlier, fee2);
    const locked = await getRegistrationForIIIT(IIIT);
    assert.equal(locked.payment.amount, fee3 - fee2);
    assert.equal(locked.payment.creditAmount, fee2);
    assert.equal(locked.payment.totalFee, fee3);
  });

  await step("the Sports SAC verifies each payment separately", async () => {
    // Payments are auto-verified on submission, so there is nothing left to verify.
    await assert.rejects(verifyPayment(IIIT, "admin"), (e) => e.statusCode === 409);
    let row = (await getAdminRegistrationsOverview()).find((r) => r.iiitCode === IIIT);
    assert.equal(row.paidEarlier, fee2);
    assert.equal(row.earlierPayments[0].verificationStatus, "verified");
    row = (await getAdminRegistrationsOverview()).find((r) => r.iiitCode === IIIT);
    assert.equal(row.paymentVerificationStatus, "verified");
  });

  await step("a smaller roster needs no payment and shows a refund", async () => {
    await reopenRegistration(IIIT, "test-admin");
    const rows = await db.select().from(earlierPayments).where(eq(earlierPayments.iiitCode, IIIT));
    assert.deepEqual(rows.map((r) => r.amount), [fee2, fee3 - fee2]);
    assert.deepEqual(rows.map((r) => r.verificationStatus), ["verified", "verified"]);
    const keys = await listProofs(`payment-proofs/${IIIT}/`);
    assert.ok(keys.includes(firstKey) && keys.includes(topUpKey), "both receipts are kept");
    const state = await saveRoster(1);
    assert.equal(state.paidEarlier, fee3);
    const result = await submitPayment(IIIT, { rosterVersion: state.rosterVersion }, IIIT);
    assert.equal(result.amountPaid, 0);
    const locked = await getRegistrationForIIIT(IIIT);
    assert.equal(locked.registration.status, "submitted");
    assert.equal(locked.payment.verificationStatus, "verified", "nothing new to verify");
    assert.equal(locked.payment.creditAmount - locked.payment.totalFee, fee3 - fee1, "refund due");
  });

  await step("reopening a no-balance roster does not double count", async () => {
    await reopenRegistration(IIIT, "test-admin");
    const rows = await db.select().from(earlierPayments).where(eq(earlierPayments.iiitCode, IIIT));
    assert.equal(rows.length, 2, "the zero 'no balance' record is not carried");
    assert.equal((await getRegistrationForIIIT(IIIT)).paidEarlier, fee3);
  });
} finally {
  await db.delete(registrations).where(eq(registrations.iiitCode, IIIT));
  await db.delete(registrationDrafts).where(eq(registrationDrafts.iiitCode, IIIT));
  await db.delete(earlierPayments).where(eq(earlierPayments.iiitCode, IIIT));
  await db.delete(users).where(eq(users.username, IIIT));
  await getPool().end();
}

if (failed > 0) process.exit(1);
