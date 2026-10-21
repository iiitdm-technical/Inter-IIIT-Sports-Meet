import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { getClientIp } from "@/lib/security/request";
import { audit } from "@/lib/security/audit";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { requireAuth } from "@/lib/auth/session";
import { submitPayment } from "@/lib/registration/service";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    // Only logged-in IIIT users can submit payment
    const session = await requireAuth(["iiit"]);

    if (!session.iiitCode) {
      return NextResponse.json(
        { error: "No IIIT code linked to this session" },
        { status: 400 }
      );
    }

    await enforce(`submit:${session.userId}`, LIMITS.submit);
    const body = await request.json();
    const result = await submitPayment(
      session.iiitCode,
      body,
      session.username
    );
    await audit({ actor: session.username, role: session.role, action: "payment_submitted", target: session.iiitCode, ip: await getClientIp(), details: { amount: result.amountPaid } });

    return NextResponse.json({
      success: true,
      message: "Payment submitted and registration permanently locked",
      data: result,
    });
  } catch (error) {
    console.error("Submit payment error:", error);
    return errorResponse(error, "Failed to submit payment");
  }
}
