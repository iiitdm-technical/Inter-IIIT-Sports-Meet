import { validateRegistrationRules } from "../validation/rules.js";
import { GLOBAL_RULES } from "../sports/config.js";
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

  for (const [key, slotData] of Object.entries(slotsMap)) {
    if (!slotData || !slotData.rollNumber) continue;

    const roll = slotData.rollNumber.trim().toUpperCase();
    if (!roll) continue;

    const name = (slotData.name || "").trim().toUpperCase();
    const gender = slotData.gender || "M";

    if (!studentsMap.has(roll)) {
      studentsMap.set(roll, { rollNumber: roll, name, gender });
    }

    const parsed = parseSlotKey(key);
    if (!parsed) continue;

    entries.push({
      sportId: parsed.sportId,
      eventId: parsed.eventId,
      gender: parsed.eventGender,
      rollNumber: roll,
      isReserve: parsed.role === "reserve",
    });
  }

  return {
    contactDetails,
    students: Array.from(studentsMap.values()),
    entries,
  };
}

/**
 * Gets student registry (unique students and their details) from current slots
 */
export function getStudentRegistry(slotsMap) {
  const registry = new Map();
  for (const slotData of Object.values(slotsMap)) {
    if (!slotData || !slotData.rollNumber) continue;
    const roll = slotData.rollNumber.trim().toUpperCase();
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

function describeSchemaIssue(issue, payload) {
  const [section, index] = issue.path;
  if (section === "contactDetails") return issue.message;
  if (section === "students") {
    if (typeof index !== "number") return issue.message;
    const roll = payload.students[index]?.rollNumber;
    return `Student ${index + 1}${roll ? ` (${roll})` : ""}: ${issue.message}`;
  }
  if (section === "entries") {
    if (typeof index !== "number") return issue.message;
    return `Event entry ${index + 1}: ${issue.message}`;
  }
  return issue.message;
}

/**
 * Analyzes form state and returns live validation errors
 */
export function getLiveValidationErrors(contactDetails, slotsMap) {
  const payload = buildSubmissionPayload(contactDetails, slotsMap);
  const errors = [];

  // 1. Check if over 150 unique students
  if (payload.students.length > GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT) {
    errors.push(`Maximum ${GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT} unique students allowed. You have ${payload.students.length}.`);
  }

  // 2. Check for conflicting names for the same roll number
  const nameMap = new Map();
  for (const [key, slotData] of Object.entries(slotsMap)) {
    if (!slotData || !slotData.rollNumber) continue;
    const roll = slotData.rollNumber.trim().toUpperCase();
    const name = (slotData.name || "").trim().toUpperCase();
    if (roll && name) {
      if (nameMap.has(roll) && nameMap.get(roll) !== name) {
        errors.push(`Conflicting names for roll number ${roll}: "${nameMap.get(roll)}" vs "${name}"`);
      }
      nameMap.set(roll, name);
    }
  }

  // 3. Use the authoritative business rules
  if (payload.entries.length > 0) {
    const ruleResult = validateRegistrationRules(payload);
    if (!ruleResult.isValid) {
      errors.push(...ruleResult.errors);
    }
  }

  // 4. Validate schema (contact details, missing fields, etc)
  const parsed = registrationSubmitSchema.safeParse(payload);
  if (!parsed.success) {
    parsed.error.issues.forEach(issue => {
      errors.push(describeSchemaIssue(issue, payload));
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    payload,
    totalUniqueStudents: payload.students.length
  };
}
