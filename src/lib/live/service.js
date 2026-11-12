import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { coordinatorSports, eventPlacings, matchChanges, matches, sessions, tournamentTeams, tournaments, users } from "../../db/schema.js";
import { getSportConfig } from "../sports/config.js";
import { httpError } from "../security/request.js";
import { getSportName } from "../registration/labels.js";
import {
  MEDAL_ROUNDS, POOL_POINTS, eventName, iiitName, isIiitCode, isValidEvent, isValidSportGender, kindForSport,
} from "./catalog.js";

/**
 * Live results: matches, scores, placings and the medal tally.
 * Every write checks the caller's scope on the server and the match version,
 * so a coordinator can only touch their own sports and two people editing the
 * same match at once cannot silently overwrite each other.
 */

function affectedRows(result) {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}

// ---------------------------------------------------------------------------
// Scope

/** What the signed-in user may edit: everything (admin) or listed sports. */
export async function getScope(session) {
  if (session.role === "admin") return { all: true, sports: [] };
  if (session.role !== "coordinator") return { all: false, sports: [] };
  const rows = await getDb().select({ sportId: coordinatorSports.sportId, gender: coordinatorSports.gender })
    .from(coordinatorSports).where(eq(coordinatorSports.userId, session.userId));
  return { all: false, sports: rows };
}

export function scopeAllows(scope, match) {
  if (scope.all) return true;
  return scope.sports.some((item) => item.sportId === match.sportId && (item.gender === "all" || item.gender === match.gender));
}

// ---------------------------------------------------------------------------
// Reading

function toPublicMatch(row, placings = [], tournament = null) {
  return {
    id: row.id,
    tournamentId: row.tournamentId || null,
    bracketSlot: row.bracketSlot || "",
    nextMatchId: row.nextMatchId || null,
    nextSide: row.nextSide || null,
    loserNextMatchId: row.loserNextMatchId || null,
    loserNextSide: row.loserNextSide || null,
    // A draw is never allowed in a knockout match, a final or a 3rd-place match,
    // nor in a tournament whose pool matches must have a winner.
    drawAllowed: drawAllowed(row, tournament),
    sportId: row.sportId,
    sportName: getSportName(row.sportId),
    gender: row.gender,
    kind: row.kind,
    eventId: row.eventId || null,
    eventName: row.eventId ? eventName(row.sportId, row.gender, row.eventId) : null,
    round: row.round,
    pool: row.pool || "",
    venue: row.venue,
    scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
    status: row.status,
    sideA: row.sideA ? { code: row.sideA, name: iiitName(row.sideA) } : null,
    sideB: row.sideB ? { code: row.sideB, name: iiitName(row.sideB) } : null,
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    scoreDetail: row.scoreDetail,
    winner: row.winner || null,
    resultNote: row.resultNote,
    placings: placings
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ position: p.position, iiitCode: p.iiitCode, iiitName: iiitName(p.iiitCode), athlete: p.athlete, mark: p.mark })),
    isSample: Boolean(row.isSample),
    version: row.version,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function drawAllowed(row, tournament) {
  if (row.kind !== "versus") return false;
  if ([MEDAL_ROUNDS.final, MEDAL_ROUNDS.bronze].includes(row.round)) return false;
  if (row.bracketSlot) return false;
  if (tournament && !tournament.allowDraws) return false;
  return true;
}

/** Pool points for a tournament, or the default for pool matches outside one. */
export function tournamentPoints(tournament) {
  return tournament
    ? { win: tournament.pointsWin, draw: tournament.pointsDraw, loss: tournament.pointsLoss, confirmed: true }
    : POOL_POINTS;
}

