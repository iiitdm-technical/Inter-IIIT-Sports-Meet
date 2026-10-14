import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { users, registrations, students, studentEventParticipations, paymentTransactions } from "../../db/schema.js";
import { headProof } from "../storage/neon.js";
import { registrationSubmitSchema, paymentSubmitSchema } from "../validation/schemas.js";
import { validateRegistrationRules } from "../validation/rules.js";

/**
 * Fetch submitted registration state and entries for an IIIT.
 * If the IIIT has not submitted, returns an empty non-submitted state.
 * (Unsubmitted drafts exist solely in client browser localStorage)
 */
export async function getRegistrationForIIIT(iiitCode) {
  const db = getDb();

  // Find submitted registration record
  const regList = await db
    .select()
    .from(registrations)
    .where(eq(registrations.iiitCode, iiitCode))
    .limit(1);

  if (regList.length === 0) {
    return {
      submitted: false,
      isLocked: false,
      registration: null,
      students: [],
      entries: [],
    };
  }

  const reg = regList[0];

  // Fetch students
  const studentList = await db
    .select()
    .from(students)
    .where(eq(students.registrationId, reg.id));

  // Fetch entries
  const participationList = await db
    .select({
      id: studentEventParticipations.id,
      sportId: studentEventParticipations.sportId,
      eventId: studentEventParticipations.eventId,
      gender: studentEventParticipations.gender,
      isReserve: studentEventParticipations.isReserve,
      studentId: studentEventParticipations.studentId,
      studentName: students.name,
      rollNumber: students.rollNumber,
      studentGender: students.gender,
    })
    .from(studentEventParticipations)
    .innerJoin(students, eq(studentEventParticipations.studentId, students.id))
    .where(eq(studentEventParticipations.registrationId, reg.id));

  // Fetch payment transaction
  const paymentList = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.registrationId, reg.id))
    .limit(1);

  return {
    submitted: true,
    isLocked: true,
    registration: reg,
    students: studentList,
    entries: participationList,
    payment: paymentList.length > 0 ? paymentList[0] : null,
  };
}

export async function submitRegistration(iiitCode, rawPayload, username) {
  const db = getDb();

  // 1. Zod input validation
  const parsed = registrationSubmitSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const error = new Error("Invalid registration submission data format");
    error.statusCode = 400;
    error.details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw error;
  }

  const payload = parsed.data;

  // 2. Business rules validation
  const ruleResult = validateRegistrationRules(payload);
  if (!ruleResult.isValid) {
    const error = new Error("Registration business rules validation failed");
    error.statusCode = 422;
    error.details = ruleResult.errors;
    throw error;
  }

  // 3. Check if that IIIT has already submitted (either payment_pending or submitted)
  const existingRegList = await db
    .select()
    .from(registrations)
    .where(eq(registrations.iiitCode, iiitCode))
    .limit(1);

  if (existingRegList.length > 0) {
    const error = new Error(
      "Registration already exists. Cannot submit new registration."
    );
    error.statusCode = 403;
    throw error;
  }

  // 4. Retrieve official IIIT Name from users table
  const userList = await db
    .select({ iiitName: users.iiitName })
    .from(users)
    .where(eq(users.iiitCode, iiitCode))
    .limit(1);

  const iiitName = userList[0]?.iiitName || iiitCode;

  // 5. Execute atomic database transaction
  const result = await db.transaction(async (tx) => {
    // Insert new registration in payment_pending state
    const [insertedReg] = await tx
      .insert(registrations)
      .values({
        iiitCode,
        iiitName,
        status: "payment_pending",
        submittedAt: new Date(),
        submittedBy: username,
        contactName: payload.contactDetails.contactName,
        contactEmail: payload.contactDetails.contactEmail,
        contactPhone: payload.contactDetails.contactPhone,
        notes: payload.contactDetails.notes || null,
        totalStudentsCount: payload.students.length,
      })
      .returning();

    const regId = insertedReg.id;

    // Insert student roster
    const studentRows = payload.students.map((s) => ({
      registrationId: regId,
      iiitCode,
      rollNumber: s.rollNumber,
      name: s.name,
      gender: s.gender,
    }));

    const insertedStudents = await tx
      .insert(students)
      .values(studentRows)
      .returning();

    // Map rollNumber -> studentId
    const rollToIdMap = new Map();
    for (const s of insertedStudents) {
      rollToIdMap.set(s.rollNumber, s.id);
    }

    // Insert event participations
    const participationRows = payload.entries.map((entry) => {
      const studentId = rollToIdMap.get(entry.rollNumber);
      if (!studentId) {
        throw new Error(`Internal error mapping student roll number: ${entry.rollNumber}`);
      }
      return {
        registrationId: regId,
        studentId,
        sportId: entry.sportId,
        eventId: entry.eventId,
        gender: entry.gender,
        isReserve: entry.isReserve,
      };
    });

    await tx.insert(studentEventParticipations).values(participationRows);

    return {
      registrationId: regId,
      iiitCode,
      iiitName,
      status: "payment_pending",
      isLocked: true, // Data locked, but payment still pending
      totalStudentsCount: payload.students.length,
      totalEntriesCount: payload.entries.length,
      submittedAt: new Date().toISOString(),
    };
  });

  return result;
}

