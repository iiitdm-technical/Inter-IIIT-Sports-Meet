import { eq, and, sql, ilike, inArray } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { registrations, students, studentEventParticipations, paymentTransactions } from "../../db/schema.js";
import { getSportConfig } from "../sports/config.js";

/**
 * Escape a field for RFC 4180 CSV
 */
export function escapeCsvField(val) {
  if (val === null || val === undefined) return "";
  const raw = String(val);
  const str = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format an array of rows into a CSV string
 */
export function formatCsv(headers, rows) {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

/**
 * Generate CSV for a single IIIT's submitted registration
 */
export async function generateIIITRegistrationCSV(iiitCode) {
  const db = getDb();

  const entries = await db
    .select({
      iiitName: registrations.iiitName,
      rollNumber: students.rollNumber,
      studentName: students.name,
      studentGender: students.gender,
      sportId: studentEventParticipations.sportId,
      eventId: studentEventParticipations.eventId,
      eventGender: studentEventParticipations.gender,
      isReserve: studentEventParticipations.isReserve,
      submittedAt: registrations.submittedAt,
      status: registrations.status,
      paymentMode: paymentTransactions.paymentMode,
      otherPaymentMode: paymentTransactions.otherPaymentMode,
    })
    .from(studentEventParticipations)
    .innerJoin(students, eq(studentEventParticipations.studentId, students.id))
    .innerJoin(registrations, eq(studentEventParticipations.registrationId, registrations.id))
    .leftJoin(paymentTransactions, eq(registrations.id, paymentTransactions.registrationId))
    .where(eq(registrations.iiitCode, iiitCode))
    .orderBy(students.rollNumber, studentEventParticipations.sportId);

  const headers = [
    "IIIT Name",
    "Roll Number",
    "Student Name",
    "Student Gender",
    "Sport",
    "Event / Discipline",
    "Event Category",
    "Slot Type",
    "Submission Date",
    "Registration Status",
    "Payment Mode",
    "Other Payment Mode",
  ];

  const rows = entries.map((entry) => {
    const sportConfig = getSportConfig(entry.sportId);
    const sportName = sportConfig?.name || entry.sportId;

    let eventName = entry.eventId;
    if (sportConfig?.events?.[entry.eventGender]) {
      const ev = sportConfig.events[entry.eventGender].find(
        (e) => e.id === entry.eventId
      );
      if (ev) eventName = ev.name;
    }

    return [
      entry.iiitName,
      entry.rollNumber,
      entry.studentName,
      entry.studentGender,
      sportName,
      eventName,
      entry.eventGender === "M" ? "Men" : entry.eventGender === "F" ? "Women" : "Mixed/Open",
      entry.isReserve ? "Reserve" : "Main",
      entry.submittedAt ? new Date(entry.submittedAt).toISOString() : "",
      entry.status,
      entry.paymentMode || "",
      entry.otherPaymentMode || "",
    ];
  });

  return formatCsv(headers, rows);
}

/**
 * Generate Master CSV for Admin (All or Filtered)
 */
export async function generateAdminMasterCSV(filters = {}) {
  const db = getDb();

  const conditions = [inArray(registrations.status, ["payment_pending", "submitted"])];

  if (filters.iiit) {
    conditions.push(
      sql`(${registrations.iiitCode} = ${filters.iiit} OR ${registrations.iiitName} ILIKE ${`%${filters.iiit}%`})`
    );
  }
  if (filters.sport) {
    conditions.push(eq(studentEventParticipations.sportId, filters.sport.toLowerCase()));
  }
  if (filters.event) {
    conditions.push(eq(studentEventParticipations.eventId, filters.event.toLowerCase()));
  }
  if (filters.gender) {
    conditions.push(eq(students.gender, filters.gender.toUpperCase()));
  }
  if (filters.name) {
    conditions.push(ilike(students.name, `%${filters.name.trim()}%`));
  }
  if (filters.rollNumber) {
    conditions.push(ilike(students.rollNumber, `%${filters.rollNumber.trim()}%`));
  }

  const entries = await db
    .select({
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
      paymentMode: paymentTransactions.paymentMode,
      otherPaymentMode: paymentTransactions.otherPaymentMode,
    })
    .from(studentEventParticipations)
    .innerJoin(students, eq(studentEventParticipations.studentId, students.id))
    .innerJoin(registrations, eq(studentEventParticipations.registrationId, registrations.id))
    .leftJoin(paymentTransactions, eq(registrations.id, paymentTransactions.registrationId))
    .where(and(...conditions))
    .orderBy(registrations.iiitName, students.rollNumber, studentEventParticipations.sportId);

  const headers = [
    "IIIT Code",
    "IIIT Name",
    "Roll Number",
    "Student Name",
    "Gender",
    "Sport",
    "Event",
    "Event Category",
    "Slot Type",
    "Submission Date",
    "Payment Mode",
    "Other Payment Mode",
  ];

  const rows = entries.map((entry) => {
    const sportConfig = getSportConfig(entry.sportId);
    const sportName = sportConfig?.name || entry.sportId;

    let eventName = entry.eventId;
    if (sportConfig?.events?.[entry.eventGender]) {
      const ev = sportConfig.events[entry.eventGender].find(
        (e) => e.id === entry.eventId
      );
      if (ev) eventName = ev.name;
    }

    return [
      entry.iiitCode,
      entry.iiitName,
      entry.rollNumber,
      entry.studentName,
      entry.studentGender,
      sportName,
      eventName,
      entry.eventGender === "M" ? "Men" : entry.eventGender === "F" ? "Women" : "Mixed/Open",
      entry.isReserve ? "Reserve" : "Main",
      entry.submittedAt ? new Date(entry.submittedAt).toISOString() : "",
      entry.paymentMode || "",
      entry.otherPaymentMode || "",
    ];
  });

  return formatCsv(headers, rows);
}
