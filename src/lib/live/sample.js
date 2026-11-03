import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { eventPlacings, matches } from "../../db/schema.js";
import { invalidateBoard } from "./service.js";
import { kindForSport } from "./catalog.js";

/**
 * A realistic day of sample fixtures between real IIITs, timed around "now"
 * so the board shows something live, something next and some results. Every
 * row is marked is_sample; /live shows a banner while any exists, and
 * clearing them never touches real fixtures.
 */
const HOUR = 60 * 60 * 1000;

function fixtures(now) {
  const at = (hours) => new Date(now.getTime() + hours * HOUR);
  return [
    // Completed
    { sportId: "football", gender: "M", round: "Pool", pool: "A", venue: "Main Ground", scheduledAt: at(-4), status: "completed", sideA: "iiit-kota", sideB: "iiitdm-jabalpur", scoreA: 2, scoreB: 1, winner: "iiit-kota" },
    { sportId: "football", gender: "M", round: "Pool", pool: "A", venue: "Main Ground", scheduledAt: at(-5.5), status: "completed", sideA: "iiit-tiruchirappalli", sideB: "iiit-una", scoreA: 1, scoreB: 1, winner: "draw" },
    { sportId: "football", gender: "M", round: "Pool", pool: "A", venue: "Main Ground", scheduledAt: at(-2.5), status: "completed", sideA: "iiit-kota", sideB: "iiit-una", scoreA: 3, scoreB: 0, winner: "iiit-kota" },
    { sportId: "basketball", gender: "F", round: "Pool", pool: "A", venue: "Indoor Sports Complex", scheduledAt: at(-3.5), status: "completed", sideA: "iiit-lucknow", sideB: "iiit-allahabad", scoreA: 48, scoreB: 52, winner: "iiit-allahabad" },
    { sportId: "badminton", gender: "F", round: "Final", venue: "Indoor Sports Complex", scheduledAt: at(-3), status: "completed", sideA: "iiit-kottayam", sideB: "iiit-dharwad", scoreA: 3, scoreB: 1, scoreDetail: "Matches won", winner: "iiit-kottayam" },
    { sportId: "badminton", gender: "F", round: "3rd place", venue: "Indoor Sports Complex", scheduledAt: at(-3.5), status: "completed", sideA: "iiit-guwahati", sideB: "iiit-una", scoreA: 3, scoreB: 2, scoreDetail: "Matches won", winner: "iiit-guwahati" },
    {
      sportId: "athletics", gender: "M", eventId: "100m", round: "Final", venue: "Athletic Track", scheduledAt: at(-2), status: "completed",
      placings: [
        { position: 1, iiitCode: "iiit-kota", athlete: "R. Sharma", mark: "10.94 s" },
        { position: 2, iiitCode: "iiitdm-jabalpur", athlete: "A. Verma", mark: "11.02 s" },
        { position: 3, iiitCode: "iiit-vadodara", athlete: "K. Patel", mark: "11.10 s" },
        { position: 4, iiitCode: "iiit-surat", athlete: "M. Desai", mark: "11.21 s" },
      ],
    },
    // Live
    { sportId: "volleyball", gender: "M", round: "Semi-final", venue: "Volleyball Court", scheduledAt: at(-0.75), status: "live", sideA: "iiitdm-kancheepuram", sideB: "iiitm-gwalior", scoreA: 1, scoreB: 1, scoreDetail: "25-21, 22-25, 8-6" },
    { sportId: "kabaddi", gender: "M", round: "Pool", pool: "B", venue: "Main Ground", scheduledAt: at(-0.5), status: "live", sideA: "iiit-pune", sideB: "iiit-nagpur", scoreA: 18, scoreB: 15, scoreDetail: "Second half" },
    { sportId: "cricket", gender: "M", round: "Quarter-final", venue: "Cricket Arena", scheduledAt: at(-1.5), status: "live", sideA: "iiit-sri-city", sideB: "iiitdm-kurnool", scoreA: 142, scoreB: 0, scoreDetail: "IIIT Sri City 142/6 (17.2 ov)" },
    { sportId: "aquatics", gender: "F", eventId: "50m_freestyle", round: "Final", venue: "Swimming Pool", scheduledAt: at(-0.25), status: "live" },
    // Up next
    { sportId: "table_tennis", gender: "M", round: "League", venue: "Indoor Sports Complex", scheduledAt: at(1), status: "scheduled", sideA: "iiit-bhopal", sideB: "iiit-ranchi" },
    { sportId: "chess", gender: "mixed", round: "League", venue: "Seminar Hall", scheduledAt: at(1.5), status: "scheduled", sideA: "iiit-sonepat", sideB: "iiit-manipur" },
    { sportId: "handball", gender: "F", round: "League", venue: "Main Ground", scheduledAt: at(2.5), status: "scheduled", sideA: "iiit-agartala", sideB: "iiit-raichur" },
    { sportId: "kho_kho", gender: "M", round: "League", venue: "Main Ground", scheduledAt: at(3.5), status: "scheduled", sideA: "iiit-bhagalpur", sideB: "iiit-kalyani" },
    { sportId: "athletics", gender: "mixed", eventId: "mixed_4x100m_relay", round: "Final", venue: "Athletic Track", scheduledAt: at(5), status: "scheduled" },
    { sportId: "football", gender: "M", round: "Pool", pool: "A", venue: "Main Ground", scheduledAt: at(2), status: "scheduled", sideA: "iiitdm-jabalpur", sideB: "iiit-tiruchirappalli" },
    { sportId: "basketball", gender: "F", round: "Pool", pool: "A", venue: "Indoor Sports Complex", scheduledAt: at(3), status: "scheduled", sideA: "iiit-allahabad", sideB: "iiit-kottayam" },
    { sportId: "football", gender: "M", round: "Semi-final", venue: "Main Ground", scheduledAt: at(24), status: "scheduled", sideA: "iiit-kota", sideB: "iiit-tiruchirappalli" },
  ];
}

/** Replaces any existing sample fixtures with a fresh set; returns how many were added. */
export async function seedSampleMatches(actor, now = new Date()) {
  const db = getDb();
  const list = fixtures(now);
  await db.transaction(async (tx) => {
    await tx.delete(matches).where(eq(matches.isSample, true));
    for (const item of list) {
      const { placings, ...fixture } = item;
      const kind = kindForSport(fixture.sportId);
      const [inserted] = await tx.insert(matches).values({
        ...fixture,
        kind,
        eventId: fixture.eventId || null,
        sideA: fixture.sideA || null,
        sideB: fixture.sideB || null,
        scoreA: fixture.scoreA ?? null,
        scoreB: fixture.scoreB ?? null,
        scoreDetail: fixture.scoreDetail || "",
        pool: fixture.pool || "",
        winner: fixture.winner || null,
        isSample: true,
        startedAt: fixture.status === "scheduled" ? null : fixture.scheduledAt,
        finishedAt: fixture.status === "completed" ? new Date(fixture.scheduledAt.getTime() + HOUR) : null,
        createdBy: actor,
        updatedBy: actor,
      }).$returningId();
      if (placings?.length) {
        await tx.insert(eventPlacings).values(placings.map((p) => ({ ...p, matchId: inserted.id })));
      }
    }
  });
  invalidateBoard();
  return list.length;
}
