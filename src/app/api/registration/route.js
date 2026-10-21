import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { getSession } from "@/lib/auth/session";
import { getRegistrationForIIIT } from "@/lib/registration/service";

export async function GET(request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let targetIIITCode = session.iiitCode;

    // Admin can inspect any IIIT's registration data
    if (session.role === "admin") {
      const requestedCode = searchParams.get("iiitCode");
      if (requestedCode) {
        targetIIITCode = requestedCode;
      } else {
        return NextResponse.json(
          { error: "Admin must specify ?iiitCode=slug or use /api/admin/registrations" },
          { status: 400 }
        );
      }
    }

    if (!targetIIITCode) {
      return NextResponse.json(
        { error: "No IIIT associated with this account" },
        { status: 400 }
      );
    }

    const data = await getRegistrationForIIIT(targetIIITCode);
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get registration error:", error);
    return errorResponse(error, "Failed to retrieve registration data");
  }
}
