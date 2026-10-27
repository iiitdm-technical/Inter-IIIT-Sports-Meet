/**
 * 9th Inter-IIIT Sports Meet 2026 - Centralized Sport Catalog & Rules
 *
 * Source: Official Inter-IIIT Sports Meet Rulebook
 */

export const GLOBAL_RULES = {
  MAX_UNIQUE_STUDENTS_PER_IIIT: 150,
  MAX_MALE_STUDENTS_PER_IIIT: 100,
  MAX_FEMALE_STUDENTS_PER_IIIT: 50,
  MAX_NORMAL_SPORTS_PER_STUDENT: 2,
  MAX_ATHLETICS_INDIVIDUAL_EVENTS: 3,
  MAX_AQUATICS_INDIVIDUAL_EVENTS: 3,
  // CCAvenue portal fees: base per unique student, GST, and one deposit per IIIT.
  REGISTRATION_FEE_PER_STUDENT: 2500,
  REGISTRATION_GST_PERCENT: 18,
  REFUNDABLE_CAUTION_DEPOSIT: 25000,
  EXEMPT_SPORTS_FROM_2_SPORT_LIMIT: ['athletics', 'aquatics'],
};

// Mixed relays run with exactly 2 men and 2 women; each runner slot has a fixed gender.
const MIXED_RELAY_SPLIT = {
  slotGenders: ['M', 'M', 'F', 'F'],
  // Optional: one male and one female reserve. A reserve may replace only a runner of the same gender.
  reserveGenders: ['M', 'F'],
};

