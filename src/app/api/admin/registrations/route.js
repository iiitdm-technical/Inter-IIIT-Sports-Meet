import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { getAdminRegistrationsOverview } from "@/lib/admin/service";

export async function GET() {
  try {
    await requireAuth(["admin"]);
    const list = await getAdminRegistrationsOverview();
    return NextResponse.json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error("Admin registrations list error:", error);
    return errorResponse(error, "Failed to fetch registrations overview");
  }
}
