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

// Railway stations: every stop on the Beach-Tambaram-Chengalpattu suburban
// line in order (Vandalur, Urapakkam and Guduvancheri are nearest the
// campus), then the other main Chennai stations. The form offers them as
// searchable suggestions; a contingent arriving elsewhere can type its station.
export const RAILWAY_STATIONS = [
  "Chennai Beach (MSB)",
  "Chennai Fort",
  "Chennai Park",
  "Chennai Egmore (MS)",
  "Chetpet",
  "Nungambakkam",
  "Kodambakkam",
  "Mambalam (MBM)",
  "Saidapet",
  "Guindy (GDY)",
  "St. Thomas Mount (STM)",
  "Pazhavanthangal",
  "Meenambakkam",
  "Tirusulam (Chennai Airport)",
  "Pallavaram",
  "Chromepet",
  "Tambaram Sanatorium",
  "Tambaram (TBM)",
  "Perungalathur",
  "Vandalur",
  "Urapakkam",
  "Guduvancheri",
  "Potheri",
  "Kattankulathur",
  "Maraimalai Nagar",
  "Singaperumal Koil",
  "Paranur",
  "Chengalpattu Junction (CGL)",
  "Chennai Central (MAS)",
  "Chennai Park Town",
  "Perambur",
  "Velachery",
  "Avadi",
  "Tiruvallur",
  "Arakkonam Junction (AJJ)",
  "Kanchipuram",
];

export const BUS_TERMINALS = [
  "Kilambakkam Bus Terminus (KCBT)",
  "Chennai Mofussil Bus Terminus (CMBT), Koyambedu",
];

export const CHENNAI_AIRPORT = "Chennai International Airport (MAA)";

/** Arriving-at value to keep when the mode of travel changes. */
export function arrivalPointForMode(mode, current = "") {
  if (mode === "Flight") return CHENNAI_AIRPORT;
  if (mode === "Bus") return BUS_TERMINALS.includes(current) ? current : "";
  if (mode === "Train") return current && !BUS_TERMINALS.includes(current) && current !== CHENNAI_AIRPORT ? current : "";
  return current === CHENNAI_AIRPORT || BUS_TERMINALS.includes(current) ? "" : current;
}

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
