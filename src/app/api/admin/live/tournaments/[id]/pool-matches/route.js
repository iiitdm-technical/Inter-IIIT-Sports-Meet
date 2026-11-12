import { adminRoute, readBody } from "@/lib/live/admin-route";
import { getTournament, syncPoolMatches } from "@/lib/live/tournaments";
import { poolMatchesSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

/** Previews ({ apply: false }) or applies the round-robin pool matches. */
export const POST = adminRoute(async ({ request, session, id }) => {
  const { apply } = await readBody(request, poolMatchesSchema);
  const changes = await syncPoolMatches(id, { apply }, session.username);
  return { changes, tournament: apply ? await getTournament(id) : null };
}, { fallback: "Unable to update the pool matches" });
