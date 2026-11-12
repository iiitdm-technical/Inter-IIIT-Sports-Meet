import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { matchChanges, matches, tournamentTeams, tournaments } from "../../db/schema.js";
import { httpError } from "../security/request.js";
import { getSportName } from "../registration/labels.js";
import {
  BRACKET_SIZES, THIRD_PLACE_SLOT, iiitName, isIiitCode, isValidSportGender, kindForSport, knockoutRoundName, knockoutSlotPrefix,
} from "./catalog.js";
import { advanceFrom, invalidateBoard, onInvalidate, rankPool, tournamentPoints, withPlacings } from "./service.js";

/**
 * Tournaments: pools (every team plays every other team in its pool), pool
 * standings with the tournament's own points, and a knockout bracket the
 * Sports SAC fills by hand. Pool and knockout matches are ordinary rows in
 * `matches`, so scoring, the live board and the medal tally work unchanged.
 * Everything the system does here (generating matches, moving winners on,
 * scheduling) can be changed by hand afterwards.
 */

function affectedRows(result) {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}

const UNPLAYED = ["scheduled", "postponed"];
const pairKey = (a, b) => [a, b].sort().join("|");

// ---------------------------------------------------------------------------
// Pure helpers (also used by tests)

/**
 * Round-robin order for one pool (circle method): every team meets every
 * other once, spread over rounds so each team plays at most once per round.
 * Returns [{ round, sideA, sideB }].
 */
