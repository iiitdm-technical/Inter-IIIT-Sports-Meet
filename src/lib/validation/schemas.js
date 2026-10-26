import { z } from "zod";
import {
  TRAVEL_MODES, ARRIVAL_DATE_MIN, ARRIVAL_DATE_MAX, DEPARTURE_DATE_MIN, DEPARTURE_DATE_MAX, formatTravelDate,
} from "../registration/arrival.js";
import { STAFF_MIN, STAFF_MAX, isPersonalEmail } from "../registration/contingent.js";

/**
 * Normalizes roll number to uppercase trimmed string
 */
export const rollNumberSchema = z
  .string()
  .trim()
  .min(1, "Roll number is required")
  .max(64, "Roll number is too long")
  .transform((val) => val.toUpperCase());

/**
 * Normalizes name to uppercase trimmed string
 */
export const studentNameSchema = z
  .string()
  .trim()
  .min(1, "Student name is required")
  .max(128, "Student name is too long")
  .transform((val) => val.toUpperCase());

/**
 * Gender validation ('M' or 'F' only)
 */
export const genderSchema = z.enum(["M", "F"], {
  errorMap: () => ({ message: "Gender must be 'M' or 'F'" }),
});

/**
 * Auth Login Schema
 */
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required").trim(),
  password: z.string().min(1, "Password is required"),
});

/**
 * Single Student Record Schema
 */
export const studentRecordSchema = z.object({
  rollNumber: rollNumberSchema,
  name: studentNameSchema,
  gender: genderSchema,
});

/**
 * Single Participation Entry Schema
 */
export const eventEntrySchema = z.object({
  sportId: z.string().min(1, "Sport ID is required").trim().toLowerCase(),
  eventId: z.string().min(1, "Event ID is required").trim().toLowerCase(),
  gender: z.enum(["M", "F", "mixed"], {
    errorMap: () => ({ message: "Event gender must be 'M', 'F', or 'mixed'" }),
  }),
  rollNumber: rollNumberSchema,
  isReserve: z.boolean().default(false),
});

/**
 * Contact Details Schema
 */
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const inRange = (value, min, max) => isoDate.test(value) && value >= min && value <= max;
const PHONE = /^\+?[0-9()\-\s]{6,32}$/;

/** Name, phone and institute email of one sports secretary ("Boys" or "Girls"). */
function secretaryFields(prefix, label) {
  return {
    [`${prefix}SecretaryName`]: z.string({ error: `${label} sports secretary's name is required` }).trim()
      .min(1, `${label} sports secretary's name is required`).max(128),
    [`${prefix}SecretaryPhone`]: z.string({ error: `${label} sports secretary's phone is required` }).trim()
      .regex(PHONE, `${label} sports secretary's phone number is required`),
    [`${prefix}SecretaryEmail`]: z.string({ error: `${label} sports secretary's institute email is required` }).trim()
      .pipe(z.email(`${label} sports secretary's institute email is required`).max(128))
      .refine((email) => !isPersonalEmail(email), `${label} sports secretary's email must be the institute email, not a personal one`),
  };
}

export const contactDetailsSchema = z.object({
  contactName: z.string().trim().min(1, "Contact person name is required").max(128),
  contactEmail: z.email("Invalid contact email address").max(128),
  contactPhone: z.string().trim().regex(PHONE, "Valid contact phone is required"),
  arrivalDate: z.string({ error: "Arrival date is required" }).trim().min(1, "Arrival date is required")
    .refine((value) => value === "" || inRange(value, ARRIVAL_DATE_MIN, ARRIVAL_DATE_MAX),
      `Arrival date must be between ${formatTravelDate(ARRIVAL_DATE_MIN)} and ${formatTravelDate(ARRIVAL_DATE_MAX)}`),
  arrivalTime: z.string({ error: "Arrival time is required" }).trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Arrival time is required"),
  travelMode: z.enum(TRAVEL_MODES, { error: "Choose the mode of travel" }),
  arrivalPoint: z.string().trim().max(128, "Arriving at is too long").optional().default(""),
  departureDate: z.string({ error: "Exit date is required" }).trim().min(1, "Exit date is required")
    .refine((value) => value === "" || inRange(value, DEPARTURE_DATE_MIN, DEPARTURE_DATE_MAX),
      `Exit date must be between ${formatTravelDate(DEPARTURE_DATE_MIN)} and ${formatTravelDate(DEPARTURE_DATE_MAX)}`),
  ...secretaryFields("boys", "Boys'"),
  ...secretaryFields("girls", "Girls'"),
  // Typed into a number field, so it may arrive as a string.
  staffCount: z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z.number({ error: "Number of accompanying staff is required" }).int("Number of accompanying staff must be a whole number")
      .min(STAFF_MIN, `At least ${STAFF_MIN} accompanying staff member is required`)
      .max(STAFF_MAX, `At most ${STAFF_MAX} accompanying staff are allowed (2 officials and 1 supporting staff)`),
  ),
  notes: z.string().trim().max(1000, "Other notes are too long").optional().default(""),
}).superRefine((details, ctx) => {
  if (details.departureDate && details.arrivalDate && details.departureDate < details.arrivalDate) {
    ctx.addIssue({ code: "custom", path: ["departureDate"], message: "Exit date cannot be before the arrival date" });
  }
  if (details.travelMode === "Other" && !details.notes) {
    ctx.addIssue({ code: "custom", path: ["notes"], message: "Describe the mode of travel in Other notes" });
  }
});

/**
 * Payment Details Schema
 */
const IST_OFFSET_MS = 330 * 60 * 1000;
// Fees for the 2026 meet cannot have been paid before 2026; this catches typos such as 2002.
const EARLIEST_PAYMENT_DATE = "2026-01-01";

export const paymentDetailsSchema = z.object({
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Transaction date must be in YYYY-MM-DD format").refine((val) => {
    const date = new Date(val);
    if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== val) return false;
    // Compare against today's date in India, not the server's clock: a
    // payment made just after midnight IST is still "yesterday" in UTC.
    const todayInIndia = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
    return val >= EARLIEST_PAYMENT_DATE && val <= todayInIndia;
  }, "Transaction date cannot be in the future or invalid"),
  transactionId: z.string().trim().min(5, "Transaction ID/UTR must be at least 5 characters").max(64),
  bankName: z.string().max(128).optional().nullable(),
  paymentMode: z.enum(["NEFT", "RTGS", "IMPS", "UPI", "OTHER"], {
    errorMap: () => ({ message: "Payment Mode must be NEFT, RTGS, IMPS, UPI, or OTHER" }),
  }),
  otherPaymentMode: z.string().max(128).optional().nullable(),
  proofPathname: z.string().min(5, "Payment proof is required"),
}).refine((data) => {
  if (data.paymentMode === "OTHER") {
    return data.otherPaymentMode && data.otherPaymentMode.trim().length > 0;
  }
  return true;
}, {
  message: "Other Payment Mode is required when Payment Mode is OTHER",
  path: ["otherPaymentMode"]
});

/**
 * Full Registration Submission Payload Schema
 */
export const registrationSubmitSchema = z.object({
  contactDetails: contactDetailsSchema,
  students: z.array(studentRecordSchema).min(1, "At least one student must be registered").max(150),
  entries: z.array(eventEntrySchema).min(1, "At least one event entry must be submitted").max(1200),
});

/**
 * Payment Submission Payload Schema
 */
export const paymentSubmitSchema = z.object({
  paymentDetails: paymentDetailsSchema,
});
