import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp, httpError } from "@/lib/security/request";
import { deleteMatch, getMatchChanges, getScope, scopeAllows, updateMatch } from "@/lib/live/service";
import { matchActionSchema } from "@/lib/live/schemas";
import { getDb } from "@/db/index";
import { matches } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) throw httpError(404, "Match not found");
  return id;
}

/** Change log for one match (who changed what, newest first). */
export async function GET(_request, { params }) {
  try {
    const session = await requireAuth(["admin", "coordinator"]);
    const id = parseId((await params).id);
    const [row] = await getDb().select({ sportId: matches.sportId, gender: matches.gender }).from(matches).where(eq(matches.id, id)).limit(1);
    if (!row) throw httpError(404, "Match not found");
    if (!scopeAllows(await getScope(session), row)) throw httpError(403, "You can only view your own sports");
    return NextResponse.json({ data: await getMatchChanges(id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load the change log");
  }
}

/** start / score / placings / finish (coordinator or admin); reopen / details (admin). */
export async function PATCH(request, { params }) {
  try {
    const session = await requireAuth(["admin", "coordinator"]);
    await enforce(`live:${session.userId}`, LIMITS.liveWrite);
    const id = parseId((await params).id);
    const parsed = matchActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the values entered" }, { status: 400 });
    }
    const scope = await getScope(session);
    const match = await updateMatch(id, parsed.data, { actor: session.username, scope, isSuper: session.role === "admin" });
    if (["finish", "reopen", "details"].includes(parsed.data.action)) {
      await audit({ actor: session.username, role: session.role, action: `live_match_${parsed.data.action}`, target: String(id), ip: await getClientIp() });
    }
    return NextResponse.json({ data: match });
  } catch (error) {
    if (!(error?.statusCode >= 400 && error?.statusCode < 500)) console.error("Live match update failed:", error);
    return errorResponse(error, "Unable to update the match");
  }
}

/** Deletes a match and its history. Super admin only. */
export async function DELETE(_request, { params }) {
  try {
    const session = await requireAuth(["admin"]);
    await enforce(`live:${session.userId}`, LIMITS.liveWrite);
    const id = parseId((await params).id);
    await deleteMatch(id);
    await audit({ actor: session.username, role: session.role, action: "live_match_deleted", target: String(id), ip: await getClientIp() });
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return errorResponse(error, "Unable to delete the match");
  }
}
