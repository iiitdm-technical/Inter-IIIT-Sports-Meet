import { eq, and, sql, count, inArray } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { users, registrations, registrationDrafts, students, studentEventParticipations, paymentTransactions } from "../../db/schema.js";
import { getSlotKey } from "../registration/client-utils.js";
import { deleteProof, listProofs } from "../storage/index.js";
import { getStorageSummary } from "../storage/usage.js";

function affectedRows(result) {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}

export async function getAdminAccounts() {
  return getDb().select({
    id: users.id,
    username: users.username,
    email: users.email,
    displayName: users.displayName,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.role, "admin")).orderBy(users.username);
}

/**
 * Get list of all IIIT registrations with submission status, counts, and payment info
 */
export async function getAdminRegistrationsOverview() {
  const db = getDb();

  const results = await db
    .select({
      id: registrations.id,
      iiitCode: users.iiitCode,
      iiitName: users.iiitName,
      isSubmitted: sql`CASE WHEN ${registrations.id} IS NOT NULL THEN true ELSE false END`
        .mapWith((value) => Boolean(value)),
      submittedAt: registrations.submittedAt,
      submittedBy: registrations.submittedBy,
      contactName: registrations.contactName,
      contactEmail: registrations.contactEmail,
      contactPhone: registrations.contactPhone,
      arrivalDate: registrations.arrivalDate,
      arrivalTime: registrations.arrivalTime,
      travelMode: registrations.travelMode,
      arrivalPoint: registrations.arrivalPoint,
      departureDate: registrations.departureDate,
      boysSecretaryName: registrations.boysSecretaryName,
      boysSecretaryPhone: registrations.boysSecretaryPhone,
      boysSecretaryEmail: registrations.boysSecretaryEmail,
      girlsSecretaryName: registrations.girlsSecretaryName,
      girlsSecretaryPhone: registrations.girlsSecretaryPhone,
      girlsSecretaryEmail: registrations.girlsSecretaryEmail,
      boysCount: registrations.boysCount,
      girlsCount: registrations.girlsCount,
      staffCount: registrations.staffCount,
      notes: registrations.notes,
      totalStudentsCount: sql`COALESCE(${registrations.totalStudentsCount}, 0)`,
      status: registrations.status,
      updatedAt: registrations.updatedAt,
      // Payment data
      paymentAmount: paymentTransactions.amount,
      paymentTransactionId: paymentTransactions.transactionId,
      paymentTransactionDate: paymentTransactions.transactionDate,
      paymentBankName: paymentTransactions.bankName,
      paymentMode: paymentTransactions.paymentMode,
      otherPaymentMode: paymentTransactions.otherPaymentMode,
      paymentProofPathname: paymentTransactions.proofPathname,
      paymentProofFileName: paymentTransactions.proofFileName,
      paymentVerificationStatus: paymentTransactions.verificationStatus,
      paymentVerifiedAt: paymentTransactions.verifiedAt,
      paymentVerifiedBy: paymentTransactions.verifiedBy,
    })
    .from(users)
    .leftJoin(registrations, eq(users.iiitCode, registrations.iiitCode))
    .leftJoin(paymentTransactions, eq(registrations.id, paymentTransactions.registrationId))
    .where(eq(users.role, "iiit"))
    .orderBy(users.iiitName);

  return results;
}

export async function verifyPayment(iiitCode, transactionId, amount, adminUsername) {
  const db = getDb();
  const [registration] = await db.select({ id: registrations.id, status: registrations.status })
    .from(registrations).where(eq(registrations.iiitCode, iiitCode)).limit(1);
  if (!registration || registration.status !== "submitted") {
    const error = new Error("Payment proof has not been submitted for this IIIT");
    error.statusCode = 409;
    throw error;
  }

  const [payment] = await db.select().from(paymentTransactions)
    .where(eq(paymentTransactions.registrationId, registration.id)).limit(1);
  if (!payment) {
    const error = new Error("Payment record not found");
    error.statusCode = 409;
    throw error;
  }
  if (payment.verificationStatus === "verified") {
    const error = new Error("Payment is already verified");
    error.statusCode = 409;
    throw error;
  }
  if (payment.transactionId.trim().toUpperCase() !== transactionId.trim().toUpperCase() || payment.amount !== amount) {
    const error = new Error("Entered UTR or amount does not match the submitted payment");
    error.statusCode = 422;
    throw error;
  }

  const verifiedAt = new Date();
  const result = await db.update(paymentTransactions)
    .set({ verificationStatus: "verified", verifiedAt, verifiedBy: adminUsername })
    .where(and(eq(paymentTransactions.id, payment.id), eq(paymentTransactions.verificationStatus, "pending")));
  if (affectedRows(result) === 0) {
    const error = new Error("Payment verification changed; refresh and try again");
    error.statusCode = 409;
    throw error;
  }
  return { verificationStatus: "verified", verifiedAt, verifiedBy: adminUsername };
}

