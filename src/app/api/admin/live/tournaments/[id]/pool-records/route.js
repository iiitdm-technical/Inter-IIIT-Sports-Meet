import { adminRoute, readBody } from "@/lib/live/admin-route";
import { getTournament, setPoolRecords } from "@/lib/live/tournaments";
import { poolRecordsSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

/** Sets a pool's wins, draws and losses by hand (or resets them to the results). */
export const PUT = adminRoute(async ({ request, session, id }) => {
  await setPoolRecords(id, await readBody(request, poolRecordsSchema), session.username);
  return getTournament(id);
}, { action: "live_tournament_pool_records", fallback: "Unable to save the pool table" });
