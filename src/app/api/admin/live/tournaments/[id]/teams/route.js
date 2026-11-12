import { adminRoute, readBody } from "@/lib/live/admin-route";
import { getTournament, setTeams } from "@/lib/live/tournaments";
import { tournamentTeamsSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

/** Replaces the tournament's teams and their pools. */
export const PUT = adminRoute(async ({ request, session, id }) => {
  await setTeams(id, await readBody(request, tournamentTeamsSchema), session.username);
  return getTournament(id);
}, { action: "live_tournament_teams", fallback: "Unable to save the teams" });