export function roundRobin(codes) {
  const list = [...codes];
  if (list.length < 2) return [];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const result = [];
  let arr = list.slice();
  for (let round = 0; round < n - 1; round += 1) {
    for (let i = 0; i < n / 2; i += 1) {
      let a = arr[i];
      let b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      if (i === 0 && round % 2 === 1) [a, b] = [b, a]; // the fixed team alternates sides
      result.push({ round, sideA: a, sideB: b });
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return result;
}

/** "QF2" → { teams: 8, index: 2 }; "F" → { teams: 2, index: 1 }; "3P" → { third: true }. */
export function parseSlot(slot) {
  if (!slot) return null;
  if (slot === THIRD_PLACE_SLOT) return { third: true, teams: 2, index: 1 };
  if (slot === "F") return { teams: 2, index: 1 };
  let match = /^SF(\d+)$/.exec(slot);
  if (match) return { teams: 4, index: Number(match[1]) };
  match = /^QF(\d+)$/.exec(slot);
  if (match) return { teams: 8, index: Number(match[1]) };
  match = /^R(\d+)-(\d+)$/.exec(slot);
  if (match) return { teams: Number(match[1]), index: Number(match[2]) };
  return null;
}

export function slotName(teams, index) {
  if (teams === 2) return "F";
  const prefix = knockoutSlotPrefix(teams);
  return `${prefix}${index}`;
}

/**
 * The knockout layout for a bracket of `size` teams: one entry per match
 * with its slot, round and where the winner (and a semi-final loser) goes.
 */
export function bracketLayout(size, thirdPlace) {
  if (!BRACKET_SIZES.includes(size)) throw httpError(400, "Choose a bracket size");
  const layout = [];
  for (let teams = size; teams >= 2; teams /= 2) {
    for (let index = 1; index <= teams / 2; index += 1) {
      const entry = { slot: slotName(teams, index), round: knockoutRoundName(teams), teams, index, next: null, nextSide: null, loserNext: null, loserNextSide: null };
      if (teams > 2) {
        entry.next = slotName(teams / 2, Math.ceil(index / 2));
        entry.nextSide = index % 2 === 1 ? "A" : "B";
      }
      if (teams === 4 && thirdPlace) {
        entry.loserNext = THIRD_PLACE_SLOT;
        entry.loserNextSide = index === 1 ? "A" : "B";
      }
      layout.push(entry);
    }
  }
  if (thirdPlace && size >= 4) {
    layout.push({ slot: THIRD_PLACE_SLOT, round: "3rd place", teams: 2, index: 1, third: true, next: null, nextSide: null, loserNext: null, loserNextSide: null });
  }
  return layout;
}

/** Pool matches in play order: round by round, pools side by side. */
export function poolPlayOrder(teamsByPool) {
  const order = new Map();
  for (const [pool, codes] of teamsByPool) {
    roundRobin(codes).forEach((item, index) => order.set(pairKey(item.sideA, item.sideB), { pool, round: item.round, index }));
  }
  return order;
}

const KNOCKOUT_ORDER = (slot) => {
  const parsed = parseSlot(slot);
  if (!parsed) return [999, 0];
  // Bigger rounds first; the 3rd-place match just before the final.
  if (parsed.third) return [1000 - 2.5, 0];
  return [1000 - parsed.teams, parsed.index];
};

/**
 * Times (and venues) for a list of matches, in order. Each time slot holds
 * up to one match per venue; a team plays at most once per slot; a knockout
 * match comes after the matches that feed it, and (when pool matches are in
 * the same run) after every pool match. With a daily window, a slot that
 * would end after `dayEnd` moves to `dayStart` the next day (times in IST).
 */
export function planSchedule(items, { start, minutesPerMatch, venues, dayStart, dayEnd }) {
  const IST_MS = 330 * 60 * 1000;
  const minutes = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const windowStart = dayStart ? minutes(dayStart) : null;
  const windowEnd = dayEnd ? minutes(dayEnd) : null;
  const fit = (time) => {
    if (windowStart === null || windowEnd === null || windowEnd <= windowStart) return time;
    let t = time;
    for (let guard = 0; guard < 400; guard += 1) {
      const local = new Date(t.getTime() + IST_MS);
      const dayMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
      const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - IST_MS;
      if (dayMinutes < windowStart) return new Date(midnight + windowStart * 60000);
      if (dayMinutes + minutesPerMatch > windowEnd) {
        t = new Date(midnight + 24 * 3600000 + windowStart * 60000);
        continue;
      }
      return t;
    }
    return t;
  };

  const remaining = items.slice();
  const placedSlot = new Map(); // match id → slot index
  const hasPool = items.some((item) => !item.isKnockout);
  const poolIds = new Set(items.filter((item) => !item.isKnockout).map((item) => item.id));
  const plan = [];
  let time = fit(new Date(start));
  for (let slot = 0; remaining.length && slot < 2000; slot += 1) {
    const teamsInSlot = new Set();
    let used = 0;
    for (let i = 0; i < remaining.length && used < venues.length;) {
      const item = remaining[i];
      const teams = [item.sideA, item.sideB].filter(Boolean);
      const feedersReady = (item.feeders || []).every((feeder) => {
        if (placedSlot.has(feeder.id)) return placedSlot.get(feeder.id) < slot;
        if (feeder.scheduledAt) return new Date(feeder.scheduledAt).getTime() + minutesPerMatch * 60000 <= time.getTime();
        return !items.some((other) => other.id === feeder.id); // not in this run and untimed: no constraint
      });
      const poolsDone = !item.isKnockout || !hasPool || [...poolIds].every((id) => placedSlot.has(id) && placedSlot.get(id) < slot);
      if (feedersReady && poolsDone && teams.every((code) => !teamsInSlot.has(code))) {
        plan.push({ id: item.id, scheduledAt: new Date(time), venue: venues[used] });
        placedSlot.set(item.id, slot);
        teams.forEach((code) => teamsInSlot.add(code));
        used += 1;
        remaining.splice(i, 1);
      } else {
        i += 1;
      }
    }
    time = fit(new Date(time.getTime() + minutesPerMatch * 60000));
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Reading

function toTournament(row, counts = {}) {
  return {
    id: row.id,
    sportId: row.sportId,
    sportName: getSportName(row.sportId),
    gender: row.gender,
    name: row.name,
    pointsWin: row.pointsWin,
    pointsDraw: row.pointsDraw,
    pointsLoss: row.pointsLoss,
    allowDraws: Boolean(row.allowDraws),
    qualifyPerPool: row.qualifyPerPool,
    thirdPlace: Boolean(row.thirdPlace),
    isSample: Boolean(row.isSample),
    version: row.version,
    teamCount: counts.teams ?? 0,
    matchCount: counts.matches ?? 0,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function listTournaments() {
  const db = getDb();
  const rows = await db.select().from(tournaments).orderBy(asc(tournaments.sportId), asc(tournaments.gender), asc(tournaments.name));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const teams = await db.select({ tournamentId: tournamentTeams.tournamentId }).from(tournamentTeams).where(inArray(tournamentTeams.tournamentId, ids));
  const games = await db.select({ tournamentId: matches.tournamentId }).from(matches).where(inArray(matches.tournamentId, ids));
  const count = (list, id) => list.filter((item) => item.tournamentId === id).length;
  return rows
    .map((row) => toTournament(row, { teams: count(teams, row.id), matches: count(games, row.id) }))
    .sort((a, b) => a.sportName.localeCompare(b.sportName) || a.gender.localeCompare(b.gender) || a.name.localeCompare(b.name));
}

async function loadTournamentRow(id, tx = getDb()) {
  const [row] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!row) throw httpError(404, "Tournament not found");
  return row;
}

/**
 * Everything about one tournament: teams and pools with standings, the pool
 * matches, the knockout bracket by round, and any other matches.
 */
export async function getTournament(id) {
  const db = getDb();
  const row = await loadTournamentRow(id);
  const teamRows = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id)).orderBy(asc(tournamentTeams.pool), asc(tournamentTeams.position), asc(tournamentTeams.id));
  const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, id));
  const list = await withPlacings(matchRows, new Map([[row.id, row]]));
  const points = tournamentPoints(row);

  const poolNames = [...new Set(teamRows.map((team) => team.pool).filter(Boolean))].sort();
  for (const match of list) if (match.pool && !match.bracketSlot && !poolNames.includes(match.pool)) poolNames.push(match.pool);
  poolNames.sort();

  const pools = poolNames.map((pool) => {
    const members = teamRows.filter((team) => team.pool === pool);
    const codes = new Set(members.map((team) => team.iiitCode));
    const poolMatches = list.filter((match) => match.pool === pool && !match.bracketSlot);
    // Standings use matches between teams currently in the pool.
    const counted = poolMatches.filter((match) => match.status !== "cancelled" && codes.has(match.sideA?.code) && codes.has(match.sideB?.code));
    const manualOrder = members.length && members.every((team) => team.manualRank !== null)
      ? members.slice().sort((a, b) => a.manualRank - b.manualRank).map((team) => team.iiitCode)
      : null;
    const adjustments = new Map(members.map((team) => [team.iiitCode, { won: team.adjWon, drawn: team.adjDrawn, lost: team.adjLost, note: team.adjNote }]));
    const { rows, manual } = rankPool(members.map((team) => ({ code: team.iiitCode, name: iiitName(team.iiitCode) })), counted, points, manualOrder, adjustments);
    return {
      pool,
      teams: members.map((team) => ({ code: team.iiitCode, name: iiitName(team.iiitCode) })),
      rows: rows.map((standing, index) => ({ ...standing, rank: index + 1, qualifies: index < row.qualifyPerPool })),
      manual,
      played: counted.filter((match) => match.status === "completed").length,
      total: counted.length,
      matches: poolMatches,
    };
  });

  const knockoutMatches = list.filter((match) => match.bracketSlot);
  const firstRound = knockoutMatches.reduce((max, match) => Math.max(max, parseSlot(match.bracketSlot)?.teams || 0), 0);
  const rounds = [];
  for (let teams = firstRound; teams >= 2; teams /= 2) {
    const roundMatches = knockoutMatches
      .filter((match) => {
        const parsed = parseSlot(match.bracketSlot);
        return parsed && !parsed.third && parsed.teams === teams;
      })
      .sort((a, b) => parseSlot(a.bracketSlot).index - parseSlot(b.bracketSlot).index);
    rounds.push({ name: knockoutRoundName(teams), teams, matches: roundMatches });
  }
  const third = knockoutMatches.find((match) => match.bracketSlot === THIRD_PLACE_SLOT) || null;
  const others = list.filter((match) => !match.bracketSlot && !match.pool);

  // Placeholders for empty knockout sides: "Winner of QF1".
  const bySlotSource = new Map();
  for (const match of knockoutMatches) {
    if (match.nextMatchId) bySlotSource.set(`${match.nextMatchId}|${match.nextSide}`, `Winner of ${match.bracketSlot}`);
    if (match.loserNextMatchId) bySlotSource.set(`${match.loserNextMatchId}|${match.loserNextSide}`, `Loser of ${match.bracketSlot}`);
  }
  for (const match of knockoutMatches) {
    match.placeholderA = bySlotSource.get(`${match.id}|A`) || "";
    match.placeholderB = bySlotSource.get(`${match.id}|B`) || "";
    match.isBye = match.status === "cancelled" && match.resultNote === "Bye";
  }

  const champion = (() => {
    const final = knockoutMatches.find((match) => match.bracketSlot === "F");
    if (!final || final.status !== "completed" || !final.winner || final.winner === "draw") return null;
    return { code: final.winner, name: iiitName(final.winner) };
  })();

  return {
    tournament: toTournament(row, { teams: teamRows.length, matches: matchRows.length }),
    teams: teamRows.map((team) => ({ code: team.iiitCode, name: iiitName(team.iiitCode), pool: team.pool, manualRank: team.manualRank })),
    pools,
    knockout: { size: firstRound, rounds, third },
    others,
    champion,
    matches: list,
  };
}

const publicCache = new Map();
const PUBLIC_CACHE_MS = 5000;
onInvalidate(() => publicCache.clear());

/** Public brackets page data: every tournament, and the chosen one in full. */
export async function getPublicBrackets({ tournament } = {}) {
  const key = String(tournament || "");
  const cached = publicCache.get(key);
  if (cached && Date.now() - cached.at < PUBLIC_CACHE_MS) return cached.data;
  const all = await listTournaments();
  const chosenId = tournament && all.some((item) => item.id === tournament) ? tournament : all[0]?.id;
  const detail = chosenId ? await getTournament(chosenId) : null;
  const data = {
    generatedAt: new Date().toISOString(),
    hasSample: all.some((item) => item.isSample),
    tournaments: all.map(({ id, sportId, sportName, gender, name, isSample }) => ({ id, sportId, sportName, gender, name, isSample })),
    detail,
  };
  publicCache.set(key, { at: Date.now(), data });
  return data;
}

// ---------------------------------------------------------------------------
// Writing (super admin)

async function bumpTournament(tx, row, actor, changes = {}) {
  const result = await tx.update(tournaments)
    .set({ ...changes, version: row.version + 1, updatedBy: actor, updatedAt: new Date() })
    .where(and(eq(tournaments.id, row.id), eq(tournaments.version, row.version)));
  if (affectedRows(result) === 0) throw httpError(409, "This tournament was changed by someone else. Reload and try again.");
}

function checkVersion(row, version) {
  if (version !== undefined && version !== row.version) {
    throw httpError(409, "This tournament was changed by someone else. The latest version is shown; check it and try again.");
  }
}

async function nameTaken(tx, { sportId, gender, name }, exceptId = null) {
  const conditions = [eq(tournaments.sportId, sportId), eq(tournaments.gender, gender), eq(tournaments.name, name)];
  if (exceptId) conditions.push(ne(tournaments.id, exceptId));
  const [taken] = await tx.select({ id: tournaments.id }).from(tournaments).where(and(...conditions)).limit(1);
  return Boolean(taken);
}

export async function createTournament(input, actor, { isSample = false } = {}) {
  if (!isValidSportGender(input.sportId, input.gender)) throw httpError(400, "Unknown sport or category");
  if (kindForSport(input.sportId) !== "versus") throw httpError(400, "Brackets are for sports played side against side");
  const db = getDb();
  const values = {
    sportId: input.sportId, gender: input.gender, name: input.name || "",
    pointsWin: input.pointsWin, pointsDraw: input.pointsDraw, pointsLoss: input.pointsLoss,
    allowDraws: input.allowDraws, qualifyPerPool: input.qualifyPerPool, thirdPlace: input.thirdPlace,
    isSample, createdBy: actor, updatedBy: actor,
  };
  if (await nameTaken(db, values)) throw httpError(409, "This sport and category already has a tournament with that name. Give it a different name (e.g. Singles).");
  const [inserted] = await db.insert(tournaments).values(values).$returningId();
  invalidateBoard();
  return inserted.id;
}

export async function updateTournament(id, { version, ...input }, actor) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).limit(1).for("update");
    if (!row) throw httpError(404, "Tournament not found");
    checkVersion(row, version);
    const changes = {};
    for (const key of ["name", "pointsWin", "pointsDraw", "pointsLoss", "allowDraws", "qualifyPerPool", "thirdPlace"]) {
      if (input[key] !== undefined) changes[key] = input[key];
    }
    if (changes.name !== undefined && await nameTaken(tx, { sportId: row.sportId, gender: row.gender, name: changes.name }, row.id)) {
      throw httpError(409, "Another tournament in this sport and category has that name");
    }
    await bumpTournament(tx, row, actor, changes);
  });
  invalidateBoard();
}

