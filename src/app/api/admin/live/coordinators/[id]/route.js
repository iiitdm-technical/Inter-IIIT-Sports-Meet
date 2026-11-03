import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp, httpError } from "@/lib/security/request";
import { deleteCoordinator, normalizeAssignments, resetCoordinatorPassword, setCoordinatorSports } from "@/lib/live/service";
import { coordinatorSportsSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) throw httpError(404, "Coordinator not found");
  return id;
}

async function guard() {
  const session = await requireAuth(["admin"]);
  await enforce(`admin:${session.userId}`, LIMITS.adminWrite);
  return session;
}

/** Replaces the coordinator's sports. */
export async function PUT(request, { params }) {
  try {
    const session = await guard();
    const id = parseId((await params).id);
    const parsed = coordinatorSportsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the sports" }, { status: 400 });
    }
    const sports = normalizeAssignments(parsed.data.sports);
    await setCoordinatorSports(id, sports);
    await audit({ actor: session.username, role: session.role, action: "coordinator_sports_set", target: String(id), ip: await getClientIp(), details: { sports } });
    return NextResponse.json({ data: { id, sports } });
  } catch (error) {
    return errorResponse(error, "Unable to update the coordinator");
  }
}

/** Issues a new password and signs the coordinator out everywhere. */
export async function POST(_request, { params }) {
  try {
    const session = await guard();
    const id = parseId((await params).id);
    const result = await resetCoordinatorPassword(id);
    await audit({ actor: session.username, role: session.role, action: "coordinator_password_reset", target: String(id), ip: await getClientIp() });
    return NextResponse.json({ data: result }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Unable to reset the password");
  }
}

/** Removes the coordinator (revokes access immediately). */
export async function DELETE(_request, { params }) {
  try {
    const session = await guard();
    const id = parseId((await params).id);
    await deleteCoordinator(id);
    await audit({ actor: session.username, role: session.role, action: "coordinator_deleted", target: String(id), ip: await getClientIp() });
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return errorResponse(error, "Unable to remove the coordinator");
  }
}
