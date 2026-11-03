import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/request";
import { createCoordinator, listCoordinators, normalizeAssignments } from "@/lib/live/service";
import { coordinatorCreateSchema } from "@/lib/live/schemas";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    await requireAuth(["admin"]);
    return NextResponse.json({ data: await listCoordinators() }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Unable to load coordinators");
  }
}

/** Adds a coordinator; the response carries their password once. */
export async function POST(request) {
  try {
    const session = await requireAuth(["admin"]);
    await enforce(`admin:${session.userId}`, LIMITS.adminWrite);
    const parsed = coordinatorCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the coordinator details" }, { status: 400 });
    }
    const sports = normalizeAssignments(parsed.data.sports);
    const created = await createCoordinator({ ...parsed.data, sports });
    await audit({ actor: session.username, role: session.role, action: "coordinator_created", target: created.email, ip: await getClientIp(), details: { sports } });
    return NextResponse.json({ data: created }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Unable to add the coordinator");
  }
}
