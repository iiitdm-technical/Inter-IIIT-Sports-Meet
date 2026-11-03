import { getAllSportsList, getSportConfig } from "../sports/config.js";
import { iiits } from "../../data/iiits.js";

/**
 * Shared vocabulary for the live results board (see LIVE_RESULTS_PLAN.md):
 * which sports exist, whether a sport is played side-vs-side or as an event
 * with placings, the IIITs taking part, and the rounds a fixture can be in.
 */

export const MATCH_STATUSES = ["scheduled", "live", "completed", "postponed", "cancelled"];
export const MATCH_KINDS = ["versus", "event"];
export const COORDINATOR_GENDERS = ["all", "M", "F", "mixed"];

// "Final" and "3rd place" decide medals; the rest are earlier stages.
export const ROUNDS = ["League", "Pool", "Round of 16", "Quarter-final", "Semi-final", "3rd place", "Final", "Heat"];
export const MEDAL_ROUNDS = { final: "Final", bronze: "3rd place" };

// Group stage: pools A–H and the points a pool table awards.
// Placeholder until the Sports Board confirms the rules (LIVE_RESULTS_PLAN.md, open question 2).
export const POOLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const POOL_POINTS = { win: 3, draw: 1, loss: 0, confirmed: false };

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** The participating IIITs, with the same codes their accounts use. */
export const LIVE_IIITS = iiits.map(({ name, logo }) => ({ code: slugify(name), name, logo }));
const IIIT_BY_CODE = new Map(LIVE_IIITS.map((iiit) => [iiit.code, iiit]));

export function isIiitCode(code) {
  return IIIT_BY_CODE.has(code);
}

export function iiitName(code) {
  return IIIT_BY_CODE.get(code)?.name || code || "";
}

/** Team sports are played side vs side; athletics, aquatics and powerlifting as events. */
export function kindForSport(sportId) {
  const type = getSportConfig(sportId)?.type;
  return type === "event_based" || type === "weight_category_based" ? "event" : "versus";
}

/** Sports and categories for forms and filters. */
export function liveSports() {
  return getAllSportsList().map((sport) => ({
    id: sport.id,
    name: sport.name,
    kind: kindForSport(sport.id),
    genders: sport.genders,
    events: sport.events
      ? Object.fromEntries(Object.entries(sport.events).map(([gender, list]) => [gender, list.map((event) => ({ id: event.id, name: event.name }))]))
      : null,
  }));
}

export function isValidSportGender(sportId, gender) {
  const sport = getSportConfig(sportId);
  return Boolean(sport && sport.genders.includes(gender));
}

export function isValidEvent(sportId, gender, eventId) {
  const sport = getSportConfig(sportId);
  return Boolean(sport?.events?.[gender]?.some((event) => event.id === eventId));
}

export function eventName(sportId, gender, eventId) {
  const event = getSportConfig(sportId)?.events?.[gender]?.find((item) => item.id === eventId);
  return event?.name || eventId || "";
}