/**
 * Server-side filtered query for submitted student event entries
 */
export async function getAdminFilteredEntries({
  iiit,
  sport,
  event,
  gender,
  rollNumber,
  name,
  page = 1,
  limit = 50,
} = {}) {
  const db = getDb();

  const conditions = [inArray(registrations.status, ["payment_pending", "submitted"])];

  if (iiit) {
    conditions.push(
      sql`(${registrations.iiitCode} = ${iiit} OR LOWER(${registrations.iiitName}) LIKE LOWER(${`%${iiit}%`}))`
    );
  }

  if (sport) {
    conditions.push(eq(studentEventParticipations.sportId, sport.toLowerCase()));
  }

  if (event) {
    conditions.push(eq(studentEventParticipations.eventId, event.toLowerCase()));
  }

  if (gender) {
    conditions.push(eq(students.gender, gender.toUpperCase()));
  }

  if (rollNumber) {
    conditions.push(sql`LOWER(${students.rollNumber}) LIKE LOWER(${`%${rollNumber.trim()}%`})`);
  }

  if (name) {
    conditions.push(sql`LOWER(${students.name}) LIKE LOWER(${`%${name.trim()}%`})`);
  }

  page = Number.isSafeInteger(page) ? Math.max(1, page) : 1;
  limit = Number.isSafeInteger(limit) ? Math.min(100, Math.max(1, limit)) : 50;
  const offset = Math.max(0, (page - 1) * limit);

  // Total count query
  const countResult = await db
    .select({ count: count() })
    .from(studentEventParticipations)
    .innerJoin(students, eq(studentEventParticipations.studentId, students.id))
    .innerJoin(registrations, eq(studentEventParticipations.registrationId, registrations.id))
    .where(and(...conditions));

  const total = Number(countResult[0]?.count || 0);

  // Data query
  const rows = await db
    .select({
      id: studentEventParticipations.id,
      iiitCode: registrations.iiitCode,
      iiitName: registrations.iiitName,
      rollNumber: students.rollNumber,
      studentName: students.name,
      studentGender: students.gender,
      sportId: studentEventParticipations.sportId,
      eventId: studentEventParticipations.eventId,
      eventGender: studentEventParticipations.gender,
      isReserve: studentEventParticipations.isReserve,
      submittedAt: registrations.submittedAt,
    })
    .from(studentEventParticipations)
    .innerJoin(students, eq(studentEventParticipations.studentId, students.id))
    .innerJoin(registrations, eq(studentEventParticipations.registrationId, registrations.id))
    .where(and(...conditions))
    .orderBy(registrations.iiitName, students.rollNumber, studentEventParticipations.sportId)
    .limit(limit)
    .offset(offset);

  return {
    rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Get aggregate statistics across all submitted registrations
 */
export async function getAdminStats() {
  const db = getDb();
  // Locked rosters count from the moment of roster submission, matching the
  // entries list; payment progress is reported separately.
  const lockedStatuses = inArray(registrations.status, ["payment_pending", "submitted"]);

  const [totalIIITsResult, registrationCounts, totalStudentsResult, totalEntriesResult, verifiedResult, storage] = await Promise.all([
    db.select({ count: count() }).from(users).where(eq(users.role, "iiit")),
    db.select({ status: registrations.status, count: count() }).from(registrations).where(lockedStatuses).groupBy(registrations.status),
    db.select({ count: count() }).from(students)
      .innerJoin(registrations, eq(students.registrationId, registrations.id))
      .where(lockedStatuses),
    db.select({ count: count() }).from(studentEventParticipations)
      .innerJoin(registrations, eq(studentEventParticipations.registrationId, registrations.id))
      .where(lockedStatuses),
    db.select({ count: count() }).from(paymentTransactions)
      .where(eq(paymentTransactions.verificationStatus, "verified")),
    getStorageSummary(),
  ]);

  const byStatus = Object.fromEntries(registrationCounts.map((row) => [row.status, Number(row.count)]));
  const paymentsSubmitted = byStatus.submitted || 0;

  return {
    totalIIITs: Number(totalIIITsResult[0]?.count || 0),
    lockedIIITs: paymentsSubmitted + (byStatus.payment_pending || 0),
    paymentsSubmitted,
    paymentsVerified: Number(verifiedResult[0]?.count || 0),
    totalStudents: Number(totalStudentsResult[0]?.count || 0),
    totalEventEntries: Number(totalEntriesResult[0]?.count || 0),
    storage,
  };
}

/**
 * Turns a locked roster back into an editable draft so the IIIT can correct it.
 *
 * Allowed until the payment is bank-verified. The roster becomes the IIIT's
 * cloud draft (same slots, names and contact details); the registration, its
 * entries and any submitted payment record are deleted, and the payment proof
 * files are removed from storage. The IIIT then re-submits as normal.
 */
export async function reopenRegistration(iiitCode) {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [registration] = await tx.select().from(registrations)
      .where(eq(registrations.iiitCode, iiitCode)).limit(1).for("update");
    if (!registration) {
      const error = new Error("This IIIT has no locked roster to reopen");
      error.statusCode = 404;
      throw error;
    }
    const [payment] = await tx.select().from(paymentTransactions)
      .where(eq(paymentTransactions.registrationId, registration.id)).limit(1);
    if (payment?.verificationStatus === "verified") {
      const error = new Error("The payment is already bank-verified, so this roster can no longer be reopened");
      error.statusCode = 409;
      throw error;
    }

    const rows = await tx.select({
      id: studentEventParticipations.id,
      sportId: studentEventParticipations.sportId,
      eventId: studentEventParticipations.eventId,
      gender: studentEventParticipations.gender,
      isReserve: studentEventParticipations.isReserve,
      rollNumber: students.rollNumber,
      name: students.name,
      studentGender: students.gender,
    })
      .from(studentEventParticipations)
      .innerJoin(students, eq(studentEventParticipations.studentId, students.id))
      .where(eq(studentEventParticipations.registrationId, registration.id))
      .orderBy(studentEventParticipations.id);

    const slotsMap = {};
    const nextIndex = new Map();
    for (const row of rows) {
      const role = row.isReserve ? "reserve" : "main";
      const groupKey = `${row.sportId}|${row.eventId}|${row.gender}|${role}`;
      const index = nextIndex.get(groupKey) || 0;
      nextIndex.set(groupKey, index + 1);
      slotsMap[getSlotKey(row.sportId, row.eventId, row.gender, role, index)] = {
        rollNumber: row.rollNumber,
        name: row.name,
        gender: row.studentGender,
      };
    }
    const contactDetails = {
      contactName: registration.contactName,
      contactEmail: registration.contactEmail,
      contactPhone: registration.contactPhone,
      arrivalDate: registration.arrivalDate || "",
      arrivalTime: registration.arrivalTime || "",
      travelMode: registration.travelMode || "",
      arrivalPoint: registration.arrivalPoint || "",
      departureDate: registration.departureDate || "",
      boysSecretaryName: registration.boysSecretaryName || "",
      boysSecretaryPhone: registration.boysSecretaryPhone || "",
      boysSecretaryEmail: registration.boysSecretaryEmail || "",
      girlsSecretaryName: registration.girlsSecretaryName || "",
      girlsSecretaryPhone: registration.girlsSecretaryPhone || "",
      girlsSecretaryEmail: registration.girlsSecretaryEmail || "",
      boysTravelling: registration.boysCount == null ? "" : String(registration.boysCount),
      girlsTravelling: registration.girlsCount == null ? "" : String(registration.girlsCount),
      staffCount: registration.staffCount == null ? "" : String(registration.staffCount),
      notes: registration.notes || "",
    };

    await tx.insert(registrationDrafts)
      .values({ iiitCode, contactDetails, slotsMap, revision: 1, updatedAt: new Date() })
      .onDuplicateKeyUpdate({
        set: { contactDetails, slotsMap, revision: sql`${registrationDrafts.revision} + 1`, updatedAt: new Date() },
      });
    await tx.delete(registrations).where(eq(registrations.id, registration.id));

    return {
      iiitCode,
      students: registration.totalStudentsCount,
      entries: rows.length,
      removedPayment: Boolean(payment),
    };
  });

  // Storage is outside the transaction; a leftover file is harmless.
  try {
    const keys = await listProofs(`payment-proofs/${iiitCode}/`);
    await Promise.all(keys.map((key) => deleteProof(key)));
  } catch (error) {
    console.error("Could not remove payment proofs after reopening:", error.message);
  }
  return result;
}
