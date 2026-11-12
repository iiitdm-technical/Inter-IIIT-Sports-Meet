import { adminRoute, readBody } from "@/lib/live/admin-route";
import { getTournament, setPoolOrder } from "@/lib/live/tournaments";
import { poolOrderSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

/** Sets or clears a pool's hand-made standings order. */
export const PUT = adminRoute(async ({ request, session, id }) => {
  await setPoolOrder(id, await readBody(request, poolOrderSchema), session.username);
  return getTournament(id);
}, { action: "live_tournament_pool_order", fallback: "Unable to save the pool order" });
