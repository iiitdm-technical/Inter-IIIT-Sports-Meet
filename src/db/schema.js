import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// MySQL DATETIME has no timezone. Every value is stored as UTC; the mysql2
// pool pins its session timezone to UTC and maps JavaScript Dates as UTC too.
const utcDateTime = (name) => datetime(name, { mode: "date", fsp: 6 });
const currentUtcDateTime = (name) => utcDateTime(name).default(sql`CURRENT_TIMESTAMP(6)`);

/**
 * MySQL's Drizzle table builder does not expose table-level collation options.
 * The baseline migration therefore explicitly sets utf8mb4_0900_bin on every
 * table. This collation is case-sensitive and NO PAD, so distinct casing and
 * trailing spaces remain significant in unique identifiers.
 */

/**
 * 1. USERS TABLE
 * Exactly 1 account per participating IIIT + 1 admin account.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 254 }).unique(),
  displayName: varchar("display_name", { length: 128 }),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // 'iiit' | 'admin'
  iiitName: varchar("iiit_name", { length: 128 }),
  iiitCode: varchar("iiit_code", { length: 64 }).unique(),
  createdAt: currentUtcDateTime("created_at").notNull(),
  updatedAt: currentUtcDateTime("updated_at").notNull(),
});

/**
 * 2. REGISTRATIONS TABLE
 * Represents a saved IIIT roster; immutable after payment is submitted.
 * Unsubmitted drafts are stored separately and can be resumed on another device.
 */
export const registrations = mysqlTable("registrations", {
  id: int("id").autoincrement().primaryKey(),
  iiitCode: varchar("iiit_code", { length: 64 }).notNull().unique().references(() => users.iiitCode, { onDelete: "cascade" }),
  iiitName: varchar("iiit_name", { length: 128 }).notNull(),
  status: varchar("status", { length: 20 }).default("payment_pending").notNull(), // 'payment_pending' | 'submitted'
  submittedAt: currentUtcDateTime("submitted_at").notNull(),
  submittedBy: varchar("submitted_by", { length: 64 }).notNull(),
  contactName: varchar("contact_name", { length: 128 }).notNull(),
  contactEmail: varchar("contact_email", { length: 128 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 32 }).notNull(),
  totalStudentsCount: int("total_students_count").default(0).notNull(),
  // Contingent travel (see src/lib/registration/arrival.js). Dates are
  // YYYY-MM-DD and the time HH:MM, local time in India.
  arrivalDate: varchar("arrival_date", { length: 10 }),
  arrivalTime: varchar("arrival_time", { length: 5 }),
  travelMode: varchar("travel_mode", { length: 32 }),
  arrivalPoint: varchar("arrival_point", { length: 128 }),
  departureDate: varchar("departure_date", { length: 10 }),
  // Contingent: the IIIT's sports secretaries, students by gender (counted
  // from the roster at each save) and accompanying staff.
  boysSecretaryName: varchar("boys_secretary_name", { length: 128 }),
  boysSecretaryPhone: varchar("boys_secretary_phone", { length: 32 }),
  boysSecretaryEmail: varchar("boys_secretary_email", { length: 128 }),
  girlsSecretaryName: varchar("girls_secretary_name", { length: 128 }),
  girlsSecretaryPhone: varchar("girls_secretary_phone", { length: 32 }),
  girlsSecretaryEmail: varchar("girls_secretary_email", { length: 128 }),
  boysCount: int("boys_count"),
  girlsCount: int("girls_count"),
  staffCount: int("staff_count"),
  notes: text("notes"),
  createdAt: currentUtcDateTime("created_at").notNull(),
  updatedAt: currentUtcDateTime("updated_at").notNull(),
});

export const registrationDrafts = mysqlTable("registration_drafts", {
  iiitCode: varchar("iiit_code", { length: 64 }).primaryKey().references(() => users.iiitCode, { onDelete: "cascade" }),
  contactDetails: json("contact_details").notNull(),
  slotsMap: json("slots_map").notNull(),
  revision: int("revision").default(1).notNull(),
  updatedAt: currentUtcDateTime("updated_at").notNull(),
});

/**
 * 3. STUDENTS TABLE
 * Normalized unique student roster per IIIT (Max 150 unique students per IIIT).
 * Identified uniquely by (iiit_code, roll_number).
 */
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  registrationId: int("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
  iiitCode: varchar("iiit_code", { length: 64 }).notNull(),
  rollNumber: varchar("roll_number", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  gender: varchar("gender", { length: 1 }).notNull(), // 'M' | 'F'
  createdAt: currentUtcDateTime("created_at").notNull(),
  updatedAt: currentUtcDateTime("updated_at").notNull(),
}, (table) => [
  uniqueIndex("students_iiit_roll_unique").on(table.iiitCode, table.rollNumber),
  index("students_registration_idx").on(table.registrationId),
]);

