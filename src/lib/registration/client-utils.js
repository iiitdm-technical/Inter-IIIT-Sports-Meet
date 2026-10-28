import { validateRegistrationRules } from "../validation/rules.js";
import { normalizeRoll, normalizeName } from "./identity.js";
import { getCategoryLabel, getEventName, getSportName } from "./labels.js";
import { GLOBAL_RULES, getSportConfig } from "../sports/config.js";
import { registrationSubmitSchema } from "../validation/schemas.js";

/**
 * Parses a slot key into its components
 * Format: sportId|eventId|eventGender|role|index
 */
export function parseSlotKey(key) {
  const parts = key.split("|");
  if (parts.length !== 5) return null;
  return {
    sportId: parts[0],
    eventId: parts[1],
    eventGender: parts[2],
    role: parts[3], // 'main' or 'reserve'
    index: parseInt(parts[4], 10),
  };
}

/**
 * True when a slot still belongs to a sport, category and event in the
 * catalogue. Drafts saved before a sport or event was removed (in the cloud
 * or in browser storage) may still hold such slots; they are ignored rather
 * than submitted, counted for the fee, or shown as errors with no field.
 */
export function isKnownSlot(parsed) {
  const sport = parsed && getSportConfig(parsed.sportId);
  if (!sport || !sport.genders.includes(parsed.eventGender)) return false;
  if (sport.type === "team" || sport.type === "combined_team") return parsed.eventId === "team";
  return (sport.events?.[parsed.eventGender] || []).some((event) => event.id === parsed.eventId);
}

/**
 * Generates a slot key
 */
export function getSlotKey(sportId, eventId, eventGender, role, index) {
  return `${sportId}|${eventId}|${eventGender}|${role}|${index}`;
}

/**
 * Transforms flat form state into the backend submission payload
 *
 * @param {Object} contactDetails
 * @param {Object} slotsMap - { [slotKey]: { rollNumber, name, gender } }
 * @returns {Object} payload { contactDetails, students, entries }
 */
export function buildSubmissionPayload(contactDetails, slotsMap) {
  const studentsMap = new Map();
  const entries = [];
  const entryKeys = [];

  for (const [key, slotData] of Object.entries(slotsMap)) {
    if (!slotData || !slotData.rollNumber) continue;

    const roll = normalizeRoll(slotData.rollNumber);
    if (!roll) continue;

    const parsed = parseSlotKey(key);
    if (!isKnownSlot(parsed)) continue;

    const name = normalizeName(slotData.name);
    const gender = slotData.gender || "M";

    if (!studentsMap.has(roll)) {
      studentsMap.set(roll, { rollNumber: roll, name, gender });
    }

    entries.push({
      sportId: parsed.sportId,
      eventId: parsed.eventId,
      gender: parsed.eventGender,
      rollNumber: roll,
      isReserve: parsed.role === "reserve",
    });
    entryKeys.push(key);
  }

  const payload = {
    contactDetails,
    students: Array.from(studentsMap.values()),
    entries,
  };
  // Slot key of each entry, kept off the payload so it is never submitted.
  Object.defineProperty(payload, "entryKeys", { value: entryKeys, enumerable: false });
  return payload;
}

/**
 * Gets student registry (unique students and their details) from current slots
 */
export function getStudentRegistry(slotsMap) {
  const registry = new Map();
  for (const [key, slotData] of Object.entries(slotsMap)) {
    if (!slotData || !slotData.rollNumber || !isKnownSlot(parseSlotKey(key))) continue;
    const roll = normalizeRoll(slotData.rollNumber);
    if (roll) {
      if (!registry.has(roll)) {
        registry.set(roll, {
          rollNumber: roll,
          name: slotData.name,
          gender: slotData.gender,
        });
      } else {
        // Update name/gender if it was empty previously and now provided
        const existing = registry.get(roll);
        if (!existing.name && slotData.name) {
           existing.name = slotData.name;
        }
      }
    }
  }
  return registry;
}

const CONTACT_FIELD_IDS = {
  contactName: "contact-name",
  contactEmail: "contact-email",
  contactPhone: "contact-phone",
  arrivalDate: "contact-arrival-date",
  arrivalTime: "contact-arrival-time",
  travelMode: "contact-travel-mode",
  arrivalPoint: "contact-arrival-point",
  departureDate: "contact-departure-date",
  boysSecretaryName: "contact-boys-secretary-name",
  boysSecretaryPhone: "contact-boys-secretary-phone",
  boysSecretaryEmail: "contact-boys-secretary-email",
  girlsSecretaryName: "contact-girls-secretary-name",
  girlsSecretaryPhone: "contact-girls-secretary-phone",
  girlsSecretaryEmail: "contact-girls-secretary-email",
  boysTravelling: "contact-boys-travelling",
  girlsTravelling: "contact-girls-travelling",
  staffCount: "contact-staff-count",
  notes: "contact-notes",
};

/**
 * DOM id of the roll number input for a slot, used to focus it from an error.
 */
export function getSlotInputId(slotKey) {
  return `slot-${slotKey.replace(/[^a-zA-Z0-9_-]/g, "-")}-roll`;
}

/** Where a slot is on the form, e.g. "Cricket Men Squad" or "Athletics Men 100 M (reserve)". */
export function describeSlot(slotKey) {
  const slot = parseSlotKey(slotKey);
  if (!slot) return slotKey;
  const label = `${getSportName(slot.sportId)} ${getCategoryLabel(slot.eventGender)} ${getEventName(slot.sportId, slot.eventId, slot.eventGender)}`;
  return slot.role === "reserve" ? `${label} (reserve)` : label;
}

