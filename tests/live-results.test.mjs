import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMedals, makeCoordinatorPassword, normalizeAssignments, normalizeFixture, scopeAllows } from "../src/lib/live/service.js";
import { LIVE_IIITS, isIiitCode, kindForSport } from "../src/lib/live/catalog.js";
import { coordinatorCreateSchema, matchActionSchema } from "../src/lib/live/schemas.js";
import { fromIstInput, ordinal, toIstInput } from "../src/lib/live/format.js";
import { iiits } from "../src/data/iiits.js";

const side = (code) => ({ code, name: code });

test("every IIIT gets a unique live code", () => {
  assert.equal(LIVE_IIITS.length, iiits.length);
  assert.equal(new Set(LIVE_IIITS.map((i) => i.code)).size, iiits.length);
  assert.ok(isIiitCode("iiitdm-kancheepuram"));
  assert.ok(!isIiitCode("not-an-iiit"));
});

test("sports are played side vs side or as events", () => {
  assert.equal(kindForSport("football"), "versus");
  assert.equal(kindForSport("chess"), "versus");
  assert.equal(kindForSport("athletics"), "event");
  assert.equal(kindForSport("aquatics"), "event");
  assert.equal(kindForSport("powerlifting"), "event");
});

test("coordinator scope is limited to the assigned sport and category", () => {
  const scope = { all: false, sports: [{ sportId: "football", gender: "all" }, { sportId: "badminton", gender: "F" }] };
  assert.ok(scopeAllows(scope, { sportId: "football", gender: "M" }));
  assert.ok(scopeAllows(scope, { sportId: "badminton", gender: "F" }));
  assert.ok(!scopeAllows(scope, { sportId: "badminton", gender: "M" }));
  assert.ok(!scopeAllows(scope, { sportId: "cricket", gender: "M" }));
  assert.ok(!scopeAllows({ all: false, sports: [] }, { sportId: "football", gender: "M" }));
  assert.ok(scopeAllows({ all: true, sports: [] }, { sportId: "cricket", gender: "M" }));
});

test("medals come only from completed finals and 3rd-place matches", () => {
  const medals = computeMedals([
    { status: "completed", kind: "versus", round: "Final", sideA: side("iiit-kota"), sideB: side("iiit-pune"), winner: "iiit-kota", placings: [] },
    { status: "completed", kind: "versus", round: "3rd place", sideA: side("iiit-una"), sideB: side("iiit-surat"), winner: "iiit-surat", placings: [] },
    { status: "completed", kind: "versus", round: "Semi-final", sideA: side("iiit-una"), sideB: side("iiit-kota"), winner: "iiit-kota", placings: [] },
    { status: "live", kind: "versus", round: "Final", sideA: side("iiit-una"), sideB: side("iiit-pune"), winner: null, placings: [] },
    {
      status: "completed", kind: "event", round: "Final", placings: [
        { position: 1, iiitCode: "iiit-pune" }, { position: 2, iiitCode: "iiit-kota" },
        { position: 3, iiitCode: "iiit-una" }, { position: 4, iiitCode: "iiit-surat" },
      ],
    },
    { status: "completed", kind: "event", round: "Heat", placings: [{ position: 1, iiitCode: "iiit-una" }] },
  ]);
  const byCode = Object.fromEntries(medals.map((m) => [m.iiitCode, m]));
  assert.deepEqual([byCode["iiit-kota"].gold, byCode["iiit-kota"].silver, byCode["iiit-kota"].bronze], [1, 1, 0]);
  assert.deepEqual([byCode["iiit-pune"].gold, byCode["iiit-pune"].silver, byCode["iiit-pune"].bronze], [1, 1, 0]);
  assert.deepEqual([byCode["iiit-una"].gold, byCode["iiit-una"].bronze], [0, 1]);
  assert.deepEqual([byCode["iiit-surat"].gold, byCode["iiit-surat"].bronze], [0, 1]);
  // Ranked by gold, then silver, then bronze, then name.
  assert.deepEqual(medals.map((m) => m.iiitCode).slice(0, 2).sort(), ["iiit-kota", "iiit-pune"]);
});

