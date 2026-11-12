import { adminRoute, readBody } from "@/lib/live/admin-route";
import { deleteTournament, getTournament, updateTournament } from "@/lib/live/tournaments";
import { tournamentUpdateSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

/** One tournament with pools, standings and the bracket. */
export const GET = adminRoute(async ({ id }) => getTournament(id), { write: false, fallback: "Unable to load the tournament" });

/** Changes the name, points, draws, qualifiers or the 3rd-place setting. */
export const PATCH = adminRoute(async ({ request, session, id }) => {
  await updateTournament(id, await readBody(request, tournamentUpdateSchema), session.username);
  return getTournament(id);
}, { action: "live_tournament_updated", fallback: "Unable to save the tournament" });

/** Deletes the tournament and all its matches. */
export const DELETE = adminRoute(async ({ id }) => {
  await deleteTournament(id);
  return { id };
}, { action: "live_tournament_deleted", fallback: "Unable to delete the tournament" });