/** Deletes the tournament with its teams and every match in it. */
export async function deleteTournament(id) {
  const result = await getDb().delete(tournaments).where(eq(tournaments.id, id));
  if (affectedRows(result) === 0) throw httpError(404, "Tournament not found");
  invalidateBoard();
}

/**
 * Replaces the teams and their pools. Matches already created stay; use
 * syncPoolMatches to add the missing ones and remove unplayed ones between
 * teams no longer in the same pool. A pool's manual order is cleared when
 * its teams change.
 */
export async function setTeams(id, { version, teams }, actor) {
  const seen = new Set();
  const cleaned = teams.map((team, index) => {
    if (!isIiitCode(team.iiitCode)) throw httpError(400, "Unknown IIIT");
    if (seen.has(team.iiitCode)) throw httpError(400, `${iiitName(team.iiitCode)} is entered twice`);
    seen.add(team.iiitCode);
    return { iiitCode: team.iiitCode, pool: team.pool || "", position: index };
  });
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).limit(1).for("update");
    if (!row) throw httpError(404, "Tournament not found");
    checkVersion(row, version);
    const before = await tx.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id));
    const membership = (list, pool) => list.filter((team) => team.pool === pool).map((team) => team.iiitCode).sort().join(",");
    const pools = new Set([...before.map((t) => t.pool), ...cleaned.map((t) => t.pool)]);
    const unchanged = new Set([...pools].filter((pool) => membership(before, pool) === membership(cleaned, pool)));
    const keepRank = new Map(before.filter((team) => unchanged.has(team.pool)).map((team) => [team.iiitCode, team.manualRank]));
    // Hand corrections stay with a team while it stays in the same pool.
    const keepAdjustment = new Map(cleaned.map((team) => {
      const old = before.find((item) => item.iiitCode === team.iiitCode && item.pool === team.pool);
      return [team.iiitCode, old ? { adjWon: old.adjWon, adjDrawn: old.adjDrawn, adjLost: old.adjLost, adjNote: old.adjNote } : {}];
    }));
    await tx.delete(tournamentTeams).where(eq(tournamentTeams.tournamentId, id));
    if (cleaned.length) {
      await tx.insert(tournamentTeams).values(cleaned.map((team) => ({ ...team, ...keepAdjustment.get(team.iiitCode), tournamentId: id, manualRank: keepRank.get(team.iiitCode) ?? null })));
    }
    await bumpTournament(tx, row, actor);
  });
  invalidateBoard();
}

