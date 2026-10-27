import { eq, and, ne, sql } from "drizzle-orm";
import { MAX_PROOF_BYTES, MAX_PROOF_LABEL, getRegistrationFee } from "./labels.js";
import { assertRegistrationOpen, isUniqueViolation } from "./deadline.js";
import { getDb } from "../../db/index.js";
import { users, registrations, registrationDrafts, students, studentEventParticipations, paymentTransactions } from "../../db/schema.js";
import { headProof } from "../storage/index.js";
import { registrationSubmitSchema, paymentSubmitSchema } from "../validation/schemas.js";
import { countByGender } from "./contingent.js";
import { validateRegistrationRules } from "../validation/rules.js";

function affectedRows(result) {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}

/**
 * Fetch submitted registration state and entries for an IIIT.
 * If the IIIT has not submitted, returns an empty non-submitted state.
 * Unsubmitted drafts are served separately by /api/registration/draft.
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
  assertRegistrationOpen();

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
    // Insert new registration in payment_pending state. A concurrent
    // submission for the same IIIT fails on the unique iiit_code index.
    const submittedAt = new Date();
    const [insertedReg] = await tx
      .insert(registrations)
      .values({
        iiitCode,
        iiitName,
        status: "payment_pending",
        submittedAt,
        submittedBy: username,
        contactName: payload.contactDetails.contactName,
        contactEmail: payload.contactDetails.contactEmail,
        contactPhone: payload.contactDetails.contactPhone,
        arrivalDate: payload.contactDetails.arrivalDate,
        arrivalTime: payload.contactDetails.arrivalTime,
        travelMode: payload.contactDetails.travelMode,
        arrivalPoint: payload.contactDetails.arrivalPoint || null,
        departureDate: payload.contactDetails.departureDate || null,
        boysSecretaryName: payload.contactDetails.boysSecretaryName,
        boysSecretaryPhone: payload.contactDetails.boysSecretaryPhone,
        boysSecretaryEmail: payload.contactDetails.boysSecretaryEmail,
        girlsSecretaryName: payload.contactDetails.girlsSecretaryName,
        girlsSecretaryPhone: payload.contactDetails.girlsSecretaryPhone,
        girlsSecretaryEmail: payload.contactDetails.girlsSecretaryEmail,
        boysCount: countByGender(payload.students).boys,
        girlsCount: countByGender(payload.students).girls,
        staffCount: payload.contactDetails.staffCount,
        notes: payload.contactDetails.notes || null,
        totalStudentsCount: payload.students.length,
      })
      .$returningId();

    const regId = insertedReg?.id;
    if (regId == null) throw new Error("Could not retrieve the new registration ID");

    // Insert student roster
    const studentRows = payload.students.map((s) => ({
      registrationId: regId,
      iiitCode,
      rollNumber: s.rollNumber,
      name: s.name,
      gender: s.gender,
    }));

    await tx.insert(students).values(studentRows);

    // MySQL does not support RETURNING rows for inserts. Querying by the
    // registration ID in this transaction gives us the exact generated IDs
    // without relying on auto-increment ranges from a bulk insert.
    const insertedStudents = await tx
      .select({ id: students.id, rollNumber: students.rollNumber })
      .from(students)
      .where(eq(students.registrationId, regId));

    // Map rollNumber -> studentId
    const rollToIdMap = new Map();
    for (const s of insertedStudents) {
      rollToIdMap.set(s.rollNumber, s.id);
    }

    // Insert event participations
    const participationRows = payload.entries.map((entry) => {
      const studentId = rollToIdMap.get(entry.rollNumber);
      if (studentId == null) {
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

    await tx.delete(registrationDrafts).where(eq(registrationDrafts.iiitCode, iiitCode));

    return {
      registrationId: regId,
      iiitCode,
      iiitName,
      status: "payment_pending",
      isLocked: true, // Data locked, but payment still pending
      totalStudentsCount: payload.students.length,
      totalEntriesCount: payload.entries.length,
      submittedAt: submittedAt.toISOString(),
    };
  }).catch((error) => {
    if (isUniqueViolation(error)) {
      const conflict = new Error("This roster has already been submitted from another session. Reload the page to see it.");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
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

  if (proofDetails.size > MAX_PROOF_BYTES) {
    const error = new Error(`Payment proof file size exceeds the ${MAX_PROOF_LABEL} limit`);
    error.statusCode = 400;
    throw error;
  }

  // 4. Execute atomic database transaction
  const result = await db.transaction(async (tx) => {
    // A row lock serializes payment against administrative reopen/status
    // changes. Recheck the state after acquiring it; the preflight read above
    // is only for fast feedback before checking object storage.
    const [lockedReg] = await tx.select().from(registrations)
      .where(eq(registrations.id, reg.id)).limit(1).for("update");
    if (!lockedReg) {
      const error = new Error("Registration not found. Please submit registration first.");
      error.statusCode = 404;
      throw error;
    }
    if (lockedReg.status === "submitted") {
      const conflict = new Error("Payment has already been submitted. Reload the page to see it.");
      conflict.statusCode = 409;
      throw conflict;
    }
    if (lockedReg.status !== "payment_pending") {
      const error = new Error(`Registration is in an invalid state: ${lockedReg.status}.`);
      error.statusCode = 400;
      throw error;
    }

    // Prevent concurrent payments for the same registration
    const existingPayment = await tx
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.registrationId, lockedReg.id))
      .limit(1);

    if (existingPayment.length > 0) {
      const conflict = new Error("Payment has already been submitted. Reload the page to see it.");
      conflict.statusCode = 409;
      throw conflict;
    }

    // One bank transaction pays for one IIIT. A reference already used by
    // another IIIT is almost always a copy-paste mistake.
    const transactionId = payload.paymentDetails.transactionId;
    const [reused] = await tx
      .select({ id: paymentTransactions.id })
      .from(paymentTransactions)
      .where(and(
        sql`LOWER(${paymentTransactions.transactionId}) = LOWER(${transactionId})`,
        ne(paymentTransactions.registrationId, lockedReg.id)
      ))
      .limit(1);
    if (reused) {
      const conflict = new Error("This transaction ID is already used by another IIIT's payment. Check the reference on your receipt, or contact the Sports Cell.");
      conflict.statusCode = 409;
      throw conflict;
    }

    // Insert payment transaction
    // Calculate from the authoritative roster count read while holding the
    // registration lock, rather than trusting the original preflight read.
    const uniqueStudentsCount = lockedReg.totalStudentsCount;
    const amount = getRegistrationFee(uniqueStudentsCount);
    await tx.insert(paymentTransactions).values({
      registrationId: lockedReg.id,
      uniqueStudentCount: uniqueStudentsCount,
      amount,
      transactionDate: new Date(payload.paymentDetails.transactionDate),
      transactionId,
      // Payment methods and bank details are handled entirely by the portal.
      bankName: null,
      paymentMode: "CCAvenue",
      otherPaymentMode: null,
      proofPathname: proofDetails.pathname,
      proofFileName: proofDetails.pathname.split('/').pop(),
      proofContentType: proofDetails.contentType,
      proofSize: proofDetails.size,
    });

    // Update registration status to submitted (permanently locked)
    const updateResult = await tx.update(registrations)
      .set({ status: "submitted" })
      .where(and(
        eq(registrations.id, lockedReg.id),
        eq(registrations.status, "payment_pending")
      ));
    if (affectedRows(updateResult) === 0) {
      const conflict = new Error("Registration status changed. Reload the page to see the latest state.");
      conflict.statusCode = 409;
      throw conflict;
    }

    return {
      registrationId: lockedReg.id,
      iiitCode,
      status: "submitted",
      amountPaid: amount,
    };
  }).catch((error) => {
    if (isUniqueViolation(error)) {
      const conflict = new Error("Payment has already been submitted. Reload the page to see it.");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  });

  return result;
}
