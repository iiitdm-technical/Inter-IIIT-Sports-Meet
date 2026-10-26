import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateRegistrationRules } from "../src/lib/validation/rules.js";
import { GLOBAL_RULES, getSportConfig } from "../src/lib/sports/config.js";
import { getLiveValidationErrors, getSlotKey } from "../src/lib/registration/client-utils.js";

const student = (rollNumber, gender = "M", name = `STUDENT ${rollNumber}`) => ({ rollNumber, name, gender });
const entry = (sportId, eventId, gender, rollNumber, isReserve = false) => ({ sportId, eventId, gender, rollNumber, isReserve });
const validate = (students, entries) => validateRegistrationRules({ students, entries });
const hasError = (result, text) => result.errors.some((message) => message.includes(text));

// A full men's relay team of four, used where a test needs a valid relay entry.
const menRelay = (eventId, rolls) => rolls.map((roll) => entry("athletics", eventId, "M", roll));

const contact = {
  contactName: "Dr A",
  contactEmail: "sports@iiitkota.ac.in",
  contactPhone: "+91 9876543210",
  arrivalDate: "2026-12-18",
  arrivalTime: "07:30",
  travelMode: "Train",
  notes: "",
};

describe("sport catalogue", () => {
  test("matches the rulebook parameters the rules depend on", () => {
    assert.equal(GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT, 150);
    assert.equal(GLOBAL_RULES.MAX_MALE_STUDENTS_PER_IIIT, 100);
    assert.equal(GLOBAL_RULES.MAX_FEMALE_STUDENTS_PER_IIIT, 50);
    assert.equal(GLOBAL_RULES.MAX_NORMAL_SPORTS_PER_STUDENT, 2);
    assert.equal(GLOBAL_RULES.MAX_ATHLETICS_INDIVIDUAL_EVENTS, 3);
    assert.equal(GLOBAL_RULES.MAX_AQUATICS_INDIVIDUAL_EVENTS, 3);
    assert.equal(getSportConfig("athletics").events.M.length, 15);
    assert.equal(getSportConfig("athletics").events.F.length, 12);
    assert.equal(getSportConfig("aquatics").events.M.length, 15);
    assert.equal(getSportConfig("aquatics").events.F.length, 11);
    assert.equal(getSportConfig("cricket").teamLimits.M, 15);
    assert.equal(getSportConfig("chess").teamLimits.mixed, 4);
  });
});

