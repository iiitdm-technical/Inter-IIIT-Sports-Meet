import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { coordinatorSports, eventPlacings, matchChanges, matches, sessions, users } from "../../db/schema.js";
import { getSportConfig } from "../sports/config.js";
import { httpError } from "../security/request.js";
import { getSportName } from "../registration/labels.js";
import {
  MEDAL_ROUNDS, eventName, iiitName, isIiitCode, isValidEvent, isValidSportGender, kindForSport,
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

function toPublicMatch(row, placings = []) {
  return {
    id: row.id,
    sportId: row.sportId,
    sportName: getSportName(row.sportId),
    gender: row.gender,
    kind: row.kind,
    eventId: row.eventId || null,
    eventName: row.eventId ? eventName(row.sportId, row.gender, row.eventId) : null,
    round: row.round,
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

async function withPlacings(rows) {
  const eventIds = rows.filter((row) => row.kind === "event").map((row) => row.id);
  const placings = eventIds.length
    ? await getDb().select().from(eventPlacings).where(inArray(eventPlacings.matchId, eventIds))
    : [];
  const byMatch = new Map();
  for (const placing of placings) {
    if (!byMatch.has(placing.matchId)) byMatch.set(placing.matchId, []);
    byMatch.get(placing.matchId).push(placing);
  }
  return rows.map((row) => toPublicMatch(row, byMatch.get(row.id) || []));
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

const boardCache = new Map();
const BOARD_CACHE_MS = 4000;

/** Forget cached boards after any change, so the next poll sees it. */
export function invalidateBoard() {
  boardCache.clear();
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
  const conditions = [sql`${matches.status} <> 'cancelled'`];
  if (sport) conditions.push(eq(matches.sportId, sport));
  if (gender) conditions.push(eq(matches.gender, gender));
  const rows = await db.select().from(matches).where(and(...conditions)).orderBy(asc(matches.scheduledAt), asc(matches.id));
  let all = await withPlacings(rows);
  if (iiit) {
    all = all.filter((match) => match.sideA?.code === iiit || match.sideB?.code === iiit || match.placings.some((p) => p.iiitCode === iiit));
  }

  const live = all.filter((match) => match.status === "live");
  const upcoming = all.filter((match) => match.status === "scheduled" || match.status === "postponed").slice(0, 30);
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

function checkSides(kind, sideA, sideB) {
  if (kind !== "versus") return;
  if (!sideA || !sideB) throw httpError(400, "Choose both IIITs");
  if (!isIiitCode(sideA) || !isIiitCode(sideB)) throw httpError(400, "Unknown IIIT");
  if (sideA === sideB) throw httpError(400, "An IIIT cannot play itself");
}

/** Validates a new or edited fixture and returns the columns to store. */
export function normalizeFixture(input) {
  const { sportId, gender } = input;
  if (!isValidSportGender(sportId, gender)) throw httpError(400, "Unknown sport or category");
  const kind = kindForSport(sportId);
  const eventId = kind === "event" ? input.eventId : null;
  if (kind === "event" && !isValidEvent(sportId, gender, eventId)) throw httpError(400, "Choose the event");
  const sideA = kind === "versus" ? input.sideA : null;
  const sideB = kind === "versus" ? input.sideB : null;
  checkSides(kind, sideA, sideB);
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw httpError(400, "Enter the date and time");
  return {
    sportId, gender, kind, eventId, sideA, sideB, scheduledAt,
    round: input.round || "",
    venue: input.venue || "",
  };
}

async function recordChange(tx, matchId, actor, action, before, after) {
  await tx.insert(matchChanges).values({ matchId, actor, action, before, after });
}

function snapshot(row) {
  return {
    status: row.status, scoreA: row.scoreA, scoreB: row.scoreB, scoreDetail: row.scoreDetail,
    winner: row.winner, resultNote: row.resultNote, round: row.round, venue: row.venue,
    scheduledAt: row.scheduledAt, sideA: row.sideA, sideB: row.sideB, eventId: row.eventId,
  };
}

export async function createMatch(input, actor, { isSample = false } = {}) {
  const fixture = normalizeFixture(input);
  const db = getDb();
  const id = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(matches).values({ ...fixture, isSample, createdBy: actor, updatedBy: actor }).$returningId();
    await recordChange(tx, inserted.id, actor, "created", null, snapshot(fixture));
    return inserted.id;
  });
  invalidateBoard();
  return id;
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

    switch (action) {
      case "start": {
        if (!["scheduled", "postponed"].includes(row.status)) throw httpError(400, "Only a scheduled match can be started");
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
          if (winner === "draw" && [MEDAL_ROUNDS.final, MEDAL_ROUNDS.bronze].includes(row.round)) {
            throw httpError(400, "A final or 3rd-place match needs a winner");
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
        const fixture = normalizeFixture({ ...row, ...payload, sportId: row.sportId, gender: row.gender });
        Object.assign(changes, {
          eventId: fixture.eventId, sideA: fixture.sideA, sideB: fixture.sideB,
          scheduledAt: fixture.scheduledAt, round: fixture.round, venue: fixture.venue,
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
  const result = await getDb().delete(matches).where(eq(matches.isSample, true));
  invalidateBoard();
  return affectedRows(result);
}