export async function loadTournamentMap(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await getDb().select().from(tournaments).where(inArray(tournaments.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
}

/** Time-to-be-announced matches sort after timed ones. */
export function byScheduleThenId(a, b) {
  const x = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
  const y = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
  return x - y || a.id - b.id;
}

export async function withPlacings(rows, tournamentMap = null) {
  const eventIds = rows.filter((row) => row.kind === "event").map((row) => row.id);
  const placings = eventIds.length
    ? await getDb().select().from(eventPlacings).where(inArray(eventPlacings.matchId, eventIds))
    : [];
  const byMatch = new Map();
  for (const placing of placings) {
    if (!byMatch.has(placing.matchId)) byMatch.set(placing.matchId, []);
    byMatch.get(placing.matchId).push(placing);
  }
  const map = tournamentMap || await loadTournamentMap(rows.map((row) => row.tournamentId));
  return rows
    .slice()
    .sort(byScheduleThenId)
    .map((row) => toPublicMatch(row, byMatch.get(row.id) || [], map.get(row.tournamentId) || null));
}

/** Gold/silver/bronze per IIIT, from completed finals and 3rd-place matches only. */
export function computeMedals(completed) {
  const table = new Map();
  const add = (code, medal) => {
    if (!code || !isIiitCode(code)) return;
    if (!table.has(code)) table.set(code, { iiitCode: code, iiitName: iiitName(code), gold: 0, silver: 0, bronze: 0 });
    table.get(code)[medal] += 1;
  };
  for (const match of completed) {
    if (match.status !== "completed") continue;
    if (match.kind === "versus") {
      if (!match.winner || match.winner === "draw") continue;
      const loser = match.winner === match.sideA?.code ? match.sideB?.code : match.sideA?.code;
      if (match.round === MEDAL_ROUNDS.final) {
        add(match.winner, "gold");
        add(loser, "silver");
      } else if (match.round === MEDAL_ROUNDS.bronze) {
        add(match.winner, "bronze");
      }
    } else if (match.round === MEDAL_ROUNDS.final) {
      for (const placing of match.placings) {
        if (placing.position === 1) add(placing.iiitCode, "gold");
        else if (placing.position === 2) add(placing.iiitCode, "silver");
        else if (placing.position === 3) add(placing.iiitCode, "bronze");
      }
    }
  }
  return [...table.values()].sort((a, b) =>
    b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.iiitName.localeCompare(b.iiitName));
}

function emptyStanding(code, name) {
  return { iiitCode: code, iiitName: name || iiitName(code), played: 0, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, diff: 0, points: 0 };
}

function resultFor(match, code) {
  if (match.winner === "draw") return "drawn";
  return match.winner === code ? "won" : "lost";
}

const countsInTable = (match) => match.kind === "versus" && match.status === "completed" && match.sideA?.code && match.sideB?.code && match.winner;

/**
 * Ranks one pool. Teams are ordered by points, then head-to-head points
 * among the teams level on points, then score difference, then score, then
 * name. `teams` lists every team drawn into the pool (code and name), so a
 * team appears before it plays; `manualOrder` (codes) replaces the order when
 * the Sports SAC has set it by hand. `adjustments` (code → { won, drawn,
 * lost, note }) are hand corrections added to the counted wins, draws and
 * losses; points follow from them. Head-to-head uses results only.
 */
export function rankPool(teams, poolMatches, points, manualOrder = null, adjustments = null) {
  const rows = new Map();
  for (const team of teams) rows.set(team.code, emptyStanding(team.code, team.name));
  const ensure = (side) => {
    if (!rows.has(side.code)) rows.set(side.code, emptyStanding(side.code, side.name));
    return rows.get(side.code);
  };
  const played = poolMatches.filter(countsInTable);
  for (const match of played) {
    const a = ensure(match.sideA);
    const b = ensure(match.sideB);
    const scoreA = match.scoreA ?? 0;
    const scoreB = match.scoreB ?? 0;
    for (const [team, scored, conceded] of [[a, scoreA, scoreB], [b, scoreB, scoreA]]) {
      const result = resultFor(match, team.iiitCode);
      team.played += 1;
      team[result] += 1;
      team.scored += scored;
      team.conceded += conceded;
      team.diff = team.scored - team.conceded;
      team.points += result === "won" ? points.win : result === "drawn" ? points.draw : points.loss;
    }
  }

  for (const row of rows.values()) {
    const adj = adjustments?.get(row.iiitCode);
    row.adjustment = null;
    if (!adj || (!adj.won && !adj.drawn && !adj.lost)) continue;
    row.adjustment = { won: adj.won, drawn: adj.drawn, lost: adj.lost, note: adj.note || "" };
    row.won += adj.won;
    row.drawn += adj.drawn;
    row.lost += adj.lost;
    row.played += adj.won + adj.drawn + adj.lost;
    row.points += adj.won * points.win + adj.drawn * points.draw + adj.lost * points.loss;
  }

  const list = [...rows.values()];
  // Head-to-head points among each group of teams level on points.
  const h2h = new Map(list.map((row) => [row.iiitCode, 0]));
  const byPoints = new Map();
  for (const row of list) {
    if (!byPoints.has(row.points)) byPoints.set(row.points, new Set());
    byPoints.get(row.points).add(row.iiitCode);
  }
  for (const level of byPoints.values()) {
    if (level.size < 2) continue;
    for (const match of played) {
      if (!level.has(match.sideA.code) || !level.has(match.sideB.code)) continue;
      for (const code of [match.sideA.code, match.sideB.code]) {
        const result = resultFor(match, code);
        h2h.set(code, h2h.get(code) + (result === "won" ? points.win : result === "drawn" ? points.draw : points.loss));
      }
    }
  }
  for (const row of list) row.headToHead = h2h.get(row.iiitCode);

  list.sort((x, y) => y.points - x.points || y.headToHead - x.headToHead || y.diff - x.diff || y.scored - x.scored || x.iiitName.localeCompare(y.iiitName));

  const manual = Array.isArray(manualOrder) && manualOrder.length === list.length && list.every((row) => manualOrder.includes(row.iiitCode));
  if (manual) list.sort((x, y) => manualOrder.indexOf(x.iiitCode) - manualOrder.indexOf(y.iiitCode));
  return { rows: list, manual };
}

function adjustmentsFor(all, tournamentId) {
  if (!tournamentId) return null;
  const map = new Map();
  for (const [key, value] of all) {
    const [id, code] = key.split("|");
    if (Number(id) === tournamentId) map.set(code, value);
  }
  return map;
}

/** Hand corrections to pool standings, keyed "tournamentId|iiitCode". */
export async function loadAdjustments(tournamentIds) {
  const ids = [...new Set(tournamentIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await getDb().select().from(tournamentTeams).where(inArray(tournamentTeams.tournamentId, ids));
  return new Map(rows
    .filter((row) => row.adjWon || row.adjDrawn || row.adjLost)
    .map((row) => [`${row.tournamentId}|${row.iiitCode}`, { won: row.adjWon, drawn: row.adjDrawn, lost: row.adjLost, note: row.adjNote }]));
}

/**
 * Pool (group-stage) tables per tournament (or sport and category, for pool
 * matches outside a tournament) and pool, from completed pool matches. Each
 * tournament's own points apply. Every IIIT with a pool match is listed.
 */
export function computePoolTables(list, tournamentMap = new Map(), adjustments = new Map()) {
  const groups = new Map();
  for (const match of list) {
    if (match.kind !== "versus" || !match.pool || match.status === "cancelled") continue;
    const key = `${match.tournamentId || ""}|${match.sportId}|${match.gender}|${match.pool}`;
    if (!groups.has(key)) {
      const tournament = tournamentMap.get(match.tournamentId) || null;
      groups.set(key, {
        tournamentId: match.tournamentId || null,
        tournamentName: tournament?.name || "",
        sportId: match.sportId, sportName: match.sportName, gender: match.gender, pool: match.pool,
        points: tournamentPoints(tournament), teams: new Map(), matches: [],
      });
    }
    const group = groups.get(key);
    group.matches.push(match);
    for (const side of [match.sideA, match.sideB]) if (side?.code) group.teams.set(side.code, side);
  }
  return [...groups.values()]
    .map(({ teams, matches: poolMatches, ...group }) => ({
      ...group,
      played: poolMatches.filter(countsInTable).length,
      total: poolMatches.length,
      rows: rankPool([...teams.values()], poolMatches, group.points, null, adjustmentsFor(adjustments, group.tournamentId)).rows,
    }))
    .sort((x, y) => x.sportName.localeCompare(y.sportName) || x.gender.localeCompare(y.gender) || x.tournamentName.localeCompare(y.tournamentName) || x.pool.localeCompare(y.pool));
}

async function loadBoardMatches({ sport, gender, iiit }) {
  const conditions = [sql`${matches.status} <> 'cancelled'`];
  if (sport) conditions.push(eq(matches.sportId, sport));
  if (gender) conditions.push(eq(matches.gender, gender));
  const rows = await getDb().select().from(matches).where(and(...conditions)).orderBy(asc(matches.scheduledAt), asc(matches.id));
  const tournamentMap = await loadTournamentMap(rows.map((row) => row.tournamentId));
  return { list: await withPlacings(rows, tournamentMap), tournamentMap };
}

const involves = (iiit) => (match) => match.sideA?.code === iiit || match.sideB?.code === iiit || match.placings.some((p) => p.iiitCode === iiit);

const fixturesCache = new Map();
const FIXTURES_CACHE_MS = 15000;

/**
 * Every fixture (whole meet, in time order) and the pool tables. Changes less
 * often than the live board, so it is cached for longer.
 */
export async function getFixtures({ sport = "", gender = "", iiit = "" } = {}) {
  const key = `${sport}|${gender}|${iiit}`;
  const cached = fixturesCache.get(key);
  if (cached && Date.now() - cached.at < FIXTURES_CACHE_MS) return cached.data;
  const { list: all, tournamentMap } = await loadBoardMatches({ sport, gender });
  let pools = computePoolTables(all, tournamentMap, await loadAdjustments([...tournamentMap.keys()]));
  if (iiit) pools = pools.filter((group) => group.rows.some((r) => r.iiitCode === iiit));
  const [sampleRow] = await getDb().select({ count: sql`COUNT(*)` }).from(matches).where(eq(matches.isSample, true));
  const data = {
    generatedAt: new Date().toISOString(),
    hasSample: Number(sampleRow?.count || 0) > 0,
    matches: iiit ? all.filter(involves(iiit)) : all,
    pools,
    poolPoints: POOL_POINTS,
  };
  fixturesCache.set(key, { at: Date.now(), data });
  return data;
}

const boardCache = new Map();
const BOARD_CACHE_MS = 4000;

const invalidateListeners = new Set();

/** Lets other caches (the brackets page) be cleared with the board's. */
export function onInvalidate(listener) {
  invalidateListeners.add(listener);
}

/** Forget cached boards after any change, so the next poll sees it. */
export function invalidateBoard() {
  boardCache.clear();
  fixturesCache.clear();
  for (const listener of invalidateListeners) listener();
}

/**
 * The public board: live now, up next, recent results and the medal tally,
 * optionally filtered by sport, category or IIIT. Cached for a few seconds.
 */
export async function getPublicBoard({ sport = "", gender = "", iiit = "" } = {}) {
  const key = `${sport}|${gender}|${iiit}`;
  const cached = boardCache.get(key);
  if (cached && Date.now() - cached.at < BOARD_CACHE_MS) return cached.data;

  const db = getDb();
  let { list: all } = await loadBoardMatches({ sport, gender });
  if (iiit) all = all.filter(involves(iiit));

  const live = all.filter((match) => match.status === "live");
  // Knockout matches still waiting for a team are left out of "Up next".
  const upcoming = all
    .filter((match) => (match.status === "scheduled" || match.status === "postponed") && (match.kind !== "versus" || (match.sideA && match.sideB)))
    .slice(0, 30);
  const completed = all.filter((match) => match.status === "completed");
  const results = completed
    .slice()
    .sort((a, b) => new Date(b.finishedAt || b.scheduledAt) - new Date(a.finishedAt || a.scheduledAt))
    .slice(0, 40);

  const [sampleRow] = await db.select({ count: sql`COUNT(*)` }).from(matches).where(eq(matches.isSample, true));
  const data = {
    generatedAt: new Date().toISOString(),
    hasSample: Number(sampleRow?.count || 0) > 0,
    live,
    upcoming,
    results,
    medals: computeMedals(completed),
  };
  boardCache.set(key, { at: Date.now(), data });
  return data;
}

/** Matches the user may manage, newest schedule first within status groups. */
export async function listManageableMatches(scope) {
  const db = getDb();
  let rows;
  if (scope.all) {
    rows = await db.select().from(matches).orderBy(asc(matches.scheduledAt), asc(matches.id));
  } else {
    if (!scope.sports.length) return [];
    const sportIds = [...new Set(scope.sports.map((item) => item.sportId))];
    rows = (await db.select().from(matches).where(inArray(matches.sportId, sportIds)).orderBy(asc(matches.scheduledAt), asc(matches.id)))
      .filter((row) => scopeAllows(scope, row));
  }
  return withPlacings(rows);
}

async function loadMatch(id) {
  const [row] = await getDb().select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!row) throw httpError(404, "Match not found");
  return row;
}

export async function getMatchChanges(id, limit = 30) {
  return getDb().select().from(matchChanges).where(eq(matchChanges.matchId, id)).orderBy(desc(matchChanges.id)).limit(limit);
}

// ---------------------------------------------------------------------------
// Writing

function checkSides(kind, sideA, sideB, { allowEmpty = false } = {}) {
  if (kind !== "versus") return;
  if (!allowEmpty && (!sideA || !sideB)) throw httpError(400, "Choose both IIITs");
  if ((sideA && !isIiitCode(sideA)) || (sideB && !isIiitCode(sideB))) throw httpError(400, "Unknown IIIT");
  if (sideA && sideA === sideB) throw httpError(400, "An IIIT cannot play itself");
}

/** A date for scheduled_at, or null when the time is to be announced. */
export function parseScheduledAt(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, "Enter a valid date and time");
  return date;
}

/**
 * Validates a new or edited fixture and returns the columns to store.
 * The time may be left empty (to be announced). A tournament match may leave
 * a side empty while it waits for the winner of an earlier match.
 */
export function normalizeFixture(input, { allowEmptySides = false } = {}) {
  const { sportId, gender } = input;
  if (!isValidSportGender(sportId, gender)) throw httpError(400, "Unknown sport or category");
  const kind = kindForSport(sportId);
  const eventId = kind === "event" ? input.eventId : null;
  if (kind === "event" && !isValidEvent(sportId, gender, eventId)) throw httpError(400, "Choose the event");
  const sideA = kind === "versus" ? input.sideA || null : null;
  const sideB = kind === "versus" ? input.sideB || null : null;
  checkSides(kind, sideA, sideB, { allowEmpty: allowEmptySides });
  const scheduledAt = parseScheduledAt(input.scheduledAt);
  return {
    sportId, gender, kind, eventId, sideA, sideB, scheduledAt,
    round: input.round || "",
    pool: kind === "versus" ? input.pool || "" : "",
    venue: input.venue || "",
  };
}

async function recordChange(tx, matchId, actor, action, before, after) {
  await tx.insert(matchChanges).values({ matchId, actor, action, before, after });
}

function snapshot(row) {
  return {
    status: row.status, scoreA: row.scoreA, scoreB: row.scoreB, scoreDetail: row.scoreDetail,
    winner: row.winner, resultNote: row.resultNote, round: row.round, pool: row.pool, venue: row.venue,
    scheduledAt: row.scheduledAt, sideA: row.sideA, sideB: row.sideB, eventId: row.eventId,
  };
}

export async function createMatch(input, actor, { isSample = false } = {}) {
  const db = getDb();
  let tournamentId = null;
  if (input.tournamentId) {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, input.tournamentId)).limit(1);
    if (!tournament) throw httpError(404, "Tournament not found");
    if (tournament.sportId !== input.sportId || tournament.gender !== input.gender) throw httpError(400, "The match must be in the tournament's sport and category");
    tournamentId = tournament.id;
  }
  const fixture = normalizeFixture(input, { allowEmptySides: Boolean(tournamentId) });
  const id = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(matches).values({ ...fixture, tournamentId, isSample, createdBy: actor, updatedBy: actor }).$returningId();
    await recordChange(tx, inserted.id, actor, "created", null, snapshot(fixture));
    return inserted.id;
  });
  invalidateBoard();
  return id;
}

