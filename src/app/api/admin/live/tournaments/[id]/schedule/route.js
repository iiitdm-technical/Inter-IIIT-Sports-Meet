import { adminRoute, readBody } from "@/lib/live/admin-route";
import { getTournament, scheduleMatches } from "@/lib/live/tournaments";
import { scheduleSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

/** Gives times and venues to unplayed matches, in play order. */
export const POST = adminRoute(async ({ request, session, id }) => {
  const scheduled = await scheduleMatches(id, await readBody(request, scheduleSchema), session.username);
  return { scheduled, tournament: await getTournament(id) };
}, { action: "live_tournament_scheduled", fallback: "Unable to schedule the matches" });
