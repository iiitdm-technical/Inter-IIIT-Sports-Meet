import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { getAdminStats } from "@/lib/admin/service";

export async function GET() {
  try {
    await requireAuth(["admin"]);
    const stats = await getAdminStats();
    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return errorResponse(error, "Failed to fetch admin stats");
  }
}