describe("validateRegistrationRules", () => {
  test("accepts a valid roster across team, athletics and aquatics", () => {
    const result = validate(
      [student("R1"), student("R2", "F"), student("R3"), student("R4"), student("R5")],
      [
        entry("cricket", "team", "M", "R1"),
        entry("volleyball", "team", "M", "R1"),
        entry("athletics", "100m", "M", "R1"),
        entry("athletics", "200m", "M", "R1"),
        entry("athletics", "long_jump", "M", "R1"),
        ...menRelay("4x100m_relay", ["R1", "R3", "R4", "R5"]),
        entry("aquatics", "50m_freestyle", "M", "R1"),
        entry("badminton", "team", "F", "R2"),
        entry("table_tennis", "team", "F", "R2"),
      ]
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.isValid, true);
    assert.deepEqual(result.issues, []);
  });

  test("accepts 100 men and 50 women and rejects a 151st student", () => {
    const roster = [
      ...Array.from({ length: 100 }, (_, i) => student(`M${i + 1}`, "M")),
      ...Array.from({ length: 50 }, (_, i) => student(`F${i + 1}`, "F")),
    ];
    const ok = validate(roster, []);
    assert.equal(ok.isValid, true);
    const over = validate([...roster, student("X151", "M")], []);
    assert.equal(over.isValid, false);
    assert.ok(hasError(over, "Maximum unique students limit exceeded"));
  });

  test("caps men at 100 and women at 50", () => {
    const men = Array.from({ length: 101 }, (_, i) => student(`M${i + 1}`, "M"));
    assert.ok(hasError(validate(men, []), "Maximum men limit exceeded"));
    assert.equal(hasError(validate(men.slice(0, 100), []), "Maximum men limit exceeded"), false);
    const women = Array.from({ length: 51 }, (_, i) => student(`F${i + 1}`, "F"));
    assert.ok(hasError(validate(women, []), "Maximum women limit exceeded"));
    assert.equal(hasError(validate(women.slice(0, 50), []), "Maximum women limit exceeded"), false);
  });

  test("counts a student entered in several events once", () => {
    const roster = Array.from({ length: 100 }, (_, i) => student(`R${i + 1}`));
    const entries = roster.flatMap(({ rollNumber }) => [
      entry("cricket", "team", "M", rollNumber),
      entry("athletics", "100m", "M", rollNumber),
    ]);
    assert.equal(hasError(validate(roster, entries), "Maximum unique students"), false);
  });

  test("accepts a mixed relay of exactly 2 men and 2 women", () => {
    const roster = [student("M1", "M"), student("M2", "M"), student("F1", "F"), student("F2", "F")];
    for (const [sportId, eventId] of [
      ["athletics", "mixed_4x100m_relay"],
      ["athletics", "mixed_4x400m_relay"],
      ["aquatics", "mixed_4x50m_freestyle_relay"],
      ["aquatics", "mixed_4x50m_medley_relay"],
    ]) {
      const result = validate(roster, roster.map(({ rollNumber }) => entry(sportId, eventId, "mixed", rollNumber)));
      assert.deepEqual(result.errors, [], `${sportId} ${eventId}`);
    }
  });

  test("rejects any other split or an incomplete mixed relay", () => {
    const threeMen = [student("M1", "M"), student("M2", "M"), student("M3", "M"), student("F1", "F")];
    const r1 = validate(threeMen, threeMen.map(({ rollNumber }) => entry("athletics", "mixed_4x100m_relay", "mixed", rollNumber)));
    assert.ok(hasError(r1, "allows 2 male runners"));
    const partial = [student("M1", "M"), student("F1", "F")];
    const r2 = validate(partial, partial.map(({ rollNumber }) => entry("aquatics", "mixed_4x50m_medley_relay", "mixed", rollNumber)));
    assert.ok(hasError(r2, "needs all 4 runners (2 men and 2 women)"));
    const withReserves = [student("M1", "M"), student("M2", "M"), student("F1", "F"), student("F2", "F"), student("M3", "M"), student("M4", "M")];
    const r3 = validate(withReserves, withReserves.map(({ rollNumber }, i) => entry("athletics", "mixed_4x400m_relay", "mixed", rollNumber, i >= 4)));
    assert.ok(hasError(r3, "allows 1 male reserves"));
    const oneEach = [...withReserves.slice(0, 5), student("F3", "F")];
    const r4 = validate(oneEach, oneEach.map(({ rollNumber }, i) => entry("athletics", "mixed_4x400m_relay", "mixed", rollNumber, i >= 4)));
    assert.deepEqual(r4.errors, []);
    const noReserves = withReserves.slice(0, 4);
    const r5 = validate(noReserves, noReserves.map(({ rollNumber }) => entry("athletics", "mixed_4x400m_relay", "mixed", rollNumber)));
    assert.deepEqual(r5.errors, []);
  });

  test("requires all 4 runners in every relay, with reserves optional", () => {
    const three = ["R1", "R2", "R3"].map((roll) => student(roll));
    assert.ok(hasError(validate(three, menRelay("4x400m_relay", ["R1", "R2", "R3"])), "needs all 4 runners"));
    const reserveOnly = validate([student("R1")], [entry("athletics", "4x100m_relay", "M", "R1", true)]);
    assert.ok(hasError(reserveOnly, "needs all 4 runners"));
    const four = ["R1", "R2", "R3", "R4"].map((roll) => student(roll));
    assert.deepEqual(validate(four, menRelay("4x100m_relay", ["R1", "R2", "R3", "R4"])).errors, []);
    const women = ["F1", "F2", "F3", "F4", "F5", "F6"].map((roll) => student(roll, "F"));
    const swim = women.map(({ rollNumber }, i) => entry("aquatics", "4x50m_medley_relay", "F", rollNumber, i >= 4));
    assert.deepEqual(validate(women, swim).errors, []);
  });

  test("does not count mixed relays toward the individual event limit", () => {
    const roster = [student("M1", "M"), student("M2", "M"), student("F1", "F"), student("F2", "F"), student("M3", "M"), student("M4", "M")];
    const entries = [
      ...["100m", "200m", "400m"].map((id) => entry("athletics", id, "M", "M1")),
      ...roster.slice(0, 4).map(({ rollNumber }) => entry("athletics", "mixed_4x100m_relay", "mixed", rollNumber)),
      ...menRelay("4x100m_relay", ["M1", "M2", "M3", "M4"]),
    ];
    assert.deepEqual(validate(roster, entries).errors, []);
  });

  test("rejects gender mismatches in men's and women's events", () => {
    assert.ok(hasError(validate([student("R1", "F")], [entry("cricket", "team", "M", "R1")]), "Gender mismatch"));
    assert.ok(hasError(validate([student("R1", "M")], [entry("volleyball", "team", "F", "R1")]), "Gender mismatch"));
    assert.equal(validate([student("R1", "F")], [entry("volleyball", "team", "F", "R1")]).isValid, true);
  });

  test("accepts both genders in the combined chess squad", () => {
    const result = validate(
      [student("R1", "M"), student("R2", "F")],
      [entry("chess", "team", "mixed", "R1"), entry("chess", "team", "mixed", "R2")]
    );
    assert.equal(result.isValid, true);
  });

  test("rejects the same student entered twice in one event", () => {
    const result = validate([student("R1")], [entry("athletics", "100m", "M", "R1"), entry("athletics", "100m", "M", "R1")]);
    assert.ok(hasError(result, "entered multiple times in athletics - 100m"));
  });

  test("rejects a duplicate roll number in the roster", () => {
    const result = validate([student("R1", "M", "A"), student("R1", "M", "B")], []);
    assert.ok(hasError(result, "Duplicate student roll number detected"));
  });

  test("rejects an entry for a student missing from the roster", () => {
    assert.ok(hasError(validate([], [entry("cricket", "team", "M", "R9")]), "unregistered student"));
  });

  test("rejects unknown sports, events and categories", () => {
    assert.ok(hasError(validate([student("R1")], [entry("quidditch", "team", "M", "R1")]), "Unrecognized sport ID"));
    assert.ok(hasError(validate([student("R1")], [entry("athletics", "marathon", "M", "R1")]), "Unrecognized event"));
    assert.ok(hasError(validate([student("R1")], [entry("cricket", "bowling", "M", "R1")]), "Unrecognized event"));
    assert.ok(hasError(validate([student("R1", "F")], [entry("cricket", "team", "F", "R1")]), "Unsupported category"));
    assert.ok(hasError(validate([student("R1")], [entry("cricket", "team", "mixed", "R1")]), "Unsupported category"));
    assert.ok(hasError(validate([student("R1")], [entry("athletics", "100m", "mixed", "R1")]), "Unrecognized event"));
  });

  test("cannot split a team across invented event ids to dodge the squad limit", () => {
    const roster = Array.from({ length: 16 }, (_, i) => student(`R${i + 1}`));
    const result = validate(roster, roster.map(({ rollNumber }, i) => entry("cricket", `team${i}`, "M", rollNumber)));
    assert.equal(result.isValid, false);
  });

  test("rejects a team squad over its limit", () => {
    const roster = Array.from({ length: 16 }, (_, i) => student(`R${i + 1}`));
    const result = validate(roster, roster.map(({ rollNumber }) => entry("cricket", "team", "M", rollNumber)));
    assert.ok(hasError(result, "Squad size exceeded for Cricket"));
  });

  test("rejects more than two main competitors in an athletics event", () => {
    const roster = [student("R1"), student("R2"), student("R3")];
    assert.equal(validate(roster.slice(0, 2), roster.slice(0, 2).map((s) => entry("athletics", "100m", "M", s.rollNumber))).isValid, true);
    const result = validate(roster, roster.map((s) => entry("athletics", "100m", "M", s.rollNumber)));
    assert.ok(hasError(result, "Competitor limit exceeded"));
  });

  test("rejects a fourth individual athletics event but ignores relays", () => {
    const team = ["R1", "R2", "R3", "R4"];
    const relaysOnly = validate(team.map((roll) => student(roll)), [
      entry("athletics", "100m", "M", "R1"),
      entry("athletics", "200m", "M", "R1"),
      entry("athletics", "400m", "M", "R1"),
      ...menRelay("4x100m_relay", team),
      ...menRelay("4x400m_relay", team),
    ]);
    assert.equal(relaysOnly.isValid, true);

    const result = validate([student("R1")], [
      entry("athletics", "100m", "M", "R1"),
      entry("athletics", "200m", "M", "R1"),
      entry("athletics", "400m", "M", "R1"),
      entry("athletics", "shot_put", "M", "R1"),
    ]);
    assert.ok(hasError(result, "Athletics event limit violated"));
  });

  test("rejects a fourth individual aquatics event", () => {
    const result = validate([student("R1")], [
      entry("aquatics", "50m_freestyle", "M", "R1"),
      entry("aquatics", "100m_freestyle", "M", "R1"),
      entry("aquatics", "50m_breaststroke", "M", "R1"),
      entry("aquatics", "100m_breaststroke", "M", "R1"),
    ]);
    assert.ok(hasError(result, "Aquatics event limit violated"));
  });

  test("rejects a third normal sport, with athletics and aquatics exempt", () => {
    const exempt = validate([student("R1")], [
      entry("cricket", "team", "M", "R1"),
      entry("volleyball", "team", "M", "R1"),
      entry("athletics", "100m", "M", "R1"),
      entry("aquatics", "50m_freestyle", "M", "R1"),
    ]);
    assert.equal(exempt.isValid, true);

    const result = validate([student("R1")], [
      entry("cricket", "team", "M", "R1"),
      entry("volleyball", "team", "M", "R1"),
      entry("basketball", "team", "M", "R1"),
    ]);
    assert.ok(hasError(result, "Multi-sport rule violated"));
  });

  test("rejects reserves where none are allowed", () => {
    assert.ok(hasError(validate([student("R1")], [entry("cricket", "team", "M", "R1", true)]), "does not allow reserve"));
    assert.ok(hasError(validate([student("R1")], [entry("aquatics", "50m_freestyle", "M", "R1", true)]), "does not allow reserve"));
    assert.equal(validate([student("R1")], [entry("athletics", "100m", "M", "R1", true)]).isValid, true);
  });

  test("accepts a roster with a single sport", () => {
    assert.equal(validate([student("R1")], [entry("cricket", "team", "M", "R1")]).isValid, true);
  });

  test("returns one issue per error with the targets it refers to", () => {
    const result = validate([student("R1", "F")], [entry("cricket", "team", "M", "R1")]);
    assert.equal(result.issues.length, result.errors.length);
    assert.deepEqual(result.issues.map((issue) => issue.message), result.errors);
    const [issue] = result.issues;
    assert.deepEqual(issue.rolls, ["R1"]);
    assert.equal(issue.sportId, "cricket");
    assert.equal(issue.gender, "M");
  });
});