/**
 * 4. STUDENT EVENT PARTICIPATIONS TABLE
 * Junction table mapping students to specific sports, events, and categories.
 */
export const studentEventParticipations = mysqlTable("student_event_participations", {
  id: int("id").autoincrement().primaryKey(),
  registrationId: int("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
  studentId: int("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  sportId: varchar("sport_id", { length: 64 }).notNull(),
  eventId: varchar("event_id", { length: 64 }).notNull(),
  gender: varchar("gender", { length: 10 }).notNull(), // 'M' | 'F' | 'mixed'
  isReserve: boolean("is_reserve").default(false).notNull(),
  createdAt: currentUtcDateTime("created_at").notNull(),
}, (table) => [
  uniqueIndex("student_participation_unique").on(table.studentId, table.sportId, table.eventId),
  index("participation_registration_idx").on(table.registrationId),
  index("participation_sport_event_idx").on(table.sportId, table.eventId),
  index("participation_student_idx").on(table.studentId),
]);

/**
 * 5. PAYMENT TRANSACTIONS TABLE
 * Represents the payment proof and transaction details for a registration.
 * One-to-one relationship with the registrations table.
 */
export const paymentTransactions = mysqlTable("payment_transactions", {
  id: int("id").autoincrement().primaryKey(),
  registrationId: int("registration_id").notNull().unique().references(() => registrations.id, { onDelete: "cascade" }),
  uniqueStudentCount: int("unique_student_count").notNull(),
  amount: int("amount").notNull(),
  transactionDate: utcDateTime("transaction_date").notNull(),
  transactionId: varchar("transaction_id", { length: 128 }).notNull(), // UTR / Transaction ID
  bankName: varchar("bank_name", { length: 128 }),
  paymentMode: varchar("payment_mode", { length: 20 }), // NEFT, RTGS, IMPS, UPI, OTHER
  otherPaymentMode: varchar("other_payment_mode", { length: 128 }),
  proofPathname: varchar("proof_pathname", { length: 255 }).notNull(), // Private Neon Object Storage key
  proofFileName: varchar("proof_file_name", { length: 255 }).notNull(),
  proofContentType: varchar("proof_content_type", { length: 64 }).notNull(),
  proofSize: int("proof_size").notNull(),
  verificationStatus: varchar("verification_status", { length: 20 }).default("pending").notNull(), // 'pending' | 'verified'
  verifiedAt: utcDateTime("verified_at"),
  verifiedBy: varchar("verified_by", { length: 64 }),
  createdAt: currentUtcDateTime("created_at").notNull(),
});

/**
 * 6. SESSIONS TABLE
 * Server-side login sessions. The cookie holds a random token; only its
 * HMAC is stored, so a database leak does not expose usable cookies.
 * A user may hold several sessions (one per device).
 */
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(), // HMAC-SHA256 of the cookie token, hex
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: currentUtcDateTime("created_at").notNull(),
  lastSeenAt: currentUtcDateTime("last_seen_at").notNull(),
  expiresAt: utcDateTime("expires_at").notNull(),
  userAgent: varchar("user_agent", { length: 256 }),
  ip: varchar("ip", { length: 64 }),
}, (table) => [
  index("sessions_user_idx").on(table.userId),
  index("sessions_expires_idx").on(table.expiresAt),
]);

/**
 * 7. RATE LIMITS TABLE
 * Fixed-window counters shared by every app instance.
 */
export const rateLimits = mysqlTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  windowStart: currentUtcDateTime("window_start").notNull(),
  count: int("count").default(0).notNull(),
}, (table) => [
  index("rate_limits_window_idx").on(table.windowStart),
]);

/**
 * 8. AUDIT LOG TABLE
 * Security-relevant actions: logins, submissions, verifications, roster reopen.
 */
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  at: currentUtcDateTime("at").notNull(),
  actor: varchar("actor", { length: 254 }),
  role: varchar("role", { length: 20 }),
  action: varchar("action", { length: 64 }).notNull(),
  target: varchar("target", { length: 128 }),
  ip: varchar("ip", { length: 64 }),
  details: json("details"),
}, (table) => [
  index("audit_log_at_idx").on(table.at),
  index("audit_log_action_idx").on(table.action),
]);
