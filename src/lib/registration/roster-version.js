import { createHash } from "node:crypto";
import { getSportConfig } from "../sports/config.js";

const VERSIONED_REGISTRATION_FIELDS = [
  "id",
  "iiitCode",
  "iiitName",
  "status",
  "submittedAt",
  "submittedBy",
  "contactName",
  "contactEmail",
  "contactPhone",
  "arrivalDate",
  "arrivalTime",
  "travelMode",
  "arrivalPoint",
  "departureDate",
  "boysSecretaryName",
  "boysSecretaryPhone",
  "boysSecretaryEmail",
  "girlsSecretaryName",
  "girlsSecretaryPhone",
  "girlsSecretaryEmail",
  "boysCount",
  "girlsCount",
  "staffCount",
  "notes",
  "totalStudentsCount",
];

function comparableDate(value) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Build a deterministic token for the persisted registration state. It is a
 * concurrency precondition, not a credential; all versioned data is read
 * from the database by the caller.
 */
export function createRosterVersion(registration, roster, entries) {
  const registrationState = VERSIONED_REGISTRATION_FIELDS.map((field) =>
    field === "submittedAt" ? comparableDate(registration[field]) : registration[field] ?? null
  );
  const rosterState = roster
    .map(({ rollNumber, name, gender }) => [rollNumber, name, gender])
    .sort((a, b) => compareText(a[0], b[0]));
  const entriesState = entries
    .map(({ rollNumber, sportId, eventId, gender, isReserve }) => [
      rollNumber,
      sportId,
      eventId,
      gender,
      Boolean(isReserve),
    ])
    .sort((a, b) => compareText(JSON.stringify(a), JSON.stringify(b)));

  return createHash("sha256")
    .update(JSON.stringify([registrationState, rosterState, entriesState]))
    .digest("hex");
}

/** Rebuild the registration form's editable fields from persisted records. */
export function buildEditableDraft(registration, participationRows) {
  const contactDetails = {
    contactName: registration.contactName,
    contactEmail: registration.contactEmail,
    contactPhone: registration.contactPhone,
    arrivalDate: registration.arrivalDate || "",
    arrivalTime: registration.arrivalTime || "",
    travelMode: registration.travelMode || "",
    arrivalPoint: registration.arrivalPoint || "",
    departureDate: registration.departureDate || "",
    boysSecretaryName: registration.boysSecretaryName || "",
    boysSecretaryPhone: registration.boysSecretaryPhone || "",
    boysSecretaryEmail: registration.boysSecretaryEmail || "",
    girlsSecretaryName: registration.girlsSecretaryName || "",
    girlsSecretaryPhone: registration.girlsSecretaryPhone || "",
    girlsSecretaryEmail: registration.girlsSecretaryEmail || "",
    staffCount: registration.staffCount == null ? "" : String(registration.staffCount),
    notes: registration.notes || "",
  };

  const slotsMap = {};
  const nextIndex = new Map();
  const usedFixedIndexes = new Map();
  for (const row of participationRows) {
    const role = row.isReserve ? "reserve" : "main";
    const groupKey = `${row.sportId}|${row.eventId}|${row.gender}|${role}`;
    const event = getSportConfig(row.sportId)?.events?.[row.gender]
      ?.find((candidate) => candidate.id === row.eventId);
    const fixedGenders = row.isReserve ? event?.reserveGenders : event?.slotGenders;
    let index;

    if (Array.isArray(fixedGenders)) {
      const used = usedFixedIndexes.get(groupKey) || new Set();
      index = fixedGenders.findIndex((gender, candidateIndex) =>
        gender === row.studentGender && !used.has(candidateIndex)
      );
      // Valid registrations have a matching fixed-gender slot. If persisted
      // legacy data does not, use the first remaining slot so no entry is
      // silently overwritten while rebuilding the form state.
      if (index < 0) index = fixedGenders.findIndex((_, candidateIndex) => !used.has(candidateIndex));
      if (index < 0) {
        index = fixedGenders.length;
        while (used.has(index)) index += 1;
      }
      used.add(index);
      usedFixedIndexes.set(groupKey, used);
    } else {
      index = nextIndex.get(groupKey) || 0;
      nextIndex.set(groupKey, index + 1);
    }

    slotsMap[`${groupKey}|${index}`] = {
      rollNumber: row.rollNumber,
      name: row.studentName,
      gender: row.studentGender,
    };
  }

  return { contactDetails, slotsMap };
}
