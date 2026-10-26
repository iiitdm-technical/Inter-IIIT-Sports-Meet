/**
 * Contingent travel details collected with the contact details. Shared by
 * the form, the validation schema, the admin view and the CSV export.
 * The meet runs 19 to 23 December 2026.
 */
export const TRAVEL_MODES = ["Train", "Bus", "Flight", "Own vehicle", "Other"];

export const ARRIVAL_DATE_MIN = "2026-12-15";
export const ARRIVAL_DATE_MAX = "2026-12-23";
export const DEPARTURE_DATE_MIN = "2026-12-19";
export const DEPARTURE_DATE_MAX = "2026-12-26";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-18" -> "18 Dec 2026"; anything else is returned unchanged. */
export function formatTravelDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return value || "";
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** One line such as "18 Dec 2026, 07:30 · Train · Chennai Central". */
export function formatArrival({ arrivalDate, arrivalTime, travelMode, arrivalPoint } = {}) {
  if (!arrivalDate && !arrivalTime && !travelMode) return "";
  const when = [formatTravelDate(arrivalDate), arrivalTime].filter(Boolean).join(", ");
  return [when, travelMode, arrivalPoint].filter(Boolean).join(" · ");
}
