import { adminRoute, readBody } from "@/lib/live/admin-route";
import { createTournament, listTournaments } from "@/lib/live/tournaments";
import { tournamentCreateSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

/** Every tournament (super admin). */
export const GET = adminRoute(async () => listTournaments(), { write: false, fallback: "Unable to load tournaments" });

/** Creates a tournament for a sport and category. */
export const POST = adminRoute(async ({ request, session }) => {
  const body = await readBody(request, tournamentCreateSchema);
  return { id: await createTournament(body, session.username) };
}, { action: "live_tournament_created", fallback: "Unable to create the tournament", status: 201 });
