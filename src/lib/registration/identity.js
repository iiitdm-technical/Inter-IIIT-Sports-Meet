/**
 * How a student is identified across slots. The form, the business rules and
 * the server must agree, or one student could be counted (and charged) twice.
 */

/** "  2023 bcs 001 " -> "2023BCS001": case and every space are ignored. */
export function normalizeRoll(value) {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

/** "  ravi   kumar " -> "RAVI KUMAR": case and repeated spaces are ignored. */
export function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}
