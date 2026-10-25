import { httpError } from "../security/request.js";

/**
 * Optional registration deadline from REGISTRATION_CLOSES_AT (ISO 8601,
 * e.g. 2026-12-05T23:59:59+05:30). After it, drafts can no longer be saved
 * or locked. Payment for an already locked roster is still accepted.
 */
export function getRegistrationClosesAt() {
  const raw = process.env.REGISTRATION_CLOSES_AT;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function assertRegistrationOpen() {
  const closesAt = getRegistrationClosesAt();
  if (closesAt && Date.now() > closesAt.getTime()) {
    throw httpError(403, `Registration closed on ${closesAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST. Contact the Sports Cell for help.`);
  }
}

/** True when a database error is a unique-constraint violation. */
export function isUniqueViolation(error) {
  const visited = new Set();
  let current = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    if (
      current.code === "23505" ||
      current.code === "ER_DUP_ENTRY" ||
      current.code === 1062 ||
      Number(current.errno) === 1062
    ) {
      return true;
    }
    current = current.cause;
  }

  return false;
}