/**
 * Sets a pool's wins, draws and losses by hand. `teams` gives the totals the
 * Sports SAC wants shown; what is stored is the difference from the results
 * counted right now, so results entered later still count on top. Totals
 * equal to the counted ones clear the correction.
 */
export async function setPoolRecords(id, { pool, teams }, actor) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const row = await loadTournamentRow(id, tx);
    const members = await tx.select().from(tournamentTeams).where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.pool, pool)));
    if (!members.length) throw httpError(404, "Pool not found");
    const codes = new Set(members.map((team) => team.iiitCode));
    const poolMatches = await withPlacings(
      (await tx.select().from(matches).where(and(eq(matches.tournamentId, id), eq(matches.pool, pool), eq(matches.bracketSlot, ""))))
        .filter((match) => match.status !== "cancelled" && codes.has(match.sideA) && codes.has(match.sideB)),
      new Map([[row.id, row]]),
    );
    const counted = new Map(rankPool(members.map((team) => ({ code: team.iiitCode, name: iiitName(team.iiitCode) })), poolMatches, tournamentPoints(row)).rows
      .map((standing) => [standing.iiitCode, standing]));
    for (const item of teams) {
      if (!codes.has(item.iiitCode)) throw httpError(400, `${iiitName(item.iiitCode)} is not in Pool ${pool}`);
      const base = counted.get(item.iiitCode);
      const changes = item.reset
        ? { adjWon: 0, adjDrawn: 0, adjLost: 0, adjNote: "" }
        : { adjWon: item.won - base.won, adjDrawn: item.drawn - base.drawn, adjLost: item.lost - base.lost, adjNote: item.note || "" };
      if (!changes.adjWon && !changes.adjDrawn && !changes.adjLost) changes.adjNote = "";
      await tx.update(tournamentTeams).set(changes).where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.iiitCode, item.iiitCode)));
    }
    await bumpTournament(tx, row, actor);
  });
  invalidateBoard();
}