describe("getLiveValidationErrors", () => {
  test("passes a valid form and builds the submission payload", () => {
    const slots = {
      [getSlotKey("cricket", "team", "M", "main", 0)]: { rollNumber: " r1 ", name: "ravi", gender: "M" },
      [getSlotKey("chess", "team", "mixed", "main", 0)]: { rollNumber: "R2", name: "ANITA", gender: "F" },
    };
    const result = getLiveValidationErrors(contact, slots);
    assert.deepEqual(result.errors, []);
    assert.equal(result.isValid, true);
    assert.equal(result.totalUniqueStudents, 2);
    assert.equal(result.payload.students[0].rollNumber, "R1");
  });

  test("links each rule issue to the slot that caused it", () => {
    const badKey = getSlotKey("kabaddi", "team", "M", "main", 0);
    const goodKey = getSlotKey("athletics", "100m", "F", "main", 0);
    const result = getLiveValidationErrors(contact, {
      [badKey]: { rollNumber: "K1", name: "ANITA", gender: "F" },
      [goodKey]: { rollNumber: "K1", name: "ANITA", gender: "F" },
    });
    const mismatch = result.issues.find((issue) => issue.message.includes("Gender mismatch"));
    assert.ok(mismatch);
    assert.deepEqual(mismatch.slotKeys, [badKey]);
  });

  test("links an over-limit squad to every slot in that squad", () => {
    const slots = {};
    for (let i = 0; i < 16; i++) {
      slots[getSlotKey("cricket", "team", "M", "main", i)] = { rollNumber: `C${i}`, name: `PLAYER ${i}`, gender: "M" };
    }
    const result = getLiveValidationErrors(contact, slots);
    const squad = result.issues.find((issue) => issue.message.includes("Squad size exceeded"));
    assert.equal(squad.slotKeys.length, 16);
  });

  test("links conflicting names to every slot with that roll number", () => {
    const first = getSlotKey("cricket", "team", "M", "main", 0);
    const second = getSlotKey("volleyball", "team", "M", "main", 0);
    const result = getLiveValidationErrors(contact, {
      [first]: { rollNumber: "R1", name: "RAVI", gender: "M" },
      [second]: { rollNumber: "R1", name: "RAVI KUMAR", gender: "M" },
    });
    const conflict = result.issues.find((issue) => issue.message.includes("Conflicting names"));
    assert.deepEqual(conflict.slotKeys.sort(), [first, second].sort());
  });

  test("points contact field problems at the matching input", () => {
    const result = getLiveValidationErrors({ ...contact, contactEmail: "not-an-email" }, {
      [getSlotKey("cricket", "team", "M", "main", 0)]: { rollNumber: "R1", name: "RAVI", gender: "M" },
    });
    const email = result.issues.find((issue) => issue.fieldId === "contact-email");
    assert.ok(email);
    assert.deepEqual(email.slotKeys, []);
  });

  test("never sends slot keys in the submission JSON", () => {
    const result = getLiveValidationErrors(contact, {
      [getSlotKey("cricket", "team", "M", "main", 0)]: { rollNumber: "R1", name: "RAVI", gender: "M" },
    });
    assert.ok(Array.isArray(result.payload.entryKeys));
    const json = JSON.parse(JSON.stringify(result.payload));
    assert.deepEqual(Object.keys(json).sort(), ["contactDetails", "entries", "students"]);
  });

  test("blocks a woman in a man's mixed relay slot", () => {
    const slots = {
      [getSlotKey("athletics", "100m", "F", "main", 0)]: { rollNumber: "R1", name: "ASHA", gender: "F" },
      [getSlotKey("athletics", "mixed_4x100m_relay", "mixed", "main", 0)]: { rollNumber: "R1", name: "ASHA", gender: "M" },
    };
    const issue = getLiveValidationErrors(contact, slots).issues.find((i) => i.message.includes("slot for the other gender"));
    assert.ok(issue);
    assert.equal(issue.slotKeys.length, 2);
  });

  test("reports the unique student limit without a slot", () => {
    const slots = {};
    for (let i = 0; i < 151; i++) {
      slots[getSlotKey("athletics", "100m", "M", "main", i)] = { rollNumber: `R${i}`, name: `S ${i}`, gender: "M" };
    }
    const limit = getLiveValidationErrors(contact, slots).issues.find((issue) => issue.message.startsWith("Maximum 150"));
    assert.ok(limit);
    assert.deepEqual(limit.slotKeys, []);
  });
});