function loserOf(row) {
  if (!row.winner || row.winner === "draw") return null;
  return row.winner === row.sideA ? row.sideB : row.winner === row.sideB ? row.sideA : null;
}

/**
 * Puts `code` into side A or B of a later match, unless that match has
 * started (the Sports SAC can still change it by hand).
 */
async function placeInto(tx, matchId, side, code, actor, expected = undefined) {
  if (!matchId || !["A", "B"].includes(side)) return false;
  const [next] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
  if (!next || !["scheduled", "postponed"].includes(next.status)) return false;
  const column = side === "A" ? "sideA" : "sideB";
  if (expected !== undefined && next[column] !== expected) return false; // changed by hand since
  if (next[column] === code) return false;
  const other = side === "A" ? next.sideB : next.sideA;
  if (code && other === code) return false;
  await tx.update(matches).set({ [column]: code, version: next.version + 1, updatedBy: actor, updatedAt: new Date() }).where(eq(matches.id, next.id));
  await recordChange(tx, next.id, actor, code ? "advanced" : "withdrawn", snapshot(next), snapshot({ ...next, [column]: code }));
  return true;
}

export async function advanceFrom(tx, row, actor) {
  if (row.kind !== "versus" || !row.winner || row.winner === "draw") return;
  await placeInto(tx, row.nextMatchId, row.nextSide, row.winner, actor);
  const loser = loserOf(row);
  if (loser) await placeInto(tx, row.loserNextMatchId, row.loserNextSide, loser, actor);
}

