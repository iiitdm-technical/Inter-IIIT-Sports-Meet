import { z } from "zod";
import { BRACKET_SIZES, COORDINATOR_GENDERS, POOLS, ROUNDS } from "./catalog.js";

/** Request bodies for the live results API. Business checks live in service.js. */

const gender = z.enum(["M", "F", "mixed"]);
const code = z.string().trim().min(1).max(64);
const score = z.number().int().min(0).max(9999);
const text = (max) => z.string().trim().max(max);
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time");
// Empty or null: the time is to be announced.
const optionalDateTime = isoDateTime.or(z.literal("")).nullable().optional();
const id = z.number().int().min(1);
const version = z.number().int().min(1);
const pool = z.enum(POOLS).or(z.literal(""));

export const fixtureSchema = z.object({
  sportId: code,
  gender,
  eventId: code.optional().nullable(),
  sideA: code.optional().nullable(),
  sideB: code.optional().nullable(),
  round: z.enum(ROUNDS).or(z.literal("")).default(""),
  pool: pool.default(""),
  venue: text(128).default(""),
  scheduledAt: optionalDateTime,
  tournamentId: id.optional().nullable(),
});

const placing = z.object({
  position: z.number().int().min(1).max(16),
  iiitCode: code,
  athlete: text(128).optional().default(""),
  mark: text(64).optional().default(""),
});

export const matchActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), version }),
  z.object({ action: z.literal("score"), version, scoreA: score, scoreB: score, scoreDetail: text(255).optional() }),
  z.object({ action: z.literal("placings"), version, placings: z.array(placing).max(16) }),
  z.object({
    action: z.literal("finish"), version,
    winner: code.optional(),
    scoreA: score.optional(), scoreB: score.optional(), scoreDetail: text(255).optional(),
    resultNote: text(255).optional(),
    placings: z.array(placing).max(16).optional(),
  }),
  z.object({ action: z.literal("reopen"), version }),
  z.object({
    action: z.literal("details"), version,
    eventId: code.optional().nullable(),
    sideA: code.optional().nullable(),
    sideB: code.optional().nullable(),
    round: z.enum(ROUNDS).or(z.literal("")).optional(),
    pool: pool.optional(),
    venue: text(128).optional(),
    scheduledAt: optionalDateTime,
    status: z.enum(["scheduled", "postponed", "cancelled"]).optional(),
  }),
]);

const assignment = z.object({ sportId: code, gender: z.enum(COORDINATOR_GENDERS).default("all") });

export const coordinatorCreateSchema = z.object({
  email: z.email("Enter a valid email").max(64),
  name: z.string().trim().min(1, "Enter the coordinator's name").max(128),
  sports: z.array(assignment).min(1, "Assign at least one sport").max(40),
});

export const coordinatorSportsSchema = z.object({
  sports: z.array(assignment).min(1, "Assign at least one sport").max(40),
});

export const boardQuerySchema = z.object({
  sport: z.string().max(64).optional().default(""),
  gender: z.enum(["", "M", "F", "mixed"]).optional().default(""),
  iiit: z.string().max(64).optional().default(""),
});

// ---------------------------------------------------------------------------
// Tournaments (pools and knockout brackets). Super admin only.

const points = z.number().int().min(-99).max(99);

export const tournamentSettingsSchema = z.object({
  name: text(128).default(""),
  pointsWin: points.default(3),
  pointsDraw: points.default(1),
  pointsLoss: points.default(0),
  allowDraws: z.boolean().default(true),
  qualifyPerPool: z.number().int().min(0).max(16).default(2),
  thirdPlace: z.boolean().default(true),
});

export const tournamentCreateSchema = tournamentSettingsSchema.extend({
  sportId: code,
  gender,
});

export const tournamentUpdateSchema = tournamentSettingsSchema.partial().extend({ version });

export const tournamentTeamsSchema = z.object({
  version,
  teams: z.array(z.object({ iiitCode: code, pool: pool })).max(64),
});

export const poolOrderSchema = z.object({
  pool,
  order: z.array(code).max(64).nullable(), // null clears the manual order
});

export const poolMatchesSchema = z.object({ apply: z.boolean().default(false) });

export const bracketSchema = z.object({
  size: z.number().int().refine((value) => BRACKET_SIZES.includes(value), "Choose a bracket size"),
  thirdPlace: z.boolean(),
  // One entry per first-round position (2 per match); null leaves it empty (a bye).
  slots: z.array(code.nullable()),
});

export const scheduleSchema = z.object({
  start: isoDateTime,
  minutesPerMatch: z.number().int().min(5).max(24 * 60),
  venues: z.array(text(128).min(1)).min(1).max(20),
  stage: z.enum(["pool", "knockout", "all"]).default("all"),
  onlyUnscheduled: z.boolean().default(true),
  // Daily window in IST, e.g. "09:00"–"18:00"; matches that would end later move to the next day.
  dayStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const bracketQuerySchema = z.object({
  tournament: z.coerce.number().int().min(1).optional(),
});
