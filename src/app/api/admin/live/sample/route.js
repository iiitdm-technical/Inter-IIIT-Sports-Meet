import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/request";
import { clearSampleMatches } from "@/lib/live/service";
import { seedSampleMatches } from "@/lib/live/sample";

export const runtime = "nodejs";

/** Replaces the sample fixtures with a fresh set timed around now. Super admin only. */
export async function POST() {
  try {
    const session = await requireAuth(["admin"]);
    await enforce(`admin:${session.userId}`, LIMITS.adminWrite);
    const added = await seedSampleMatches(session.username);
    await audit({ actor: session.username, role: session.role, action: "live_sample_seeded", ip: await getClientIp(), details: { added } });
    return NextResponse.json({ data: { added } });
  } catch (error) {
    return errorResponse(error, "Unable to add sample matches");
  }
}

/** Removes every sample fixture; real matches are never touched. */
export async function DELETE() {
  try {
    const session = await requireAuth(["admin"]);
    await enforce(`admin:${session.userId}`, LIMITS.adminWrite);
    const removed = await clearSampleMatches();
    await audit({ actor: session.username, role: session.role, action: "live_sample_cleared", ip: await getClientIp(), details: { removed } });
    return NextResponse.json({ data: { removed } });
  } catch (error) {
    return errorResponse(error, "Unable to clear sample matches");
  }
}