async function retractFrom(tx, row, actor) {
  if (row.kind !== "versus" || !row.winner || row.winner === "draw") return;
  await placeInto(tx, row.nextMatchId, row.nextSide, null, actor, row.winner);
  const loser = loserOf(row);
  if (loser) await placeInto(tx, row.loserNextMatchId, row.loserNextSide, null, actor, loser);
}

/**
 * Applies one action to a match. `isSuper` is true for the super admin.
 * Coordinators may start, score, set placings and finish matches in scope;
 * only the super admin edits fixtures, reopens finished matches, postpones,
 * cancels or deletes.
 */
export async function updateMatch(id, { action, version, ...payload }, { actor, scope, isSuper }) {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(matches).where(eq(matches.id, id)).limit(1).for("update");
    if (!row) throw httpError(404, "Match not found");
    if (!scopeAllows(scope, row)) throw httpError(403, "You can only update your own sports");
    if (version !== row.version) {
      throw httpError(409, "This match was changed by someone else. The latest score is shown; check it and try again.");
    }

    const changes = {};
    let placings = null;
    const now = new Date();
    const [tournament] = row.tournamentId
      ? await tx.select().from(tournaments).where(eq(tournaments.id, row.tournamentId)).limit(1)
      : [null];

    switch (action) {
      case "start": {
        if (!["scheduled", "postponed"].includes(row.status)) throw httpError(400, "Only a scheduled match can be started");
        if (row.kind === "versus" && (!row.sideA || !row.sideB)) throw httpError(400, "Both teams must be known before the match starts");
        changes.status = "live";
        changes.startedAt = now;
        if (row.kind === "versus") {
          changes.scoreA = row.scoreA ?? 0;
          changes.scoreB = row.scoreB ?? 0;
        }
        break;
      }
      case "score": {
        if (row.kind !== "versus") throw httpError(400, "This event records placings, not a score");
        if (row.status !== "live" && !(isSuper && row.status === "completed")) throw httpError(400, "Start the match before entering the score");
        changes.scoreA = payload.scoreA;
        changes.scoreB = payload.scoreB;
        if (payload.scoreDetail !== undefined) changes.scoreDetail = payload.scoreDetail;
        break;
      }
      case "placings": {
        if (row.kind !== "event") throw httpError(400, "Only events have placings");
        if (row.status !== "live" && !(isSuper && row.status === "completed")) throw httpError(400, "Start the event before entering placings");
        placings = normalizePlacings(payload.placings);
        break;
      }
      case "finish": {
        if (row.status !== "live") throw httpError(400, "Only a live match can be finished");
        if (row.kind === "versus") {
          const winner = payload.winner;
          if (![row.sideA, row.sideB, "draw"].includes(winner)) throw httpError(400, "Choose the winner");
          if (winner === "draw" && !drawAllowed(row, tournament)) {
            throw httpError(400, row.bracketSlot || [MEDAL_ROUNDS.final, MEDAL_ROUNDS.bronze].includes(row.round)
              ? "A knockout match needs a winner"
              : "Draws are not allowed in this tournament; choose the winner");
          }
          changes.winner = winner;
          if (payload.scoreA !== undefined) changes.scoreA = payload.scoreA;
          if (payload.scoreB !== undefined) changes.scoreB = payload.scoreB;
          if (payload.scoreDetail !== undefined) changes.scoreDetail = payload.scoreDetail;
        } else {
          // Placings may come with the finish, or have been entered while live.
          placings = normalizePlacings(payload.placings ?? null, { existing: true });
          if (placings && placings.length === 0) throw httpError(400, "Enter at least the winner before finishing");
          if (!placings) {
            const [{ count }] = await tx.select({ count: sql`COUNT(*)` }).from(eventPlacings).where(eq(eventPlacings.matchId, row.id));
            if (Number(count) === 0) throw httpError(400, "Enter at least the winner before finishing");
          }
        }
        if (payload.resultNote !== undefined) changes.resultNote = payload.resultNote;
        changes.status = "completed";
        changes.finishedAt = now;
        break;
      }
      case "reopen": {
        if (!isSuper) throw httpError(403, "Only the Sports SAC can reopen a finished match");
        if (row.status !== "completed") throw httpError(400, "Only a finished match can be reopened");
        changes.status = "live";
        changes.finishedAt = null;
        break;
      }
      case "details": {
        if (!isSuper) throw httpError(403, "Only the Sports SAC can edit the schedule");
        const fixture = normalizeFixture({ ...row, ...payload, sportId: row.sportId, gender: row.gender }, { allowEmptySides: Boolean(row.tournamentId) });
        if (row.status === "live" && row.kind === "versus" && (!fixture.sideA || !fixture.sideB)) throw httpError(400, "A live match needs both teams");
        Object.assign(changes, {
          eventId: fixture.eventId, sideA: fixture.sideA, sideB: fixture.sideB,
          scheduledAt: fixture.scheduledAt, round: fixture.round, pool: fixture.pool, venue: fixture.venue,
        });
        if (payload.status !== undefined) {
          if (!["scheduled", "postponed", "cancelled"].includes(payload.status) && payload.status !== row.status) {
            throw httpError(400, "Use start, finish or reopen to change a live match");
          }
          changes.status = payload.status;
        }
        if (row.winner && (changes.sideA !== row.sideA || changes.sideB !== row.sideB) && ![changes.sideA, changes.sideB, "draw"].includes(row.winner)) {
          changes.winner = null;
        }
        break;
      }
      default:
        throw httpError(400, "Unknown action");
    }

    changes.version = row.version + 1;
    changes.updatedBy = actor;
    changes.updatedAt = now;
    const update = await tx.update(matches).set(changes).where(and(eq(matches.id, row.id), eq(matches.version, row.version)));
    if (affectedRows(update) === 0) throw httpError(409, "This match was changed by someone else. Reload and try again.");

    if (placings) {
      await tx.delete(eventPlacings).where(eq(eventPlacings.matchId, row.id));
      if (placings.length) await tx.insert(eventPlacings).values(placings.map((p) => ({ ...p, matchId: row.id })));
    }
    await recordChange(tx, row.id, actor, action, snapshot(row), { ...snapshot({ ...row, ...changes }), ...(placings ? { placings } : {}) });

    // Knockout: a finished match sends its winner (and a semi-final's loser)
    // on; reopening takes them back out of matches that have not started.
    if (action === "finish") await advanceFrom(tx, { ...row, ...changes }, actor);
    if (action === "reopen") await retractFrom(tx, row, actor);
    return row.id;
  });
  invalidateBoard();
  const [updated] = await withPlacings([await loadMatch(result)]);
  return updated;
}