/**
 * Finds the filled slots a rule issue refers to.
 */
function findIssueSlotKeys(issue, slotsMap) {
  const hasTarget = issue.rolls || issue.sportId || issue.sportIds || issue.eventId || issue.gender;
  if (!hasTarget) return [];
  const keys = [];
  for (const [key, slotData] of Object.entries(slotsMap)) {
    const roll = normalizeRoll(slotData?.rollNumber);
    if (!roll) continue;
    const slot = parseSlotKey(key);
    if (!slot) continue;
    if (issue.rolls && !issue.rolls.includes(roll)) continue;
    if (issue.sportId && slot.sportId !== issue.sportId) continue;
    if (issue.sportIds && !issue.sportIds.includes(slot.sportId)) continue;
    if (issue.eventId && slot.eventId !== issue.eventId) continue;
    if (issue.gender && slot.eventGender !== issue.gender) continue;
    keys.push(key);
  }
  return keys;
}

function describeSchemaIssue(issue, payload, slotsMap) {
  const [section, index, field] = issue.path;
  if (section === "contactDetails") {
    return { message: issue.message, slotKeys: [], fieldId: CONTACT_FIELD_IDS[index] || null };
  }
  if (section === "students" && typeof index === "number") {
    const roll = payload.students[index]?.rollNumber;
    return {
      message: `Student ${index + 1}${roll ? ` (${roll})` : ""}: ${issue.message}`,
      slotKeys: roll ? findIssueSlotKeys({ rolls: [roll] }, slotsMap) : [],
      fieldId: null,
    };
  }
  if (section === "entries" && typeof index === "number") {
    const key = payload.entryKeys?.[index];
    return {
      message: `Event entry ${index + 1}${field ? ` (${field})` : ""}: ${issue.message}`,
      slotKeys: key ? [key] : [],
      fieldId: null,
    };
  }
  return { message: issue.message, slotKeys: [], fieldId: null };
}

/**
 * Analyzes form state and returns live validation errors.
 * `issues` carries the same messages with the slot keys or contact field each
 * one refers to, so the form can highlight and jump to them.
 */
export function getLiveValidationErrors(contactDetails, allSlots) {
  // Slots of removed sports or events are inert and never block submission.
  const slotsMap = Object.fromEntries(Object.entries(allSlots).filter(([key]) => isKnownSlot(parseSlotKey(key))));
  const payload = buildSubmissionPayload(contactDetails, slotsMap);
  const issues = [];

  // 1. Check if over the unique student limit
  if (payload.students.length > GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT) {
    issues.push({
      message: `Maximum ${GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT} unique students allowed. You have ${payload.students.length}.`,
      slotKeys: [],
      fieldId: null,
    });
  }

  // 2. One roll number, one name: report every name used and where, once per roll number.
  const namesByRoll = new Map(); // roll -> Map(name -> [slotKeys])
  for (const [key, slotData] of Object.entries(slotsMap)) {
    const roll = normalizeRoll(slotData?.rollNumber);
    const name = normalizeName(slotData?.name);
    if (!roll || !name) continue;
    if (!namesByRoll.has(roll)) namesByRoll.set(roll, new Map());
    const names = namesByRoll.get(roll);
    names.set(name, [...(names.get(name) || []), key]);
  }
  for (const [roll, names] of namesByRoll) {
    if (names.size < 2) continue;
    const where = [...names].map(([name, keys]) => `"${name}" in ${keys.map(describeSlot).join(", ")}`);
    issues.push({
      message: `Roll number ${roll} is entered with ${names.size} different names: ${where.join("; ")}. Use the same name in every event.`,
      slotKeys: [...names.values()].flat(),
      fieldId: null,
      kind: "name-conflict",
    });
  }

  // 2b. One student, one gender: a roll number entered as a woman cannot also
  // fill a man's slot (e.g. a mixed relay "Man" slot), and vice versa.
  const genderSlots = new Map(); // roll -> { M: [slotKeys], F: [slotKeys] }
  for (const [key, slotData] of Object.entries(slotsMap)) {
    const roll = normalizeRoll(slotData?.rollNumber);
    if (!roll || (slotData.gender !== "M" && slotData.gender !== "F")) continue;
    if (!genderSlots.has(roll)) genderSlots.set(roll, { M: [], F: [] });
    genderSlots.get(roll)[slotData.gender].push(key);
  }
  for (const [roll, byGender] of genderSlots) {
    if (byGender.M.length && byGender.F.length) {
      issues.push({
        message: `Roll number ${roll} is entered as male in one slot and female in another. A student cannot be placed in a slot for the other gender.`,
        slotKeys: [...byGender.M, ...byGender.F],
        fieldId: null,
      });
    }
  }

  // 3. Use the authoritative business rules
  if (payload.entries.length > 0) {
    const ruleResult = validateRegistrationRules(payload);
    for (const issue of ruleResult.issues) {
      issues.push({ message: issue.message, slotKeys: findIssueSlotKeys(issue, slotsMap), fieldId: null });
    }
  }

  // 4. Validate schema (contact details, missing fields, etc)
  const parsed = registrationSubmitSchema.safeParse(payload);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      issues.push(describeSchemaIssue(issue, payload, slotsMap));
    });
  }

  return {
    isValid: issues.length === 0,
    errors: issues.map((issue) => issue.message),
    issues,
    payload,
    totalUniqueStudents: payload.students.length
  };
}