export const SPORTS_CONFIG = {
  athletics: {
    id: 'athletics',
    name: 'Athletics',
    type: 'event_based',
    isExemptFromSportLimit: true,
    genders: ['M', 'F', 'mixed'],
    events: {
      M: [
        { id: '100m', name: '100 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '200m', name: '200 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '400m', name: '400 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '800m', name: '800 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '1500m', name: '1500 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '5000m', name: '5000 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '4x100m_relay', name: '4x100 M Relay', maxParticipants: 4, maxReserves: 2, isRelay: true },
        { id: '4x400m_relay', name: '4x400 M Relay', maxParticipants: 4, maxReserves: 2, isRelay: true },
        { id: 'long_jump', name: 'Long Jump', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'high_jump', name: 'High Jump', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'triple_jump', name: 'Triple Jump', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'shot_put', name: 'Shot Put', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'discus_throw', name: 'Discus Throw', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'javelin_throw', name: 'Javelin Throw', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'hurdles_110m', name: 'Hurdles 110 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
      ],
      F: [
        { id: '100m', name: '100 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '200m', name: '200 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '400m', name: '400 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '800m', name: '800 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '1500m', name: '1500 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '3000m', name: '3000 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: '4x100m_relay', name: '4x100 M Relay', maxParticipants: 4, maxReserves: 2, isRelay: true },
        { id: 'long_jump', name: 'Long Jump', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'high_jump', name: 'High Jump', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'shot_put', name: 'Shot Put', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'discus_throw', name: 'Discus Throw', maxParticipants: 2, maxReserves: 1, isRelay: false },
        { id: 'hurdles_110m', name: 'Hurdles 110 M', maxParticipants: 2, maxReserves: 1, isRelay: false },
      ],
      mixed: [
        { id: 'mixed_4x100m_relay', name: '4x100 M Mixed Relay', maxParticipants: 4, maxReserves: 2, isRelay: true, ...MIXED_RELAY_SPLIT },
        { id: 'mixed_4x400m_relay', name: '4x400 M Mixed Relay', maxParticipants: 4, maxReserves: 2, isRelay: true, ...MIXED_RELAY_SPLIT },
      ],
    },
    maxEventsPerStudent: 3, // excluding relays
  },

  aquatics: {
    id: 'aquatics',
    name: 'Aquatics',
    type: 'event_based',
    isExemptFromSportLimit: true,
    genders: ['M', 'F', 'mixed'],
    events: {
      M: [
        { id: '50m_freestyle', name: '50 M Free Style', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '100m_freestyle', name: '100 M Free Style', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '200m_freestyle', name: '200 M Free Style', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '50m_backstroke', name: '50 M Back Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '100m_backstroke', name: '100 M Back Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '200m_backstroke', name: '200 M Back Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '50m_butterfly', name: '50 M Butterfly', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '100m_butterfly', name: '100 M Butterfly', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '200m_butterfly', name: '200 M Butterfly', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '50m_breaststroke', name: '50 M Breast Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '100m_breaststroke', name: '100 M Breast Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '200m_breaststroke', name: '200 M Breast Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '200m_individual_medley', name: '200 M Individual Medley', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '4x50m_freestyle_relay', name: '4x50 M Free Style Relay', maxParticipants: 4, maxReserves: 2, isRelay: true },
        { id: '4x50m_medley_relay', name: '4x50 M Medley Relay', maxParticipants: 4, maxReserves: 2, isRelay: true },
      ],
      F: [
        { id: '50m_freestyle', name: '50 M Free Style', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '100m_freestyle', name: '100 M Free Style', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '50m_backstroke', name: '50 M Back Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '100m_backstroke', name: '100 M Back Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '50m_butterfly', name: '50 M Butterfly', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '100m_butterfly', name: '100 M Butterfly', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '50m_breaststroke', name: '50 M Breast Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '100m_breaststroke', name: '100 M Breast Stroke', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '200m_individual_medley', name: '200 M Individual Medley', maxParticipants: 2, maxReserves: 0, isRelay: false },
        { id: '4x50m_freestyle_relay', name: '4x50 M Free Style Relay', maxParticipants: 4, maxReserves: 2, isRelay: true },
        { id: '4x50m_medley_relay', name: '4x50 M Medley Relay', maxParticipants: 4, maxReserves: 2, isRelay: true },
      ],
      mixed: [
        { id: 'mixed_4x50m_freestyle_relay', name: '4x50 M Mixed Free Style Relay', maxParticipants: 4, maxReserves: 2, isRelay: true, ...MIXED_RELAY_SPLIT },
        { id: 'mixed_4x50m_medley_relay', name: '4x50 M Mixed Medley Relay', maxParticipants: 4, maxReserves: 2, isRelay: true, ...MIXED_RELAY_SPLIT },
      ],
    },
    maxEventsPerStudent: 3, // excluding relays
  },

  powerlifting: {
    id: 'powerlifting',
    name: 'Powerlifting',
    type: 'weight_category_based',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    events: {
      M: [
        { id: 'up_to_66kg', name: 'Up to 66 KG', maxParticipants: 2 },
        { id: '66_01_to_74kg', name: '66.01 to 74 KG', maxParticipants: 2 },
        { id: '74_01_to_83kg', name: '74.01 to 83 KG', maxParticipants: 2 },
        { id: '83_01kg_plus', name: '83.01 KG+', maxParticipants: 2 },
      ],
      F: [
        { id: 'up_to_52kg', name: 'Up to 52 KG', maxParticipants: 2 },
        { id: '52_01_to_63kg', name: '52.01 to 63 KG', maxParticipants: 2 },
        { id: '63_01_to_72kg', name: '63.01 to 72 KG', maxParticipants: 2 },
        { id: '72_01kg_plus', name: '72.01 KG+', maxParticipants: 2 },
      ],
    },
  },

  badminton: {
    id: 'badminton',
    name: 'Badminton',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 5, F: 3 },
  },

  basketball: {
    id: 'basketball',
    name: 'Basketball',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 12, F: 10 },
  },

  carrom: {
    id: 'carrom',
    name: 'Carrom',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 3, F: 3 },
  },

  cricket: {
    id: 'cricket',
    name: 'Cricket',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M'],
    teamLimits: { M: 15 },
  },

  kabaddi: {
    id: 'kabaddi',
    name: 'Kabaddi',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 12, F: 12 },
  },

  football: {
    id: 'football',
    name: 'Football',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M'],
    teamLimits: { M: 16 },
  },

  table_tennis: {
    id: 'table_tennis',
    name: 'Table Tennis',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 3, F: 3 },
  },

  lawn_tennis: {
    id: 'lawn_tennis',
    name: 'Lawn Tennis',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 3, F: 3 },
  },

  volleyball: {
    id: 'volleyball',
    name: 'Volleyball',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 12, F: 10 },
  },

  handball: {
    id: 'handball',
    name: 'Handball',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 14, F: 14 },
  },

  tug_of_war: {
    id: 'tug_of_war',
    name: 'Tug of War',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 8, F: 8 },
  },

  kho_kho: {
    id: 'kho_kho',
    name: 'Kho-Kho',
    type: 'team',
    isExemptFromSportLimit: false,
    genders: ['M', 'F'],
    teamLimits: { M: 12, F: 12 },
  },

  chess: {
    id: 'chess',
    name: 'Chess',
    type: 'combined_team',
    isExemptFromSportLimit: false,
    genders: ['mixed'], // accepts both M and F
    teamLimits: { mixed: 4 },
  },
};

/**
 * Helper to get sport configuration by ID
 */
export function getSportConfig(sportId) {
  return SPORTS_CONFIG[sportId] || null;
}

/**
 * Helper to get all sports as a list
 */
export function getAllSportsList() {
  return Object.values(SPORTS_CONFIG);
}
