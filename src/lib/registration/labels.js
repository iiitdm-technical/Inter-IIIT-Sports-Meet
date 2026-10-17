import { GLOBAL_RULES, getSportConfig } from "../sports/config.js";

export const SPORTS_CELL_EMAIL = "sports@iiitdm.ac.in";

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

export function getRegistrationFee(studentCount) {
  return studentCount * GLOBAL_RULES.REGISTRATION_FEE_PER_STUDENT;
}

export function formatRupees(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
}
