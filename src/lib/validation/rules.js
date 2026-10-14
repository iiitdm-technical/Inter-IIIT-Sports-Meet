import { GLOBAL_RULES, getSportConfig } from "../sports/config.js";

/**
 * Business Rule Validator for Inter-IIIT Sports Meet Registrations.
 *
 * @param {Object} payload
 * @param {Array} payload.students - Array of { rollNumber, name, gender }
 * @param {Array} payload.entries - Array of { sportId, eventId, gender, rollNumber, isReserve }
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateRegistrationRules({ students, entries }) {
  const errors = [];

  // 1. Validate total unique students <= 150
  const uniqueRollNumbers = new Set();
  const studentMap = new Map(); // rollNumber -> { rollNumber, name, gender }

  for (const s of students) {
    const roll = s.rollNumber.trim().toUpperCase();
    if (uniqueRollNumbers.has(roll)) {
      errors.push(`Duplicate student roll number detected in student roster: ${roll}`);
    }
    uniqueRollNumbers.add(roll);
    studentMap.set(roll, {
      rollNumber: roll,
      name: s.name.trim().toUpperCase(),
      gender: s.gender,
    });
  }

  if (uniqueRollNumbers.size > GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT) {
    errors.push(
      `Maximum unique students limit exceeded: ${uniqueRollNumbers.size} registered (Maximum allowed is ${GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT} students per IIIT).`
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
    const roll = entry.rollNumber.trim().toUpperCase();
    const sportId = entry.sportId.toLowerCase();
    const eventId = entry.eventId.toLowerCase();
    const eventGender = entry.gender;
    const isReserve = !!entry.isReserve;

    // Check student exists in roster
    const student = studentMap.get(roll);
    if (!student) {
      errors.push(
        `Event entry references unregistered student with roll number: ${roll} (Sport: ${sportId}, Event: ${eventId})`
      );
      continue;
    }

    // Check gender compatibility
    if (eventGender === "M" && student.gender !== "M") {
      errors.push(
        `Gender mismatch: Student ${student.name} (${roll}) is female but registered in Men's ${sportId} - ${eventId}`
      );
    } else if (eventGender === "F" && student.gender !== "F") {
      errors.push(
        `Gender mismatch: Student ${student.name} (${roll}) is male but registered in Women's ${sportId} - ${eventId}`
      );
    }

    // Check duplicate entry for same student in same event
    const duplicateKey = `${roll}_${sportId}_${eventId}`;
    if (entryDuplicates.has(duplicateKey)) {
      errors.push(
        `Student ${student.name} (${roll}) is entered multiple times in ${sportId} - ${eventId}`
      );
    }
    entryDuplicates.add(duplicateKey);

    // Verify sport exists in catalog
    const sportConfig = getSportConfig(sportId);
    if (!sportConfig) {
      errors.push(`Unrecognized sport ID: ${sportId}`);
      continue;
    }

    if (!sportConfig.genders.includes(eventGender)) {
      errors.push(`Unsupported category for ${sportConfig.name}: ${eventGender}`);
      continue;
    }
    if (sportConfig.type === "team" || sportConfig.type === "combined_team") {
      if (eventId !== "team") {
        errors.push(`Unrecognized event for ${sportConfig.name}: ${eventId}`);
        continue;
      }
      if (isReserve) {
        errors.push(`${sportConfig.name} does not allow reserve slots`);
        continue;
      }
    } else {
      const event = sportConfig.events?.[eventGender]?.find((item) => item.id === eventId);
      if (!event) {
        errors.push(`Unrecognized event for ${sportConfig.name} (${eventGender}): ${eventId}`);
        continue;
      }
      if (isReserve && !event.maxReserves) {
        errors.push(`${sportConfig.name} ${event.name} does not allow reserve slots`);
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
      errors.push(
        `Multi-sport rule violated for ${studentDisplayName}: Participates in ${
          track.normalSports.size
        } normal sports (${Array.from(track.normalSports).join(
          ", "
        )}). Maximum allowed is ${GLOBAL_RULES.MAX_NORMAL_SPORTS_PER_STUDENT} normal sports.`
      );
    }

    // Athletics individual events limit: max 3 (excluding relays)
    if (track.athleticsIndividualEvents.size > GLOBAL_RULES.MAX_ATHLETICS_INDIVIDUAL_EVENTS) {
      errors.push(
        `Athletics event limit violated for ${studentDisplayName}: Entered in ${
          track.athleticsIndividualEvents.size
        } individual athletics events (${Array.from(
          track.athleticsIndividualEvents
        ).join(", ")}). Maximum allowed is ${GLOBAL_RULES.MAX_ATHLETICS_INDIVIDUAL_EVENTS}.`
      );
    }

    // Aquatics individual events limit: max 3 (excluding relays)
    if (track.aquaticsIndividualEvents.size > GLOBAL_RULES.MAX_AQUATICS_INDIVIDUAL_EVENTS) {
      errors.push(
        `Aquatics event limit violated for ${studentDisplayName}: Entered in ${
          track.aquaticsIndividualEvents.size
        } individual swimming events (${Array.from(
          track.aquaticsIndividualEvents
        ).join(", ")}). Maximum allowed is ${GLOBAL_RULES.MAX_AQUATICS_INDIVIDUAL_EVENTS}.`
      );
    }
  }

  // 4. Verify Sport/Event Quotas & Squad Limits
  for (const [, slot] of eventParticipationMap.entries()) {
    const { sportId, gender, eventId, mains, reserves } = slot;
    const sportConfig = getSportConfig(sportId);
    if (!sportConfig) continue;

    const totalCount = mains.length + reserves.length;

    if (sportConfig.type === "team") {
      const limit = sportConfig.teamLimits?.[gender] || 0;
      if (totalCount > limit) {
        errors.push(
          `Squad size exceeded for ${sportConfig.name} (${gender}): ${totalCount} players registered (Maximum limit is ${limit}).`
        );
      }
    } else if (sportConfig.type === "combined_team") {
      const limit = sportConfig.teamLimits?.mixed || 4;
      if (totalCount > limit) {
        errors.push(
          `Squad size exceeded for ${sportConfig.name}: ${totalCount} players registered (Maximum limit is ${limit}).`
        );
      }
    } else if (sportConfig.type === "weight_category_based") {
      const categories = sportConfig.events?.[gender] || [];
      const cat = categories.find((c) => c.id === eventId);
      const limit = cat?.maxParticipants || 2;
      if (totalCount > limit) {
        errors.push(
          `Participant limit exceeded for ${sportConfig.name} (${gender} - ${
            cat?.name || eventId
          }): ${totalCount} registered (Maximum limit is ${limit}).`
        );
      }
    } else if (sportConfig.type === "event_based") {
      const events = sportConfig.events?.[gender] || [];
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        if (mains.length > ev.maxParticipants) {
          errors.push(
            `Competitor limit exceeded for ${sportConfig.name} (${gender} - ${ev.name}): ${mains.length} main participants (Maximum allowed is ${ev.maxParticipants}).`
          );
        }
        if (reserves.length > (ev.maxReserves || 0)) {
          errors.push(
            `Reserve limit exceeded for ${sportConfig.name} (${gender} - ${ev.name}): ${reserves.length} reserves (Maximum allowed is ${ev.maxReserves}).`
          );
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
