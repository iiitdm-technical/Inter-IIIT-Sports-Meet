import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { reopenRegistration } from "@/lib/admin/service";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  iiitCode: z.string().min(1).max(64),
  confirmIiitCode: z.string().min(1).max(64),
});

export async function POST(request) {
  try {
    const admin = await requireAuth(["admin"]);
    await enforce(`admin:${admin.userId}`, LIMITS.adminWrite);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.iiitCode !== parsed.data.confirmIiitCode.trim()) {
      return NextResponse.json({ error: "Type the IIIT code exactly to confirm" }, { status: 400 });
    }
    const result = await reopenRegistration(parsed.data.iiitCode);
    await audit({ actor: admin.username, role: admin.role, action: "roster_reopened", target: result.iiitCode, ip: await getClientIp(), details: result });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Reopen roster failed:", error);
    return errorResponse(error, "Could not reopen the roster");
  }
}
