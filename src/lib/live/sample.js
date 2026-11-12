import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { eventPlacings, matches, tournaments } from "../../db/schema.js";
import { invalidateBoard, updateMatch } from "./service.js";
import { LIVE_IIITS, kindForSport } from "./catalog.js";
import { buildBracket, createTournament, getTournament, scheduleMatches, setTeams, syncPoolMatches } from "./tournaments.js";
import { suggestSlots } from "./bracket-seeding.js";

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
  const tournamentMatches = await seedSampleTournament(actor, now);
  return list.length + tournamentMatches;
}

/**
 * A sample football tournament: 20 IIITs in 4 pools of 5, every pool match
 * played, the quarter-finals played, one semi-final live. Returns how many
 * matches it has.
 */
async function seedSampleTournament(actor, now) {
  await getDb().delete(tournaments).where(eq(tournaments.isSample, true));
  const scope = { all: true, sports: [] };
  const id = await createTournament({
    sportId: "football", gender: "M", name: "Sample draw",
    pointsWin: 3, pointsDraw: 1, pointsLoss: 0, allowDraws: true, qualifyPerPool: 2, thirdPlace: true,
  }, actor, { isSample: true });
  let detail = await getTournament(id);
  const codes = LIVE_IIITS.slice(0, 20).map((iiit) => iiit.code);
  await setTeams(id, { version: detail.tournament.version, teams: codes.map((code, i) => ({ iiitCode: code, pool: "ABCD"[i % 4] })) }, actor);
  await syncPoolMatches(id, { apply: true }, actor);
  await scheduleMatches(id, {
    start: new Date(now.getTime() - 30 * HOUR).toISOString(), minutesPerMatch: 60, venues: ["Main Ground", "Ground 2"],
    stage: "all", onlyUnscheduled: true,
  }, actor);

  // Scores from a fixed pattern, so the sample looks the same every time.
  let n = 0;
  const play = async (match, { draws = true } = {}) => {
    n += 1;
    const started = await updateMatch(match.id, { action: "start", version: match.version }, { actor, scope, isSuper: true });
    const a = (n * 7) % 4;
    let b = (n * 5) % 3;
    if (!draws && a === b) b = (b + 1) % 4;
    const winner = a === b ? "draw" : a > b ? match.sideA.code : match.sideB.code;
    await updateMatch(match.id, { action: "finish", version: started.version, winner, scoreA: a, scoreB: b }, { actor, scope, isSuper: true });
  };
  detail = await getTournament(id);
  for (const pool of detail.pools) for (const match of pool.matches) await play(match);

  detail = await getTournament(id);
  await buildBracket(id, { size: 8, thirdPlace: true, slots: suggestSlots(detail.pools, 2, 8) }, actor);
  detail = await getTournament(id);
  for (const match of detail.knockout.rounds[0].matches) await play(match, { draws: false });
  detail = await getTournament(id);
  const semi = detail.knockout.rounds[1].matches[0];
  if (semi?.sideA && semi?.sideB) {
    const started = await updateMatch(semi.id, { action: "start", version: semi.version }, { actor, scope, isSuper: true });
    await updateMatch(semi.id, { action: "score", version: started.version, scoreA: 1, scoreB: 0, scoreDetail: "First half" }, { actor, scope, isSuper: true });
  }
  detail = await getTournament(id);
  return detail.matches.length;
}
