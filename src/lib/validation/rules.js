import { GLOBAL_RULES, getSportConfig } from "../sports/config.js";
import { normalizeRoll, normalizeName } from "../registration/identity.js";

function describeSplit(genders) {
  const men = genders.filter((g) => g === "M").length;
  const women = genders.filter((g) => g === "F").length;
  return `${men} ${men === 1 ? "man" : "men"} and ${women} ${women === 1 ? "woman" : "women"}`;
}

/**
 * Business Rule Validator for Inter-IIIT Sports Meet Registrations.
 *
 * @param {Object} payload
 * @param {Array} payload.students - Array of { rollNumber, name, gender }
 * @param {Array} payload.entries - Array of { sportId, eventId, gender, rollNumber, isReserve }
 * @returns {{ isValid: boolean, errors: string[], issues: Array }}
 *   `issues` mirrors `errors` with the roll numbers, sport, event and category
 *   each message refers to, so the form can point to the offending slots.
 */
export function validateRegistrationRules({ students, entries }) {
  const errors = [];
  const issues = [];
  const fail = (message, target = {}) => {
    errors.push(message);
    issues.push({ message, ...target });
  };

  // 1. Validate total unique students <= 150
  const uniqueRollNumbers = new Set();
  const studentMap = new Map(); // rollNumber -> { rollNumber, name, gender }

  for (const s of students) {
    const roll = normalizeRoll(s.rollNumber);
    if (uniqueRollNumbers.has(roll)) {
      fail(`Duplicate student roll number detected in student roster: ${roll}`, { rolls: [roll] });
    }
    uniqueRollNumbers.add(roll);
    studentMap.set(roll, {
      rollNumber: roll,
      name: normalizeName(s.name),
      gender: s.gender,
    });
  }

  if (uniqueRollNumbers.size > GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT) {
    fail(
      `Maximum unique students limit exceeded: ${uniqueRollNumbers.size} registered (Maximum allowed is ${GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT} students per IIIT).`
    );
  }

  // 1b. Validate per-gender caps (100 men, 50 women)
  let maleCount = 0;
  let femaleCount = 0;
  for (const s of studentMap.values()) {
    if (s.gender === "M") maleCount++;
    else if (s.gender === "F") femaleCount++;
  }
  if (maleCount > GLOBAL_RULES.MAX_MALE_STUDENTS_PER_IIIT) {
    fail(
      `Maximum men limit exceeded: ${maleCount} male students registered (Maximum allowed is ${GLOBAL_RULES.MAX_MALE_STUDENTS_PER_IIIT} per IIIT).`
    );
  }
  if (femaleCount > GLOBAL_RULES.MAX_FEMALE_STUDENTS_PER_IIIT) {
    fail(
      `Maximum women limit exceeded: ${femaleCount} female students registered (Maximum allowed is ${GLOBAL_RULES.MAX_FEMALE_STUDENTS_PER_IIIT} per IIIT).`
    );
  }

  // 2. Track student-level participation & sports
  // studentRoll -> { normalSports: Set, athleticsEvents: Set, aquaticsEvents: Set }
  const studentSportsMap = new Map();
  // Map to detect duplicate entries in exact same event: `${rollNumber}_${sportId}_${eventId}`
  const entryDuplicates = new Set();
  // Map to track squad count per sport/event: `${sportId}_${gender}_${eventId}` -> { mainCount, reserveCount, totalCount }
  const eventParticipationMap = new Map();

  for (const entry of entries) {
    const roll = normalizeRoll(entry.rollNumber);
    const sportId = entry.sportId.toLowerCase();
    const eventId = entry.eventId.toLowerCase();
    const eventGender = entry.gender;
    const isReserve = !!entry.isReserve;
    const entryTarget = { rolls: [roll], sportId, eventId, gender: eventGender };

    // Check student exists in roster
    const student = studentMap.get(roll);
    if (!student) {
      fail(
        `Event entry references unregistered student with roll number: ${roll} (Sport: ${sportId}, Event: ${eventId})`,
        entryTarget
      );
      continue;
    }

    // Check gender compatibility
    if (eventGender === "M" && student.gender !== "M") {
      fail(
        `Gender mismatch: Student ${student.name} (${roll}) is female but registered in Men's ${sportId} - ${eventId}`,
        entryTarget
      );
    } else if (eventGender === "F" && student.gender !== "F") {
      fail(
        `Gender mismatch: Student ${student.name} (${roll}) is male but registered in Women's ${sportId} - ${eventId}`,
        entryTarget
      );
    }

    // Check duplicate entry for same student in same event
    const duplicateKey = `${roll}_${sportId}_${eventId}`;
    if (entryDuplicates.has(duplicateKey)) {
      fail(
        `Student ${student.name} (${roll}) is entered multiple times in ${sportId} - ${eventId}`,
        entryTarget
      );
    }
    entryDuplicates.add(duplicateKey);

    // Verify sport exists in catalog
    const sportConfig = getSportConfig(sportId);
    if (!sportConfig) {
      fail(`Unrecognized sport ID: ${sportId}`, entryTarget);
      continue;
    }

    if (!sportConfig.genders.includes(eventGender)) {
      fail(`Unsupported category for ${sportConfig.name}: ${eventGender}`, entryTarget);
      continue;
    }
    if (sportConfig.type === "team" || sportConfig.type === "combined_team") {
      if (eventId !== "team") {
        fail(`Unrecognized event for ${sportConfig.name}: ${eventId}`, entryTarget);
        continue;
      }
      if (isReserve) {
        fail(`${sportConfig.name} does not allow reserve slots`, entryTarget);
        continue;
      }
    } else {
      const event = sportConfig.events?.[eventGender]?.find((item) => item.id === eventId);
      if (!event) {
        fail(`Unrecognized event for ${sportConfig.name} (${eventGender}): ${eventId}`, entryTarget);
        continue;
      }
      if (isReserve && !event.maxReserves) {
        fail(`${sportConfig.name} ${event.name} does not allow reserve slots`, entryTarget);
        continue;
      }
    }

    // Initialize student tracking
    if (!studentSportsMap.has(roll)) {
      studentSportsMap.set(roll, {
        normalSports: new Set(),
        athleticsIndividualEvents: new Set(),
        aquaticsIndividualEvents: new Set(),
      });
    }
    const studentTrack = studentSportsMap.get(roll);

    // Track sport limits
    if (sportId === "athletics") {
      // Find event definition
      const genderEvents = sportConfig.events?.[eventGender] || [];
      const evDef = genderEvents.find((e) => e.id === eventId);
      if (evDef && !evDef.isRelay) {
        studentTrack.athleticsIndividualEvents.add(eventId);
      }
    } else if (sportId === "aquatics") {
      const genderEvents = sportConfig.events?.[eventGender] || [];
      const evDef = genderEvents.find((e) => e.id === eventId);
      if (evDef && !evDef.isRelay) {
        studentTrack.aquaticsIndividualEvents.add(eventId);
      }
    } else {
      // Normal sport
      studentTrack.normalSports.add(sportId);
    }

    // Track event/team quota
    const slotKey = `${sportId}_${eventGender}_${eventId}`;
    if (!eventParticipationMap.has(slotKey)) {
      eventParticipationMap.set(slotKey, {
        sportId,
        gender: eventGender,
        eventId,
        mains: [],
        reserves: [],
      });
    }
    const slot = eventParticipationMap.get(slotKey);
    if (isReserve) {
      slot.reserves.push(roll);
    } else {
      slot.mains.push(roll);
    }
  }

  // 3. Verify Per-Student Multi-Sport and Event Limits
  for (const [roll, track] of studentSportsMap.entries()) {
    const student = studentMap.get(roll);
    const studentDisplayName = student ? `${student.name} (${roll})` : roll;

    // Normal sports limit: max 2
    if (track.normalSports.size > GLOBAL_RULES.MAX_NORMAL_SPORTS_PER_STUDENT) {
      fail(
        `Multi-sport rule violated for ${studentDisplayName}: Participates in ${
          track.normalSports.size
        } normal sports (${Array.from(track.normalSports).join(
          ", "
        )}). Maximum allowed is ${GLOBAL_RULES.MAX_NORMAL_SPORTS_PER_STUDENT} normal sports.`,
        { rolls: [roll], sportIds: Array.from(track.normalSports) }
      );
    }

    // Athletics individual events limit: max 3 (excluding relays)
    if (track.athleticsIndividualEvents.size > GLOBAL_RULES.MAX_ATHLETICS_INDIVIDUAL_EVENTS) {
      fail(
        `Athletics event limit violated for ${studentDisplayName}: Entered in ${
          track.athleticsIndividualEvents.size
        } individual athletics events (${Array.from(
          track.athleticsIndividualEvents
        ).join(", ")}). Maximum allowed is ${GLOBAL_RULES.MAX_ATHLETICS_INDIVIDUAL_EVENTS}.`,
        { rolls: [roll], sportId: "athletics" }
      );
    }

    // Aquatics individual events limit: max 3 (excluding relays)
    if (track.aquaticsIndividualEvents.size > GLOBAL_RULES.MAX_AQUATICS_INDIVIDUAL_EVENTS) {
      fail(
        `Aquatics event limit violated for ${studentDisplayName}: Entered in ${
          track.aquaticsIndividualEvents.size
        } individual swimming events (${Array.from(
          track.aquaticsIndividualEvents
        ).join(", ")}). Maximum allowed is ${GLOBAL_RULES.MAX_AQUATICS_INDIVIDUAL_EVENTS}.`,
        { rolls: [roll], sportId: "aquatics" }
      );
    }
  }

  // Mixed relays: the number of men and women may not exceed the fixed split.
  function checkGenderSplit(eventName, sportName, rolls, allowedGenders, noun, eventTarget) {
    for (const g of ["M", "F"]) {
      const allowed = allowedGenders.filter((x) => x === g).length;
      const entered = rolls.filter((roll) => studentMap.get(roll)?.gender === g);
      if (entered.length > allowed) {
        fail(
          `${sportName} ${eventName} allows ${allowed} ${g === "M" ? "male" : "female"} ${noun}, but ${entered.length} are entered. The team must be ${describeSplit(allowedGenders)}.`,
          { ...eventTarget, rolls: entered }
        );
      }
    }
  }

  // 4. Verify Sport/Event Quotas & Squad Limits
  for (const [, slot] of eventParticipationMap.entries()) {
    const { sportId, gender, eventId, mains, reserves } = slot;
    const sportConfig = getSportConfig(sportId);
    if (!sportConfig) continue;

    const totalCount = mains.length + reserves.length;
    const eventTarget = { sportId, eventId, gender };

    if (sportConfig.type === "team") {
      const limit = sportConfig.teamLimits?.[gender] || 0;
      if (totalCount > limit) {
        fail(
          `Squad size exceeded for ${sportConfig.name} (${gender}): ${totalCount} players registered (Maximum limit is ${limit}).`,
          eventTarget
        );
      }
    } else if (sportConfig.type === "combined_team") {
      const limit = sportConfig.teamLimits?.mixed || 4;
      if (totalCount > limit) {
        fail(
          `Squad size exceeded for ${sportConfig.name}: ${totalCount} players registered (Maximum limit is ${limit}).`,
          eventTarget
        );
      }
    } else if (sportConfig.type === "weight_category_based") {
      const categories = sportConfig.events?.[gender] || [];
      const cat = categories.find((c) => c.id === eventId);
      const limit = cat?.maxParticipants || 2;
      if (totalCount > limit) {
        fail(
          `Participant limit exceeded for ${sportConfig.name} (${gender} - ${
            cat?.name || eventId
          }): ${totalCount} registered (Maximum limit is ${limit}).`,
          eventTarget
        );
      }
    } else if (sportConfig.type === "event_based") {
      const events = sportConfig.events?.[gender] || [];
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        if (mains.length > ev.maxParticipants) {
          fail(
            `Competitor limit exceeded for ${sportConfig.name} (${gender} - ${ev.name}): ${mains.length} main participants (Maximum allowed is ${ev.maxParticipants}).`,
            eventTarget
          );
        }
        if (reserves.length > (ev.maxReserves || 0)) {
          fail(
            `Reserve limit exceeded for ${sportConfig.name} (${gender} - ${ev.name}): ${reserves.length} reserves (Maximum allowed is ${ev.maxReserves}).`,
            eventTarget
          );
        }
        // Relays: all runners are compulsory once a team is entered; reserves are optional.
        if (ev.isRelay && mains.length < ev.maxParticipants) {
          const need = ev.slotGenders ? describeSplit(ev.slotGenders) : `${ev.maxParticipants} runners`;
          fail(
            `${sportConfig.name} ${ev.name} needs all ${ev.maxParticipants} runners (${need}): only ${mains.length} entered. Reserves are optional.`,
            eventTarget
          );
        }
        if (ev.slotGenders) {
          checkGenderSplit(ev.name, sportConfig.name, mains, ev.slotGenders, "runners", eventTarget);
          checkGenderSplit(ev.name, sportConfig.name, reserves, ev.reserveGenders || [], "reserves", eventTarget);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    issues,
  };
}
