import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateRegistrationRules } from "../src/lib/validation/rules.js";
import { GLOBAL_RULES, getSportConfig } from "../src/lib/sports/config.js";
import { getLiveValidationErrors, getSlotKey } from "../src/lib/registration/client-utils.js";

const student = (rollNumber, gender = "M", name = `STUDENT ${rollNumber}`) => ({ rollNumber, name, gender });
const entry = (sportId, eventId, gender, rollNumber, isReserve = false) => ({ sportId, eventId, gender, rollNumber, isReserve });
const validate = (students, entries) => validateRegistrationRules({ students, entries });
const hasError = (result, text) => result.errors.some((message) => message.includes(text));

const contact = {
  contactName: "Dr A",
  contactEmail: "sports@iiitkota.ac.in",
  contactPhone: "+91 9876543210",
  notes: "",
};

describe("sport catalogue", () => {
  test("matches the rulebook parameters the rules depend on", () => {
    assert.equal(GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT, 150);
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
      [student("R1"), student("R2", "F")],
      [
        entry("cricket", "team", "M", "R1"),
        entry("volleyball", "team", "M", "R1"),
        entry("athletics", "100m", "M", "R1"),
        entry("athletics", "200m", "M", "R1"),
        entry("athletics", "long_jump", "M", "R1"),
        entry("athletics", "4x100m_relay", "M", "R1"),
        entry("aquatics", "50m_freestyle", "M", "R1"),
        entry("badminton", "team", "F", "R2"),
        entry("table_tennis", "team", "F", "R2"),
      ]
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.isValid, true);
    assert.deepEqual(result.issues, []);
  });

  test("accepts 150 unique students and rejects 151", () => {
    const roster = Array.from({ length: 150 }, (_, i) => student(`R${i + 1}`));
    assert.equal(hasError(validate(roster, []), "Maximum unique students"), false);
    const over = validate([...roster, student("R151")], []);
    assert.equal(over.isValid, false);
    assert.ok(hasError(over, "Maximum unique students limit exceeded"));
  });

  test("counts a student entered in several events once", () => {
    const roster = Array.from({ length: 150 }, (_, i) => student(`R${i + 1}`));
    const entries = roster.flatMap(({ rollNumber }) => [
      entry("cricket", "team", "M", rollNumber),
      entry("athletics", "100m", "M", rollNumber),
    ]);
    assert.equal(hasError(validate(roster, entries), "Maximum unique students"), false);
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
    assert.ok(hasError(validate([student("R1")], [entry("athletics", "100m", "mixed", "R1")]), "Unsupported category"));
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
    const relaysOnly = validate([student("R1")], [
      entry("athletics", "100m", "M", "R1"),
      entry("athletics", "200m", "M", "R1"),
      entry("athletics", "400m", "M", "R1"),
      entry("athletics", "4x100m_relay", "M", "R1"),
      entry("athletics", "4x400m_relay", "M", "R1"),
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