function normalizePlacings(list, { existing = false } = {}) {
  if (list == null) return existing ? null : [];
  if (!Array.isArray(list) || list.length > 16) throw httpError(400, "Invalid placings");
  const seen = new Set();
  return list.map((item) => {
    const position = Number(item.position);
    if (!Number.isInteger(position) || position < 1 || position > 16) throw httpError(400, "Positions must be 1 to 16");
    if (seen.has(position)) throw httpError(400, `Position ${position} is entered twice`);
    seen.add(position);
    if (!isIiitCode(item.iiitCode)) throw httpError(400, `Choose the IIIT for position ${position}`);
    return {
      position,
      iiitCode: item.iiitCode,
      athlete: String(item.athlete || "").trim().slice(0, 128),
      mark: String(item.mark || "").trim().slice(0, 64),
    };
  });
}

export async function deleteMatch(id) {
  const result = await getDb().delete(matches).where(eq(matches.id, id));
  if (affectedRows(result) === 0) throw httpError(404, "Match not found");
  invalidateBoard();
}

// ---------------------------------------------------------------------------
// Coordinators

export async function listCoordinators() {
  const db = getDb();
  const people = await db.select({ id: users.id, email: users.email, displayName: users.displayName, createdAt: users.createdAt })
    .from(users).where(eq(users.role, "coordinator")).orderBy(asc(users.displayName));
  if (!people.length) return [];
  const assignments = await db.select().from(coordinatorSports).where(inArray(coordinatorSports.userId, people.map((p) => p.id)));
  return people.map((person) => ({
    ...person,
    sports: assignments.filter((a) => a.userId === person.id).map((a) => ({ sportId: a.sportId, gender: a.gender, sportName: getSportName(a.sportId) })),
  }));
}

