import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { getAdminFilteredEntries } from "@/lib/admin/service";

export async function GET(request) {
  try {
    await requireAuth(["admin"]);

    const { searchParams } = new URL(request.url);
    const iiit = searchParams.get("iiit") || undefined;
    const sport = searchParams.get("sport") || undefined;
    const event = searchParams.get("event") || undefined;
    const gender = searchParams.get("gender") || undefined;
    const rollNumber = searchParams.get("rollNumber") || undefined;
    const name = searchParams.get("name") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await getAdminFilteredEntries({
      iiit,
      sport,
      event,
      gender,
      rollNumber,
      name,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Admin entries filter error:", error);
    return errorResponse(error, "Failed to search participant entries");
  }
}
