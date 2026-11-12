import { test } from "node:test";
import assert from "node:assert/strict";
import { bracketLayout, parseSlot, planSchedule, poolPlayOrder, roundRobin } from "../src/lib/live/tournaments.js";
import { bracketSizeFor, seedPositions, suggestSlots } from "../src/lib/live/bracket-seeding.js";
import { computePoolTables, drawAllowed, normalizeFixture, rankPool } from "../src/lib/live/service.js";
import { bracketSchema, fixtureSchema, tournamentCreateSchema } from "../src/lib/live/schemas.js";

const side = (code) => ({ code, name: code });
const played = (a, b, scoreA, scoreB) => ({
  kind: "versus", status: "completed", sideA: side(a), sideB: side(b), scoreA, scoreB,
  winner: scoreA === scoreB ? "draw" : scoreA > scoreB ? a : b,
});

test("round robin: every pair once, each team at most once per round", () => {
  for (const size of [2, 3, 4, 5, 6, 7]) {
    const teams = Array.from({ length: size }, (_, i) => `t${i}`);
    const games = roundRobin(teams);
    assert.equal(games.length, (size * (size - 1)) / 2, `size ${size}`);
    const pairs = new Set(games.map((g) => [g.sideA, g.sideB].sort().join("|")));
    assert.equal(pairs.size, games.length);
    const byRound = Map.groupBy(games, (g) => g.round);
    for (const round of byRound.values()) {
      const seen = round.flatMap((g) => [g.sideA, g.sideB]);
      assert.equal(new Set(seen).size, seen.length);
    }
  }
  assert.deepEqual(roundRobin(["solo"]), []);
});

test("bracket layout links each match to the next and semi-final losers to 3rd place", () => {
  const layout = bracketLayout(8, true);
  const slots = layout.map((m) => m.slot);
  assert.deepEqual(slots, ["QF1", "QF2", "QF3", "QF4", "SF1", "SF2", "F", "3P"]);
  const bySlot = Object.fromEntries(layout.map((m) => [m.slot, m]));
  assert.equal(bySlot.QF1.next, "SF1");
  assert.equal(bySlot.QF1.nextSide, "A");
  assert.equal(bySlot.QF2.nextSide, "B");
  assert.equal(bySlot.QF3.next, "SF2");
  assert.equal(bySlot.SF2.next, "F");
  assert.equal(bySlot.SF1.loserNext, "3P");
  assert.equal(bySlot.SF2.loserNextSide, "B");
  assert.equal(bySlot.F.next, null);
  assert.equal(bracketLayout(2, true).length, 1, "a two-team bracket has no 3rd-place match");
  assert.equal(bracketLayout(32, false).length, 31);
  assert.throws(() => bracketLayout(6, false));
});

test("bracket slot names parse back", () => {
  assert.deepEqual(parseSlot("QF3"), { teams: 8, index: 3 });
  assert.deepEqual(parseSlot("R16-7"), { teams: 16, index: 7 });
  assert.deepEqual(parseSlot("F"), { teams: 2, index: 1 });
  assert.equal(parseSlot("3P").third, true);
  assert.equal(parseSlot(""), null);
});

