import { z } from "zod";
import { COORDINATOR_GENDERS, POOLS, ROUNDS } from "./catalog.js";

/** Request bodies for the live results API. Business checks live in service.js. */

const gender = z.enum(["M", "F", "mixed"]);
const code = z.string().trim().min(1).max(64);
const score = z.number().int().min(0).max(9999);
const text = (max) => z.string().trim().max(max);
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time");
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
  scheduledAt: isoDateTime,
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
    scheduledAt: isoDateTime.optional(),
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
