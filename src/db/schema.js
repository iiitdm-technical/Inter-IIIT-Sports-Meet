import { pgTable, serial, text, varchar, integer, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

/**
 * 1. USERS TABLE
 * Exactly 1 account per participating IIIT + 1 admin account.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 254 }).unique(),
  displayName: varchar("display_name", { length: 128 }),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // 'iiit' | 'admin'
  iiitName: varchar("iiit_name", { length: 128 }),
  iiitCode: varchar("iiit_code", { length: 64 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 2. REGISTRATIONS TABLE
 * Represents an immutable submitted registration for an IIIT.
 * Unsubmitted drafts are stored separately and can be resumed on another device.
 */
export const registrations = pgTable("registrations", {
  id: serial("id").primaryKey(),
  iiitCode: varchar("iiit_code", { length: 64 }).notNull().unique().references(() => users.iiitCode, { onDelete: "cascade" }),
  iiitName: varchar("iiit_name", { length: 128 }).notNull(),
  status: varchar("status", { length: 20 }).default("payment_pending").notNull(), // 'payment_pending' | 'submitted'
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  submittedBy: varchar("submitted_by", { length: 64 }).notNull(),
  contactName: varchar("contact_name", { length: 128 }).notNull(),
  contactEmail: varchar("contact_email", { length: 128 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 32 }).notNull(),
  totalStudentsCount: integer("total_students_count").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const registrationDrafts = pgTable("registration_drafts", {
  iiitCode: varchar("iiit_code", { length: 64 }).primaryKey().references(() => users.iiitCode, { onDelete: "cascade" }),
  contactDetails: jsonb("contact_details").notNull(),
  slotsMap: jsonb("slots_map").notNull(),
  revision: integer("revision").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 3. STUDENTS TABLE
 * Normalized unique student roster per IIIT (Max 150 unique students per IIIT).
 * Identified uniquely by (iiit_code, roll_number).
 */
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
  iiitCode: varchar("iiit_code", { length: 64 }).notNull(),
  rollNumber: varchar("roll_number", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  gender: varchar("gender", { length: 1 }).notNull(), // 'M' | 'F'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("students_iiit_roll_unique").on(table.iiitCode, table.rollNumber),
  index("students_registration_idx").on(table.registrationId),
]);

/**
 * 4. STUDENT EVENT PARTICIPATIONS TABLE
 * Junction table mapping students to specific sports, events, and categories.
 */
export const studentEventParticipations = pgTable("student_event_participations", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  sportId: varchar("sport_id", { length: 64 }).notNull(),
  eventId: varchar("event_id", { length: 64 }).notNull(),
  gender: varchar("gender", { length: 10 }).notNull(), // 'M' | 'F' | 'mixed'
  isReserve: boolean("is_reserve").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull().unique().references(() => registrations.id, { onDelete: "cascade" }),
  uniqueStudentCount: integer("unique_student_count").notNull(),
  amount: integer("amount").notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(),
  transactionId: varchar("transaction_id", { length: 128 }).notNull(), // UTR / Transaction ID
  bankName: varchar("bank_name", { length: 128 }),
  paymentMode: varchar("payment_mode", { length: 20 }), // NEFT, RTGS, IMPS, UPI, OTHER
  otherPaymentMode: varchar("other_payment_mode", { length: 128 }),
  proofPathname: varchar("proof_pathname", { length: 255 }).notNull(), // Private Neon Object Storage key
  proofFileName: varchar("proof_file_name", { length: 255 }).notNull(),
  proofContentType: varchar("proof_content_type", { length: 64 }).notNull(),
  proofSize: integer("proof_size").notNull(),
  verificationStatus: varchar("verification_status", { length: 20 }).default("pending").notNull(), // 'pending' | 'verified'
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: varchar("verified_by", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 6. SESSIONS TABLE
 * Server-side login sessions. The cookie holds a random token; only its
 * HMAC is stored, so a database leak does not expose usable cookies.
 * A user may hold several sessions (one per device).
 */
export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(), // HMAC-SHA256 of the cookie token, hex
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
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
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).defaultNow().notNull(),
  count: integer("count").default(0).notNull(),
}, (table) => [
  index("rate_limits_window_idx").on(table.windowStart),
]);

/**
 * 8. AUDIT LOG TABLE
 * Security-relevant actions: logins, submissions, verifications, roster reopen.
 */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  actor: varchar("actor", { length: 254 }),
  role: varchar("role", { length: 20 }),
  action: varchar("action", { length: 64 }).notNull(),
  target: varchar("target", { length: 128 }),
  ip: varchar("ip", { length: 64 }),
  details: jsonb("details"),
}, (table) => [
  index("audit_log_at_idx").on(table.at),
  index("audit_log_action_idx").on(table.action),
]);