export function normalizeAssignments(list) {
  if (!Array.isArray(list) || list.length === 0) throw httpError(400, "Assign at least one sport");
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const gender = item.gender || "all";
    const valid = gender === "all" ? Boolean(getSportConfig(item.sportId)) : isValidSportGender(item.sportId, gender);
    if (!valid) throw httpError(400, "Unknown sport or category");
    const key = `${item.sportId}|${gender}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ sportId: item.sportId, gender });
  }
  return result;
}

export async function setCoordinatorSports(userId, assignments) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [person] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.role, "coordinator"))).limit(1);
    if (!person) throw httpError(404, "Coordinator not found");
    await tx.delete(coordinatorSports).where(eq(coordinatorSports.userId, userId));
    await tx.insert(coordinatorSports).values(assignments.map((a) => ({ ...a, userId })));
  });
}

// No 0/O or 1/l/I: these passwords are read out or typed from a message.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function makeCoordinatorPassword() {
  const chars = Array.from({ length: 12 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** Creates a coordinator who signs in with their email; returns the one-time password. */
export async function createCoordinator({ email, name, sports: assignments }) {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 64) throw httpError(400, "Use an email of at most 64 characters");
  const password = makeCoordinatorPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const id = await db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: users.id }).from(users)
      .where(sql`${users.username} = ${normalizedEmail} OR ${users.email} = ${normalizedEmail}`).limit(1);
    if (taken) throw httpError(409, "An account with this email already exists");
    const [inserted] = await tx.insert(users).values({
      username: normalizedEmail, email: normalizedEmail, displayName: name.trim(), passwordHash, role: "coordinator",
    }).$returningId();
    await tx.insert(coordinatorSports).values(assignments.map((a) => ({ ...a, userId: inserted.id })));
    return inserted.id;
  });
  return { id, email: normalizedEmail, password };
}

export async function resetCoordinatorPassword(userId) {
  const db = getDb();
  const password = makeCoordinatorPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.update(users).set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.role, "coordinator")));
  if (affectedRows(result) === 0) throw httpError(404, "Coordinator not found");
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return { password };
}

/** Removes a coordinator; their sessions and sport assignments go with the account. */
export async function deleteCoordinator(userId) {
  const result = await getDb().delete(users).where(and(eq(users.id, userId), eq(users.role, "coordinator")));
  if (affectedRows(result) === 0) throw httpError(404, "Coordinator not found");
}

// ---------------------------------------------------------------------------
// Sample data (shown with a banner until the real schedule arrives)

export async function clearSampleMatches() {
  const db = getDb();
  const result = await db.delete(matches).where(eq(matches.isSample, true));
  await db.delete(tournaments).where(eq(tournaments.isSample, true));
  invalidateBoard();
  return affectedRows(result);
}

