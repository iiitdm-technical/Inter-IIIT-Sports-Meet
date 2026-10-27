import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildEditableDraft, createRosterVersion } from "../src/lib/registration/roster-version.js";

const registration = {
  id: 7,
  iiitCode: "iiit-test",
  iiitName: "Test Institute",
  status: "payment_pending",
  submittedAt: new Date("2026-10-27T12:00:00.000Z"),
  submittedBy: "test-user",
  contactName: "Sports Coordinator",
  contactEmail: "sports@example.org",
  contactPhone: "1234567890",
  arrivalDate: "2026-12-18",
  arrivalTime: "07:30",
  travelMode: "Train",
  arrivalPoint: "Tambaram",
  departureDate: "2026-12-23",
  boysSecretaryName: "Boys Secretary",
  boysSecretaryPhone: "1234567890",
  boysSecretaryEmail: "boys@iiit-test.ac.in",
  girlsSecretaryName: "Girls Secretary",
  girlsSecretaryPhone: "1234567891",
  girlsSecretaryEmail: "girls@iiit-test.ac.in",
  boysCount: 1,
  girlsCount: 0,
  staffCount: 2,
  notes: null,
  totalStudentsCount: 1,
};
const roster = [
  { rollNumber: "R1", name: "STUDENT ONE", gender: "M" },
  { rollNumber: "R2", name: "STUDENT TWO", gender: "F" },
];
const entries = [
  { rollNumber: "R1", sportId: "athletics", eventId: "100m", gender: "M", isReserve: false },
  { rollNumber: "R2", sportId: "athletics", eventId: "200m", gender: "F", isReserve: false },
];

describe("registration roster version", () => {
  test("is a deterministic SHA-256 token regardless of row order", () => {
    const first = createRosterVersion(registration, roster, entries);
    const second = createRosterVersion(registration, [...roster].reverse(), [...entries].reverse());
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(first, second);
  });

  test("changes when authoritative contact or roster data changes", () => {
    const version = createRosterVersion(registration, roster, entries);
    assert.notEqual(version, createRosterVersion({ ...registration, contactName: "Updated" }, roster, entries));
    assert.notEqual(version, createRosterVersion(registration, [{ ...roster[0], name: "UPDATED" }], entries));
    assert.notEqual(version, createRosterVersion(registration, roster, [{ ...entries[0], eventId: "200m" }]));
    const addedStudent = { rollNumber: "R3", name: "STUDENT THREE", gender: "M" };
    assert.notEqual(version, createRosterVersion(
      { ...registration, totalStudentsCount: 3 },
      [...roster, addedStudent],
      [...entries, { rollNumber: "R3", sportId: "athletics", eventId: "400m", gender: "M", isReserve: false }],
    ));
    assert.notEqual(version, createRosterVersion({
      ...registration,
      submittedAt: new Date(registration.submittedAt.getTime() + 1),
    }, roster, entries));
  });

  test("reconstructs contact fields and indexed slots from persisted entries", () => {
    const editableDraft = buildEditableDraft(registration, [
      { id: 1, sportId: "athletics", eventId: "100m", gender: "M", isReserve: false, rollNumber: "R1", studentName: "STUDENT ONE", studentGender: "M" },
      { id: 2, sportId: "athletics", eventId: "100m", gender: "M", isReserve: true, rollNumber: "R1", studentName: "STUDENT ONE", studentGender: "M" },
    ]);

    assert.equal(editableDraft.contactDetails.contactName, "Sports Coordinator");
    assert.equal(editableDraft.contactDetails.staffCount, "2");
    assert.deepEqual(editableDraft.slotsMap, {
      "athletics|100m|M|main|0": { rollNumber: "R1", name: "STUDENT ONE", gender: "M" },
      "athletics|100m|M|reserve|0": { rollNumber: "R1", name: "STUDENT ONE", gender: "M" },
    });
    assert.equal(Object.hasOwn(editableDraft, "revision"), false);
  });

  test("restores fixed-gender mixed relay slots regardless of entry row order", () => {
    for (const [sportId, eventId] of [
      ["athletics", "mixed_4x100m_relay"],
      ["aquatics", "mixed_4x50m_freestyle_relay"],
    ]) {
      const rows = [
        { sportId, eventId, gender: "mixed", isReserve: false, rollNumber: "F1", studentName: "FEMALE ONE", studentGender: "F" },
        { sportId, eventId, gender: "mixed", isReserve: false, rollNumber: "M1", studentName: "MALE ONE", studentGender: "M" },
        { sportId, eventId, gender: "mixed", isReserve: false, rollNumber: "F2", studentName: "FEMALE TWO", studentGender: "F" },
        { sportId, eventId, gender: "mixed", isReserve: false, rollNumber: "M2", studentName: "MALE TWO", studentGender: "M" },
        { sportId, eventId, gender: "mixed", isReserve: true, rollNumber: "FR", studentName: "FEMALE RESERVE", studentGender: "F" },
      ];
      const { slotsMap } = buildEditableDraft(registration, rows);
      assert.equal(slotsMap[`${sportId}|${eventId}|mixed|main|0`].rollNumber, "M1");
      assert.equal(slotsMap[`${sportId}|${eventId}|mixed|main|1`].rollNumber, "M2");
      assert.equal(slotsMap[`${sportId}|${eventId}|mixed|main|2`].rollNumber, "F1");
      assert.equal(slotsMap[`${sportId}|${eventId}|mixed|main|3`].rollNumber, "F2");
      assert.equal(slotsMap[`${sportId}|${eventId}|mixed|reserve|1`].rollNumber, "FR");
      assert.equal(Object.hasOwn(slotsMap, `${sportId}|${eventId}|mixed|reserve|0`), false);
    }
  });
});
