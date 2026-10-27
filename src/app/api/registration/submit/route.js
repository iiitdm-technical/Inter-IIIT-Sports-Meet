import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { getClientIp } from "@/lib/security/request";
import { audit } from "@/lib/security/audit";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { requireAuth } from "@/lib/auth/session";
import { submitRegistration } from "@/lib/registration/service";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    // Only logged-in IIIT users can submit registration
    const session = await requireAuth(["iiit"]);

    if (!session.iiitCode) {
      return NextResponse.json(
        { error: "No IIIT code linked to this session" },
        { status: 400 }
      );
    }

    await enforce(`submit:${session.userId}`, LIMITS.submit);
    const body = await request.json();
    const result = await submitRegistration(
      session.iiitCode,
      body,
      session.username
    );
    await audit({ actor: session.username, role: session.role, action: "roster_saved", target: session.iiitCode, ip: await getClientIp(), details: { students: result.totalStudentsCount, entries: result.totalEntriesCount } });

    return NextResponse.json({
      success: true,
      message: "Roster saved. You can edit it until payment details and receipt are submitted.",
      data: result,
    });
  } catch (error) {
    console.error("Submit registration error:", error);
    return errorResponse(error, "Failed to submit registration");
  }
}