/**
 * Authoritatively validate and submit payment for a payment_pending registration.
 * Permanently locks the registration and payment.
 */
export async function submitPayment(iiitCode, rawPayload, username) {
  const db = getDb();

  // 1. Zod input validation
  const parsed = paymentSubmitSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const error = new Error("Invalid payment submission data format");
    error.statusCode = 400;
    error.details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw error;
  }

  const payload = parsed.data;

  // 2. Fetch the registration to ensure it exists and is payment_pending
  const regList = await db
    .select()
    .from(registrations)
    .where(eq(registrations.iiitCode, iiitCode))
    .limit(1);

  if (regList.length === 0) {
    const error = new Error("Registration not found. Please submit registration first.");
    error.statusCode = 404;
    throw error;
  }

  const reg = regList[0];

  if (reg.status === "submitted") {
    const error = new Error("Payment has already been submitted and is permanently locked.");
    error.statusCode = 403;
    throw error;
  }

  if (reg.status !== "payment_pending") {
    const error = new Error(`Registration is in an invalid state: ${reg.status}.`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Verify the private Neon Object Storage proof
  let proofDetails;
  try {
    proofDetails = await headProof(payload.paymentDetails.proofPathname);
  } catch {
    const error = new Error("Payment proof not found or inaccessible");
    error.statusCode = 400;
    throw error;
  }

  // Enforce isolation: Pathname must belong to this IIIT's secure folder
  const expectedPrefix = `payment-proofs/${iiitCode}/`;
  if (!proofDetails.pathname.startsWith(expectedPrefix)) {
    const error = new Error("Payment proof does not belong to your IIIT");
    error.statusCode = 403;
    throw error;
  }

  // Enforce content type on the stored object.
  const allowedContentTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowedContentTypes.includes(proofDetails.contentType)) {
    const error = new Error("Payment proof must be a PDF, JPG, or PNG");
    error.statusCode = 400;
    throw error;
  }

  if (proofDetails.size > 4 * 1024 * 1024) {
    const error = new Error("Payment proof file size exceeds 4MB limit");
    error.statusCode = 400;
    throw error;
  }

  // Calculate amount based on authoritative totalStudentsCount
  const uniqueStudentsCount = reg.totalStudentsCount;
  const amount = uniqueStudentsCount * 2500;

  // 4. Execute atomic database transaction
  const result = await db.transaction(async (tx) => {
    // Prevent concurrent payments for the same registration
    const existingPayment = await tx
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.registrationId, reg.id))
      .limit(1);

    if (existingPayment.length > 0) {
      throw new Error("Payment has already been processed.");
    }

    // Insert payment transaction
    await tx.insert(paymentTransactions).values({
      registrationId: reg.id,
      uniqueStudentCount: uniqueStudentsCount,
      amount,
      transactionDate: new Date(payload.paymentDetails.transactionDate),
      transactionId: payload.paymentDetails.transactionId,
      bankName: payload.paymentDetails.bankName || null,
      paymentMode: payload.paymentDetails.paymentMode,
      otherPaymentMode: payload.paymentDetails.paymentMode === "OTHER" ? payload.paymentDetails.otherPaymentMode : null,
      proofPathname: proofDetails.pathname,
      proofFileName: proofDetails.pathname.split('/').pop(),
      proofContentType: proofDetails.contentType,
      proofSize: proofDetails.size,
    });

    // Update registration status to submitted (permanently locked)
    await tx.update(registrations)
      .set({ status: "submitted" })
      .where(eq(registrations.id, reg.id));

    return {
      registrationId: reg.id,
      iiitCode,
      status: "submitted",
      amountPaid: amount,
    };
  });

  return result;
}
