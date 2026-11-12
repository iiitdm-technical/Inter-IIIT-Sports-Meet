import { adminRoute, readBody } from "@/lib/live/admin-route";
import { buildBracket, clearBracket, getTournament } from "@/lib/live/tournaments";
import { bracketSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

/** Builds or rebuilds the knockout bracket from the teams placed by hand. */
export const PUT = adminRoute(async ({ request, session, id }) => {
  await buildBracket(id, await readBody(request, bracketSchema), session.username);
  return getTournament(id);
}, { action: "live_tournament_bracket", fallback: "Unable to build the bracket" });

/** Removes the knockout bracket if none of it has been played. */
export const DELETE = adminRoute(async ({ session, id }) => {
  await clearBracket(id, session.username);
  return getTournament(id);
}, { action: "live_tournament_bracket_cleared", fallback: "Unable to remove the bracket" });