/** Sets (or, with order null, clears) the hand-made order of one pool. */
export async function setPoolOrder(id, { pool, order }, actor) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const row = await loadTournamentRow(id, tx);
    const members = await tx.select().from(tournamentTeams).where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.pool, pool)));
    if (!members.length) throw httpError(404, "Pool not found");
    if (order) {
      const codes = new Set(members.map((team) => team.iiitCode));
      if (order.length !== members.length || !order.every((code) => codes.has(code)) || new Set(order).size !== order.length) {
        throw httpError(400, "List every team in the pool once");
      }
      for (const [index, code] of order.entries()) {
        await tx.update(tournamentTeams).set({ manualRank: index + 1 }).where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.iiitCode, code)));
      }
    } else {
      await tx.update(tournamentTeams).set({ manualRank: null }).where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.pool, pool)));
    }
    await bumpTournament(tx, row, actor);
  });
  invalidateBoard();
}

/**
 * Brings the pool matches in line with the pools: creates every missing
 * round-robin match, moves unplayed matches whose two teams are now in
 * another pool together, and removes unplayed matches between teams no longer
 * in the same pool. Matches already played or live are never removed; they
 * are listed so the Sports SAC can decide. With apply false, only reports.
 */
export async function syncPoolMatches(id, { apply }, actor) {
  const db = getDb();
  const run = async (tx) => {
    const row = await loadTournamentRow(id, tx);
    const teams = await tx.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id)).orderBy(asc(tournamentTeams.position), asc(tournamentTeams.id));
    const teamsByPool = new Map();
    for (const team of teams) {
      if (!team.pool) continue;
      if (!teamsByPool.has(team.pool)) teamsByPool.set(team.pool, []);
      teamsByPool.get(team.pool).push(team.iiitCode);
    }
    const desired = new Map(); // pair → { pool, sideA, sideB }
    for (const [pool, codes] of [...teamsByPool].sort(([a], [b]) => a.localeCompare(b))) {
      for (const item of roundRobin(codes)) desired.set(pairKey(item.sideA, item.sideB), { pool, ...item });
    }
    const existing = (await tx.select().from(matches).where(and(eq(matches.tournamentId, id), eq(matches.bracketSlot, ""))))
      .filter((match) => match.pool && match.status !== "cancelled" && match.sideA && match.sideB);

    const create = [];
    const move = [];
    const remove = [];
    const kept = [];
    const stale = [];
    const covered = new Set();
    for (const match of existing) {
      const key = pairKey(match.sideA, match.sideB);
      const want = desired.get(key);
      if (want && !covered.has(key)) {
        covered.add(key);
        if (want.pool !== match.pool) {
          if (UNPLAYED.includes(match.status)) move.push({ match, pool: want.pool });
          else stale.push(match);
        } else {
          kept.push(match);
        }
      } else if (UNPLAYED.includes(match.status)) {
        remove.push(match);
      } else {
        stale.push(match);
      }
    }
    // Interleave pools round by round so the default order is fair.
    const missing = [...desired.entries()].filter(([key]) => !covered.has(key)).map(([, item]) => item);
    missing.sort((a, b) => a.round - b.round || a.pool.localeCompare(b.pool));
    create.push(...missing);

    if (apply) {
      const now = new Date();
      for (const item of create) {
        const [inserted] = await tx.insert(matches).values({
          tournamentId: id, sportId: row.sportId, gender: row.gender, kind: "versus",
          round: "Pool", pool: item.pool, sideA: item.sideA, sideB: item.sideB, venue: "", scheduledAt: null,
          isSample: row.isSample, createdBy: actor, updatedBy: actor,
        }).$returningId();
        await tx.insert(matchChanges).values({ matchId: inserted.id, actor, action: "created", before: null, after: { pool: item.pool, sideA: item.sideA, sideB: item.sideB } });
      }
      for (const { match, pool } of move) {
        await tx.update(matches).set({ pool, version: match.version + 1, updatedBy: actor, updatedAt: now }).where(eq(matches.id, match.id));
        await tx.insert(matchChanges).values({ matchId: match.id, actor, action: "details", before: { pool: match.pool }, after: { pool } });
      }
      if (remove.length) await tx.delete(matches).where(inArray(matches.id, remove.map((match) => match.id)));
      await bumpTournament(tx, row, actor);
    }
    const describe = (match) => ({ id: match.id, pool: match.pool, sideA: iiitName(match.sideA), sideB: iiitName(match.sideB), status: match.status });
    return {
      create: create.map((item) => ({ pool: item.pool, sideA: iiitName(item.sideA), sideB: iiitName(item.sideB) })),
      move: move.map(({ match, pool }) => ({ ...describe(match), toPool: pool })),
      remove: remove.map(describe),
      stale: stale.map(describe),
      kept: kept.length,
    };
  };
  const result = apply ? await db.transaction(run) : await run(db);
  if (apply) invalidateBoard();
  return result;
}

