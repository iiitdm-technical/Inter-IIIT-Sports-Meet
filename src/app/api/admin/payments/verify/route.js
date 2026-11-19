import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { verifyPayment } from "@/lib/admin/service";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  iiitCode: z.string().min(1).max(64),
});

export async function POST(request) {
  try {
    const admin = await requireAuth(["admin"]);
    await enforce(`admin:${admin.userId}`, LIMITS.adminWrite);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose an IIIT to verify" }, { status: 400 });
    }
    const { iiitCode } = parsed.data;
    const result = await verifyPayment(iiitCode, admin.username);
    await audit({ actor: admin.username, role: admin.role, action: "payment_verified", target: iiitCode, ip: await getClientIp() });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Payment verification failed:", error);
    return errorResponse(error, "Payment verification failed");
  }
}
