import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/request";
import { createMatch, getScope, listManageableMatches } from "@/lib/live/service";
import { fixtureSchema } from "@/lib/live/schemas";
import { LIVE_IIITS, POOLS, ROUNDS, liveSports } from "@/lib/live/catalog";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Matches the signed-in admin or coordinator may manage, plus form vocabulary. */
export async function GET() {
  try {
    const session = await requireAuth(["admin", "coordinator"]);
    const scope = await getScope(session);
    const matches = await listManageableMatches(scope);
    return NextResponse.json({
      data: {
        user: { username: session.username, displayName: session.displayName, role: session.role },
        isSuper: session.role === "admin",
        scope: scope.all ? "all" : scope.sports,
        matches,
        sports: liveSports(),
        iiits: LIVE_IIITS.map(({ code, name }) => ({ code, name })),
        rounds: ROUNDS,
        pools: POOLS,
      },
    }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Unable to load matches");
  }
}

/** Schedules a match. Super admin only. */
export async function POST(request) {
  try {
    const session = await requireAuth(["admin"]);
    await enforce(`live:${session.userId}`, LIMITS.liveWrite);
    const parsed = fixtureSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the match details" }, { status: 400 });
    }
    const id = await createMatch(parsed.data, session.username);
    await audit({ actor: session.username, role: session.role, action: "live_match_created", target: String(id), ip: await getClientIp(), details: { sportId: parsed.data.sportId, gender: parsed.data.gender } });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to schedule the match");
  }
}