describe("sport catalogue changes", () => {
  test("handball replaces squash with 14-player men's and women's squads", async () => {
    const { getSportConfig } = await import("../src/lib/sports/config.js");
    assert.equal(getSportConfig("squash"), null);
    const handball = getSportConfig("handball");
    assert.deepEqual(handball.genders, ["M", "F"]);
    assert.deepEqual(handball.teamLimits, { M: 14, F: 14 });
  });

  test("mixed relays exist in athletics and aquatics", async () => {
    const { getSportConfig } = await import("../src/lib/sports/config.js");
    const ids = (sport) => getSportConfig(sport).events.mixed.map((event) => event.id);
    assert.deepEqual(ids("athletics"), ["mixed_4x100m_relay", "mixed_4x400m_relay"]);
    assert.deepEqual(ids("aquatics"), ["mixed_4x50m_freestyle_relay", "mixed_4x50m_medley_relay"]);
  });

  test("draft slots for a removed sport are ignored, not submitted or charged", async () => {
    const { buildSubmissionPayload, getLiveValidationErrors, getStudentRegistry } = await import("../src/lib/registration/client-utils.js");
    const contact = { contactName: "Dr A", contactEmail: "a@example.com", contactPhone: "+91 9876543210", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", notes: "" };
    const slots = {
      "squash|team|M|main|0": { rollNumber: "OLD1", name: "OLD", gender: "M" },
      "handball|team|M|main|0": { rollNumber: "H1", name: "HANDBALL ONE", gender: "M" },
    };
    const payload = buildSubmissionPayload(contact, slots);
    assert.deepEqual(payload.students.map((s) => s.rollNumber), ["H1"]);
    assert.deepEqual(payload.entries.map((e) => e.sportId), ["handball"]);
    assert.equal(getStudentRegistry(slots).has("OLD1"), false);
    assert.equal(getLiveValidationErrors(contact, slots).issues.some((i) => /squash|OLD1/i.test(i.message)), false);
  });
});
