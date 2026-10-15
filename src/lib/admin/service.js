import { eq, and, ilike, sql, desc, count, inArray } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { users, registrations, students, studentEventParticipations, paymentTransactions } from "../../db/schema.js";

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
      isSubmitted: sql`CASE WHEN ${registrations.id} IS NOT NULL THEN true ELSE false END`,
      submittedAt: registrations.submittedAt,
      submittedBy: registrations.submittedBy,
      contactName: registrations.contactName,
      contactEmail: registrations.contactEmail,
      contactPhone: registrations.contactPhone,
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
  if (payment.transactionId.trim() !== transactionId.trim() || payment.amount !== amount) {
    const error = new Error("Entered UTR or amount does not match the submitted payment");
    error.statusCode = 422;
    throw error;
  }

  const [verified] = await db.update(paymentTransactions)
    .set({ verificationStatus: "verified", verifiedAt: new Date(), verifiedBy: adminUsername })
    .where(and(eq(paymentTransactions.id, payment.id), eq(paymentTransactions.verificationStatus, "pending")))
    .returning({ verificationStatus: paymentTransactions.verificationStatus, verifiedAt: paymentTransactions.verifiedAt, verifiedBy: paymentTransactions.verifiedBy });
  if (!verified) {
    const error = new Error("Payment verification changed; refresh and try again");
    error.statusCode = 409;
    throw error;
  }
  return verified;
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
      sql`(${registrations.iiitCode} = ${iiit} OR ${registrations.iiitName} ILIKE ${`%${iiit}%`})`
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
    conditions.push(ilike(students.rollNumber, `%${rollNumber.trim()}%`));
  }

  if (name) {
    conditions.push(ilike(students.name, `%${name.trim()}%`));
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

  // 1. Total IIITs and Submitted IIITs
  const totalIIITsResult = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.role, "iiit"));

  const submittedIIITsResult = await db
    .select({ count: count() })
    .from(registrations)
    .where(eq(registrations.status, "submitted"));

  // 2. Total unique submitted students
  const totalStudentsResult = await db
    .select({ count: count() })
    .from(students)
    .innerJoin(registrations, eq(students.registrationId, registrations.id))
    .where(eq(registrations.status, "submitted"));

  // 2b. Total event entries
  const totalEntriesResult = await db
    .select({ count: count() })
    .from(studentEventParticipations)
    .innerJoin(registrations, eq(studentEventParticipations.registrationId, registrations.id))
    .where(eq(registrations.status, "submitted"));

  // 3. Gender breakdown
  const genderBreakdownResult = await db
    .select({
      gender: students.gender,
      count: count(),
    })
    .from(students)
    .innerJoin(registrations, eq(students.registrationId, registrations.id))
    .where(eq(registrations.status, "submitted"))
    .groupBy(students.gender);

  // 4. Sport participation counts
  const sportBreakdownResult = await db
    .select({
      sportId: studentEventParticipations.sportId,
      count: count(),
    })
    .from(studentEventParticipations)
    .innerJoin(registrations, eq(studentEventParticipations.registrationId, registrations.id))
    .where(eq(registrations.status, "submitted"))
    .groupBy(studentEventParticipations.sportId)
    .orderBy(desc(count()));

  return {
    totalIIITs: Number(totalIIITsResult[0]?.count || 0),
    submittedIIITs: Number(submittedIIITsResult[0]?.count || 0),
    totalStudents: Number(totalStudentsResult[0]?.count || 0),
    totalEventEntries: Number(totalEntriesResult[0]?.count || 0),
    genderBreakdown: genderBreakdownResult.reduce((acc, curr) => {
      acc[curr.gender] = Number(curr.count);
      return acc;
    }, { M: 0, F: 0 }),
    sportBreakdown: sportBreakdownResult.map((s) => ({
      sportId: s.sportId,
      count: Number(s.count),
    })),
  };
}