test("fixtures are validated before they are stored", () => {
  const ok = normalizeFixture({ sportId: "football", gender: "M", sideA: "iiit-kota", sideB: "iiit-pune", scheduledAt: "2026-12-19T03:30:00.000Z", round: "League" });
  assert.equal(ok.kind, "versus");
  assert.equal(ok.eventId, null);
  assert.throws(() => normalizeFixture({ sportId: "football", gender: "F", sideA: "iiit-kota", sideB: "iiit-pune", scheduledAt: "2026-12-19T03:30:00Z" }), /Unknown sport or category/);
  assert.throws(() => normalizeFixture({ sportId: "football", gender: "M", sideA: "iiit-kota", sideB: "iiit-kota", scheduledAt: "2026-12-19T03:30:00Z" }), /cannot play itself/);
  assert.throws(() => normalizeFixture({ sportId: "football", gender: "M", sideA: "iiit-kota", sideB: "nowhere", scheduledAt: "2026-12-19T03:30:00Z" }), /Unknown IIIT/);
  assert.throws(() => normalizeFixture({ sportId: "athletics", gender: "M", eventId: "50m_freestyle", scheduledAt: "2026-12-19T03:30:00Z" }), /Choose the event/);
  const event = normalizeFixture({ sportId: "athletics", gender: "mixed", eventId: "mixed_4x100m_relay", sideA: "iiit-kota", scheduledAt: "2026-12-19T03:30:00Z" });
  assert.equal(event.kind, "event");
  assert.equal(event.sideA, null);
});

test("coordinator assignments are checked and de-duplicated", () => {
  assert.deepEqual(normalizeAssignments([{ sportId: "football" }, { sportId: "football", gender: "all" }, { sportId: "badminton", gender: "F" }]), [
    { sportId: "football", gender: "all" }, { sportId: "badminton", gender: "F" },
  ]);
  assert.throws(() => normalizeAssignments([{ sportId: "cricket", gender: "F" }]), /Unknown sport/);
  assert.throws(() => normalizeAssignments([{ sportId: "squash" }]), /Unknown sport/);
  assert.throws(() => normalizeAssignments([]), /at least one/);
});

test("coordinator passwords are long and avoid look-alike characters", () => {
  const seen = new Set();
  for (let i = 0; i < 50; i += 1) {
    const password = makeCoordinatorPassword();
    assert.match(password, /^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/);
    seen.add(password);
  }
  assert.equal(seen.size, 50);
});

test("API bodies are validated strictly", () => {
  assert.ok(matchActionSchema.safeParse({ action: "score", version: 3, scoreA: 2, scoreB: 1 }).success);
  assert.ok(!matchActionSchema.safeParse({ action: "score", version: 3, scoreA: -1, scoreB: 1 }).success);
  assert.ok(!matchActionSchema.safeParse({ action: "score", scoreA: 1, scoreB: 1 }).success, "version is required");
  assert.ok(!matchActionSchema.safeParse({ action: "delete-everything", version: 1 }).success);
  assert.ok(!matchActionSchema.safeParse({ action: "details", version: 1, status: "completed" }).success);
  assert.ok(coordinatorCreateSchema.safeParse({ email: "a@iiitdm.ac.in", name: "A", sports: [{ sportId: "football" }] }).success);
  assert.ok(!coordinatorCreateSchema.safeParse({ email: "not-an-email", name: "A", sports: [{ sportId: "football" }] }).success);
  assert.ok(!coordinatorCreateSchema.safeParse({ email: "a@iiitdm.ac.in", name: "A", sports: [] }).success);
});

test("times are entered and shown in IST whatever the device's zone", () => {
  assert.equal(fromIstInput("2026-12-19T09:00"), "2026-12-19T03:30:00.000Z");
  assert.equal(toIstInput("2026-12-19T03:30:00.000Z"), "2026-12-19T09:00");
  assert.equal(fromIstInput("garbage"), "");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
});
