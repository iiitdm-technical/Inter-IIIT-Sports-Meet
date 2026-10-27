import { eq, and, ne, sql } from "drizzle-orm";
import { MAX_PROOF_BYTES, MAX_PROOF_LABEL, getRegistrationFee } from "./labels.js";
import { assertRegistrationOpen, isUniqueViolation } from "./deadline.js";
import { getDb } from "../../db/index.js";
import { users, registrations, registrationDrafts, students, studentEventParticipations, paymentTransactions } from "../../db/schema.js";
import { headProof } from "../storage/index.js";
import { registrationSubmitSchema, paymentSubmitSchema } from "../validation/schemas.js";
import { countByGender } from "./contingent.js";
import { validateRegistrationRules } from "../validation/rules.js";
import { buildEditableDraft, createRosterVersion } from "./roster-version.js";

function affectedRows(result) {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}

/**
 * Fetch the registration state and entries for an IIIT.
 * If the IIIT has no roster, returns an empty state. In-progress JSON drafts
 * remain available separately from /api/registration/draft.
 */
export async function getRegistrationForIIIT(iiitCode) {
  const db = getDb();
  return db.transaction(async (tx) => {
    // Read the registration and all versioned children in one consistent
    // snapshot so the payment precondition always corresponds to this roster.
    const [reg] = await tx.select().from(registrations)
      .where(eq(registrations.iiitCode, iiitCode)).limit(1);

    if (!reg) {
      return {
        submitted: false,
        isLocked: false,
        registration: null,
        students: [],
        entries: [],
        payment: null,
        rosterVersion: null,
        editableDraft: null,
      };
    }

    const studentList = await tx.select().from(students)
      .where(eq(students.registrationId, reg.id)).orderBy(students.rollNumber);
    const participationList = await tx.select({
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
      .where(eq(studentEventParticipations.registrationId, reg.id))
      .orderBy(studentEventParticipations.id);
    const [payment] = await tx.select().from(paymentTransactions)
      .where(eq(paymentTransactions.registrationId, reg.id)).limit(1);

    return {
      // `submitted` historically means a registration row exists; retain that
      // compatibility flag while `isLocked` now reflects the actual lifecycle.
      submitted: true,
      isLocked: reg.status === "submitted",
      registration: reg,
      students: studentList,
      entries: participationList,
      payment: payment || null,
      rosterVersion: createRosterVersion(reg, studentList, participationList),
      editableDraft: buildEditableDraft(reg, participationList),
    };
  });
}

function nextRosterTimestamp(previous) {
  const previousMs = previous instanceof Date ? previous.getTime() : Date.parse(previous || "");
  return new Date(Math.max(Date.now(), Number.isFinite(previousMs) ? previousMs + 1 : 0));
}

function registrationValues(iiitCode, iiitName, username, payload, submittedAt) {
  const { contactDetails } = payload;
  const { boys, girls } = countByGender(payload.students);
  return {
    iiitCode,
    iiitName,
    status: "payment_pending",
    submittedAt,
    updatedAt: submittedAt,
    submittedBy: username,
    contactName: contactDetails.contactName,
    contactEmail: contactDetails.contactEmail,
    contactPhone: contactDetails.contactPhone,
    arrivalDate: contactDetails.arrivalDate,
    arrivalTime: contactDetails.arrivalTime,
    travelMode: contactDetails.travelMode,
    arrivalPoint: contactDetails.arrivalPoint || null,
    departureDate: contactDetails.departureDate || null,
    boysSecretaryName: contactDetails.boysSecretaryName,
    boysSecretaryPhone: contactDetails.boysSecretaryPhone,
    boysSecretaryEmail: contactDetails.boysSecretaryEmail,
    girlsSecretaryName: contactDetails.girlsSecretaryName,
    girlsSecretaryPhone: contactDetails.girlsSecretaryPhone,
    girlsSecretaryEmail: contactDetails.girlsSecretaryEmail,
    boysCount: boys,
    girlsCount: girls,
    staffCount: contactDetails.staffCount,
    notes: contactDetails.notes || null,
    totalStudentsCount: payload.students.length,
  };
}

async function replaceRosterRows(tx, registrationId, iiitCode, payload) {
  await tx.delete(studentEventParticipations)
    .where(eq(studentEventParticipations.registrationId, registrationId));
  await tx.delete(students).where(eq(students.registrationId, registrationId));

  const studentRows = payload.students.map((student) => ({
    registrationId,
    iiitCode,
    rollNumber: student.rollNumber,
    name: student.name,
    gender: student.gender,
  }));
  await tx.insert(students).values(studentRows);

  const insertedStudents = await tx.select({ id: students.id, rollNumber: students.rollNumber })
    .from(students).where(eq(students.registrationId, registrationId));
  const rollToIdMap = new Map(insertedStudents.map((student) => [student.rollNumber, student.id]));
  const participationRows = payload.entries.map((entry) => {
    const studentId = rollToIdMap.get(entry.rollNumber);
    if (studentId == null) {
      throw new Error(`Internal error mapping student roll number: ${entry.rollNumber}`);
    }
    return {
      registrationId,
      studentId,
      sportId: entry.sportId,
      eventId: entry.eventId,
      gender: entry.gender,
      isReserve: entry.isReserve,
    };
  });
  await tx.insert(studentEventParticipations).values(participationRows);
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

  // Lock order is shared with draft saves and payment submission: owner user
  // first, then its registration. The user lock serializes initial creation,
  // which has no registration row available to lock yet.
  const result = await db.transaction(async (tx) => {
    const [owner] = await tx.select({ iiitName: users.iiitName }).from(users)
      .where(eq(users.iiitCode, iiitCode)).limit(1).for("update");
    if (!owner) {
      const error = new Error("No IIIT account is associated with this registration");
      error.statusCode = 404;
      throw error;
    }

    const [existing] = await tx.select().from(registrations)
      .where(eq(registrations.iiitCode, iiitCode)).limit(1).for("update");
    if (existing && existing.status !== "payment_pending") {
      const error = new Error("Payment has been submitted; the registration is permanently locked.");
      error.statusCode = 403;
      throw error;
    }

    const iiitName = owner.iiitName || iiitCode;
    const submittedAt = nextRosterTimestamp(existing?.submittedAt);
    const values = registrationValues(iiitCode, iiitName, username, payload, submittedAt);
    let registrationId;
    if (existing) {
      const updateResult = await tx.update(registrations).set(values)
        .where(and(
          eq(registrations.id, existing.id),
          eq(registrations.status, "payment_pending"),
        ));
      if (affectedRows(updateResult) === 0) {
        const conflict = new Error("Registration state changed. Reload the page and try again.");
        conflict.statusCode = 409;
        throw conflict;
      }
      registrationId = existing.id;
    } else {
      const [insertedReg] = await tx.insert(registrations).values(values).$returningId();
      registrationId = insertedReg?.id;
      if (registrationId == null) throw new Error("Could not retrieve the new registration ID");
    }

    await replaceRosterRows(tx, registrationId, iiitCode, payload);

    await tx.delete(registrationDrafts).where(eq(registrationDrafts.iiitCode, iiitCode));

    return {
      registrationId,
      iiitCode,
      iiitName,
      status: "payment_pending",
      isLocked: false,
      totalStudentsCount: payload.students.length,
      totalEntriesCount: payload.entries.length,
      submittedAt: submittedAt.toISOString(),
    };
  }).catch((error) => {
    if (isUniqueViolation(error)) {
      const conflict = new Error("This roster was updated from another session. Reload the page to see it.");
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

  // A preflight read avoids a storage request for an unknown registration.
  // The current registration is looked up again under the shared lifecycle
  // locks below before the receipt is accepted.
  const [reg] = await db.select().from(registrations)
    .where(eq(registrations.iiitCode, iiitCode)).limit(1);

  if (!reg) {
    const error = new Error("Registration not found. Please submit registration first.");
    error.statusCode = 404;
    throw error;
  }

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
    // Keep the same lock order as roster submissions and draft saves. Locking
    // the owner also serializes the absent-registration case and draft checks.
    const [owner] = await tx.select({ id: users.id }).from(users)
      .where(eq(users.iiitCode, iiitCode)).limit(1).for("update");
    if (!owner) {
      const error = new Error("Registration not found. Please submit registration first.");
      error.statusCode = 404;
      throw error;
    }
    const [lockedReg] = await tx.select().from(registrations)
      .where(eq(registrations.iiitCode, iiitCode)).limit(1).for("update");
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

    const roster = await tx.select({
      rollNumber: students.rollNumber,
      name: students.name,
      gender: students.gender,
    }).from(students).where(eq(students.registrationId, lockedReg.id));
    const entries = await tx.select({
      rollNumber: students.rollNumber,
      sportId: studentEventParticipations.sportId,
      eventId: studentEventParticipations.eventId,
      gender: studentEventParticipations.gender,
      isReserve: studentEventParticipations.isReserve,
    })
      .from(studentEventParticipations)
      .innerJoin(students, eq(studentEventParticipations.studentId, students.id))
      .where(eq(studentEventParticipations.registrationId, lockedReg.id));
    const currentRosterVersion = createRosterVersion(lockedReg, roster, entries);
    if (payload.rosterVersion !== currentRosterVersion) {
      const conflict = new Error("The roster changed after this payment form loaded. Reload the registration and try again.");
      conflict.statusCode = 409;
      throw conflict;
    }

    const [outstandingDraft] = await tx.select({ iiitCode: registrationDrafts.iiitCode })
      .from(registrationDrafts).where(eq(registrationDrafts.iiitCode, iiitCode)).limit(1);
    if (outstandingDraft) {
      const conflict = new Error("Save the updated roster before submitting payment.");
      conflict.statusCode = 409;
      throw conflict;
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

    // Normally there is no draft after the precondition above. Keep cleanup
    // in the same commit so a later lifecycle change cannot leave one behind.
    await tx.delete(registrationDrafts).where(eq(registrationDrafts.iiitCode, iiitCode));

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