test("seeding suggestions: crossover for paired pools, seeded byes otherwise", () => {
  assert.deepEqual(seedPositions(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  const pool = (name, n) => ({ pool: name, rows: Array.from({ length: n }, (_, i) => ({ iiitCode: `${name}${i + 1}` })) });
  assert.deepEqual(
    suggestSlots([pool("A", 5), pool("B", 5), pool("C", 5), pool("D", 5)], 2, 8),
    ["A1", "B2", "C1", "D2", "B1", "A2", "D1", "C2"],
  );
  // 3 pools × 2 = 6 teams in 8: the two best seeds (A1, B1) get byes.
  const slots = suggestSlots([pool("A", 4), pool("B", 4), pool("C", 4)], 2, 8);
  assert.equal(slots.filter(Boolean).length, 6);
  assert.deepEqual(slots.slice(0, 2), ["A1", null]);
  assert.equal(bracketSizeFor(6), 8);
  assert.equal(bracketSizeFor(9), 16);
});

test("pool ranking: tournament points, then head-to-head, then score difference", () => {
  const teams = ["a", "b", "c"].map((code) => ({ code, name: code }));
  const matches = [played("a", "b", 1, 0), played("b", "c", 5, 0), played("c", "a", 1, 0)];
  // All on one win; head-to-head is a cycle, so score difference decides: b +4, c −4, a 0.
  const { rows } = rankPool(teams, matches, { win: 2, draw: 1, loss: 0 });
  assert.deepEqual(rows.map((r) => r.iiitCode), ["b", "a", "c"]);
  assert.equal(rows[0].points, 2);

  // a and b level on points: a beat b, so a is ahead despite a worse difference.
  const h2h = rankPool(teams, [played("a", "b", 1, 0), played("b", "c", 9, 0), played("c", "a", 0, 0)], { win: 3, draw: 1, loss: 0 });
  assert.deepEqual(h2h.rows.map((r) => r.iiitCode), ["a", "b", "c"]);

  const manual = rankPool(teams, matches, { win: 3, draw: 1, loss: 0 }, ["c", "a", "b"]);
  assert.equal(manual.manual, true);
  assert.deepEqual(manual.rows.map((r) => r.iiitCode), ["c", "a", "b"]);
  // A manual order that does not list every team is ignored.
  assert.equal(rankPool(teams, matches, { win: 3, draw: 1, loss: 0 }, ["c"]).manual, false);
});

test("pool tables use each tournament's points and keep tournaments apart", () => {
  const base = { sportId: "volleyball", sportName: "Volleyball", gender: "M", pool: "A" };
  const tournaments = new Map([[1, { id: 1, name: "", pointsWin: 2, pointsDraw: 0, pointsLoss: 0, allowDraws: false }]]);
  const tables = computePoolTables([
    { ...base, ...played("x", "y", 2, 1), tournamentId: 1 },
    { ...base, ...played("x", "y", 2, 1), tournamentId: null },
  ], tournaments);
  assert.equal(tables.length, 2);
  const inTournament = tables.find((t) => t.tournamentId === 1);
  assert.equal(inTournament.rows[0].points, 2);
  assert.equal(tables.find((t) => !t.tournamentId).rows[0].points, 3);
});

test("draws: never in knockout or medal matches, and off when the tournament says so", () => {
  assert.equal(drawAllowed({ kind: "versus", round: "Pool", bracketSlot: "" }, null), true);
  assert.equal(drawAllowed({ kind: "versus", round: "Pool", bracketSlot: "" }, { allowDraws: false }), false);
  assert.equal(drawAllowed({ kind: "versus", round: "Quarter-final", bracketSlot: "QF1" }, { allowDraws: true }), false);
  assert.equal(drawAllowed({ kind: "versus", round: "Final", bracketSlot: "" }, null), false);
  assert.equal(drawAllowed({ kind: "event", round: "", bracketSlot: "" }, null), false);
});

test("schedule plan: one match per venue per slot, no team twice in a slot, knockout after its feeders", () => {
  const items = [
    { id: 1, sideA: "a", sideB: "b", isKnockout: false },
    { id: 2, sideA: "a", sideB: "c", isKnockout: false },
    { id: 3, sideA: "d", sideB: "e", isKnockout: false },
    { id: 4, sideA: null, sideB: null, isKnockout: true, feeders: [{ id: 1 }, { id: 3 }] },
  ];
  const plan = planSchedule(items, { start: "2026-12-19T03:30:00.000Z", minutesPerMatch: 60, venues: ["Court 1", "Court 2"] });
  const at = Object.fromEntries(plan.map((p) => [p.id, p]));
  assert.equal(plan.length, 4);
  assert.equal(at[1].scheduledAt.toISOString(), "2026-12-19T03:30:00.000Z");
  assert.equal(at[3].scheduledAt.toISOString(), "2026-12-19T03:30:00.000Z", "d v e shares the first slot");
  assert.notEqual(at[1].venue, at[3].venue);
  assert.equal(at[2].scheduledAt.toISOString(), "2026-12-19T04:30:00.000Z", "a cannot play twice at once");
  assert.ok(at[4].scheduledAt > at[2].scheduledAt, "knockout waits for every pool match");
});

test("schedule plan: a daily window moves late matches to the next morning (IST)", () => {
  const items = [1, 2, 3].map((id) => ({ id, sideA: `a${id}`, sideB: `b${id}`, isKnockout: false }));
  // 16:00 IST start, one court, 90 minutes, play 09:00–18:00.
  const plan = planSchedule(items, { start: "2026-12-19T10:30:00.000Z", minutesPerMatch: 90, venues: ["Court"], dayStart: "09:00", dayEnd: "18:00" });
  assert.deepEqual(plan.map((p) => p.scheduledAt.toISOString()), [
    "2026-12-19T10:30:00.000Z", // 16:00
    "2026-12-20T03:30:00.000Z", // next day 09:00 (17:30 + 90 min would end after 18:00)
    "2026-12-20T05:00:00.000Z", // 10:30
  ]);
});

test("pool play order interleaves pools round by round", () => {
  const order = poolPlayOrder(new Map([["A", ["a1", "a2", "a3", "a4"]], ["B", ["b1", "b2", "b3", "b4"]]]));
  assert.equal(order.size, 12);
  assert.ok([...order.values()].every((item) => item.round >= 0 && item.round < 3));
});

test("a match time is optional and tournament matches may wait for a team", () => {
  const fixture = normalizeFixture({ sportId: "football", gender: "M", sideA: "iiit-kota", sideB: "iiit-pune", scheduledAt: "" });
  assert.equal(fixture.scheduledAt, null);
  assert.throws(() => normalizeFixture({ sportId: "football", gender: "M", sideA: "iiit-kota", sideB: null }));
  const waiting = normalizeFixture({ sportId: "football", gender: "M", sideA: "iiit-kota", sideB: null }, { allowEmptySides: true });
  assert.equal(waiting.sideB, null);
  assert.ok(fixtureSchema.safeParse({ sportId: "football", gender: "M", scheduledAt: null }).success);
  assert.ok(fixtureSchema.safeParse({ sportId: "football", gender: "M", pool: "K" }).success, "pools go past H");
});

test("tournament and bracket requests are validated", () => {
  const created = tournamentCreateSchema.parse({ sportId: "volleyball", gender: "F" });
  assert.deepEqual([created.pointsWin, created.pointsDraw, created.pointsLoss, created.allowDraws], [3, 1, 0, true]);
  assert.ok(tournamentCreateSchema.safeParse({ sportId: "volleyball", gender: "F", pointsWin: 2, pointsDraw: 0, allowDraws: false }).success);
  assert.ok(!bracketSchema.safeParse({ size: 6, thirdPlace: false, slots: [] }).success);
  assert.ok(bracketSchema.safeParse({ size: 4, thirdPlace: true, slots: ["a", null, "b", "c"] }).success);
});

test("hand corrections to wins, draws and losses change played and points, not head-to-head", () => {
  const teams = ["a", "b"].map((code) => ({ code, name: code }));
  const matches = [played("a", "b", 2, 0)];
  const points = { win: 3, draw: 1, loss: 0 };
  // b is awarded a walkover win over someone else: +1 W.
  const { rows } = rankPool(teams, matches, points, null, new Map([["b", { won: 1, drawn: 0, lost: 0, note: "Walkover" }]]));
  const b = rows.find((r) => r.iiitCode === "b");
  assert.deepEqual([b.played, b.won, b.lost, b.points], [2, 1, 1, 3]);
  assert.equal(b.adjustment.note, "Walkover");
  // Level on points; a won the match between them.
  assert.deepEqual(rows.map((r) => r.iiitCode), ["a", "b"]);
  // A negative correction (a result taken away).
  const taken = rankPool(teams, matches, points, null, new Map([["a", { won: -1, drawn: 0, lost: 1, note: "" }]])).rows.find((r) => r.iiitCode === "a");
  assert.deepEqual([taken.won, taken.lost, taken.points, taken.played], [0, 1, 0, 1]);
  assert.equal(rankPool(teams, matches, points).rows[0].adjustment, null);
});
