import { GLOBAL_RULES, getSportConfig } from "../sports/config.js";

export const SPORTS_CELL_EMAIL = "sports@iiitdm.ac.in";

/** Largest payment proof accepted, in bytes (2 MB). */
export const MAX_PROOF_BYTES = 2 * 1024 * 1024;
export const MAX_PROOF_LABEL = "2 MB";

const CATEGORY_LABELS = { M: "Men", F: "Women", mixed: "Combined" };

export function getCategoryLabel(gender) {
  return CATEGORY_LABELS[gender] || gender;
}

export function getSportName(sportId) {
  return getSportConfig(sportId)?.name || sportId;
}

/**
 * Human-readable event name, e.g. "Squad" for team sports or "100 M".
 */
export function getEventName(sportId, eventId, gender) {
  if (eventId === "team") return "Squad";
  const sport = getSportConfig(sportId);
  const genders = gender && sport?.events?.[gender] ? [gender] : Object.keys(sport?.events || {});
  for (const g of genders) {
    const event = sport.events[g]?.find((item) => item.id === eventId);
    if (event) return event.name;
  }
  return eventId;
}

export function getRegistrationFeeBreakdown(studentCount) {
  const registrationFee = studentCount * GLOBAL_RULES.REGISTRATION_FEE_PER_STUDENT;
  const gst = Math.round(registrationFee * GLOBAL_RULES.REGISTRATION_GST_PERCENT / 100);
  const registrationWithGst = registrationFee + gst;
  const cautionDeposit = GLOBAL_RULES.REFUNDABLE_CAUTION_DEPOSIT;
  return { registrationFee, gst, registrationWithGst, cautionDeposit, total: registrationWithGst + cautionDeposit };
}

export function getRegistrationFee(studentCount) {
  return getRegistrationFeeBreakdown(studentCount).total;
}

export function formatRupees(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
}