/**
 * Builds (or rebuilds) the knockout bracket. `slots` has one entry per
 * first-round position: positions 1 and 2 meet in match 1, 3 and 4 in
 * match 2, and so on. An empty position is a bye: the other team goes
 * straight through. A rebuild is refused once a knockout match has been
 * played; change individual matches instead. Times and venues already set
 * on a slot are kept.
 */
export async function buildBracket(id, { size, thirdPlace, slots }, actor) {
  if (slots.length !== size) throw httpError(400, `Fill ${size} positions (leave a position empty for a bye)`);
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).limit(1).for("update");
    if (!row) throw httpError(404, "Tournament not found");
    const teams = new Set((await tx.select({ code: tournamentTeams.iiitCode }).from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id))).map((t) => t.code));
    const seen = new Set();
    for (const code of slots) {
      if (!code) continue;
      if (!teams.has(code)) throw httpError(400, `${iiitName(code)} is not in this tournament. Add it under Teams and pools first.`);
      if (seen.has(code)) throw httpError(400, `${iiitName(code)} is placed twice`);
      seen.add(code);
    }
    if (seen.size < 2) throw httpError(400, "Place at least two teams");

    const old = await tx.select().from(matches).where(and(eq(matches.tournamentId, id), ne(matches.bracketSlot, "")));
    const played = old.filter((match) => ["live", "completed"].includes(match.status));
    if (played.length) {
      throw httpError(409, `Knockout matches have been played (${played.map((m) => m.bracketSlot).join(", ")}). Change the teams in individual matches instead, or delete those matches first.`);
    }
    const keep = new Map(old.map((match) => [match.bracketSlot, { scheduledAt: match.scheduledAt, venue: match.venue }]));
    if (old.length) await tx.delete(matches).where(inArray(matches.id, old.map((match) => match.id)));

    // Insert from the final backwards so each match knows where its winner goes.
    const layout = bracketLayout(size, thirdPlace);
    const idBySlot = new Map();
    const ordered = layout.slice().sort((a, b) => a.teams - b.teams || (a.third ? -1 : 0) - (b.third ? -1 : 0));
    const inserted = [];
    for (const entry of ordered) {
      const first = entry.teams === size && !entry.third;
      const sideA = first ? slots[(entry.index - 1) * 2] || null : null;
      const sideB = first ? slots[(entry.index - 1) * 2 + 1] || null : null;
      const bye = first && Boolean(sideA) !== Boolean(sideB);
      const empty = first && !sideA && !sideB;
      const values = {
        tournamentId: id, sportId: row.sportId, gender: row.gender, kind: "versus",
        round: entry.round, pool: "", bracketSlot: entry.slot,
        nextMatchId: entry.next ? idBySlot.get(entry.next) : null, nextSide: entry.nextSide,
        loserNextMatchId: entry.loserNext ? idBySlot.get(entry.loserNext) : null, loserNextSide: entry.loserNextSide,
        sideA, sideB,
        status: bye || empty ? "cancelled" : "scheduled",
        winner: bye ? sideA || sideB : null,
        resultNote: bye || empty ? "Bye" : "",
        scheduledAt: keep.get(entry.slot)?.scheduledAt ?? null,
        venue: keep.get(entry.slot)?.venue ?? "",
        isSample: row.isSample, createdBy: actor, updatedBy: actor,
      };
      const [result] = await tx.insert(matches).values(values).$returningId();
      idBySlot.set(entry.slot, result.id);
      inserted.push({ ...values, id: result.id, version: 1 });
      await tx.insert(matchChanges).values({ matchId: result.id, actor, action: "created", before: null, after: { bracketSlot: entry.slot, sideA, sideB } });
    }
    for (const match of inserted) {
      if (match.status === "cancelled" && match.winner) await advanceFrom(tx, match, actor);
    }
    await bumpTournament(tx, row, actor, { thirdPlace });
  });
  invalidateBoard();
}

