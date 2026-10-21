import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRegistrationForIIIT } from "@/lib/registration/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    let registrationState = null;
    if (session.role === "iiit" && session.iiitCode) {
      registrationState = await getRegistrationForIIIT(session.iiitCode);
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        email: session.email || null,
        displayName: session.displayName || null,
        role: session.role,
        iiitName: session.iiitName,
        iiitCode: session.iiitCode,
      },
      registration: registrationState,
      registrationClosesAt: process.env.REGISTRATION_CLOSES_AT || null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Session check API error:", error);
    return NextResponse.json(
      { error: "Could not check your session" },
      { status: 500 }
    );
  }
}