/** Removes the whole knockout bracket, if none of it has been played. */
export async function clearBracket(id, actor) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const row = await loadTournamentRow(id, tx);
    const old = await tx.select().from(matches).where(and(eq(matches.tournamentId, id), ne(matches.bracketSlot, "")));
    if (old.some((match) => ["live", "completed"].includes(match.status))) throw httpError(409, "Knockout matches have been played; delete them one by one if you really mean to.");
    if (old.length) await tx.delete(matches).where(inArray(matches.id, old.map((match) => match.id)));
    await bumpTournament(tx, row, actor);
  });
  invalidateBoard();
}

/**
 * Gives times and venues to the tournament's unplayed matches (pool,
 * knockout or both), in play order. By default only matches without a time
 * are changed. Every time can still be edited match by match.
 */
export async function scheduleMatches(id, options, actor) {
  const db = getDb();
  const count = await db.transaction(async (tx) => {
    const row = await loadTournamentRow(id, tx);
    const all = await tx.select().from(matches).where(eq(matches.tournamentId, id));
    const teams = await tx.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id)).orderBy(asc(tournamentTeams.position), asc(tournamentTeams.id));
    const teamsByPool = new Map();
    for (const team of teams) {
      if (!team.pool) continue;
      if (!teamsByPool.has(team.pool)) teamsByPool.set(team.pool, []);
      teamsByPool.get(team.pool).push(team.iiitCode);
    }
    const order = poolPlayOrder(teamsByPool);
    const wanted = all.filter((match) => {
      if (!UNPLAYED.includes(match.status)) return false;
      if (options.onlyUnscheduled && match.scheduledAt) return false;
      const knockout = Boolean(match.bracketSlot);
      if (options.stage === "pool") return !knockout && match.pool;
      if (options.stage === "knockout") return knockout;
      return true;
    });
    const poolKey = (match) => {
      const info = order.get(pairKey(match.sideA, match.sideB));
      return info ? [info.round, info.pool, info.index] : [999, match.pool, match.id];
    };
    const compare = (a, b) => {
      const ka = a.bracketSlot ? [1, ...KNOCKOUT_ORDER(a.bracketSlot)] : [0, ...poolKey(a)];
      const kb = b.bracketSlot ? [1, ...KNOCKOUT_ORDER(b.bracketSlot)] : [0, ...poolKey(b)];
      for (let i = 0; i < Math.max(ka.length, kb.length); i += 1) {
        if (ka[i] === kb[i]) continue;
        return typeof ka[i] === "string" ? String(ka[i]).localeCompare(String(kb[i])) : ka[i] - kb[i];
      }
      return a.id - b.id;
    };
    wanted.sort(compare);
    const feedersOf = (match) => all.filter((other) => other.nextMatchId === match.id || other.loserNextMatchId === match.id)
      .filter((other) => !(other.status === "cancelled"))
      .map((other) => ({ id: other.id, scheduledAt: other.scheduledAt }));
    const items = wanted.map((match) => ({
      id: match.id, sideA: match.sideA, sideB: match.sideB, isKnockout: Boolean(match.bracketSlot), feeders: match.bracketSlot ? feedersOf(match) : [],
    }));
    const plan = planSchedule(items, options);
    const now = new Date();
    const byId = new Map(all.map((match) => [match.id, match]));
    for (const item of plan) {
      const match = byId.get(item.id);
      await tx.update(matches).set({ scheduledAt: item.scheduledAt, venue: item.venue, version: match.version + 1, updatedBy: actor, updatedAt: now }).where(eq(matches.id, item.id));
      await tx.insert(matchChanges).values({ matchId: item.id, actor, action: "scheduled", before: { scheduledAt: match.scheduledAt, venue: match.venue }, after: { scheduledAt: item.scheduledAt, venue: item.venue } });
    }
    await bumpTournament(tx, row, actor);
    return plan.length;
  });
  invalidateBoard();
  return count;
}
