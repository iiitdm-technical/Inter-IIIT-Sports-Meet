import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { generateAdminMasterCSV } from "@/lib/csv/generator";

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

    const csvContent = await generateAdminMasterCSV({
      iiit,
      sport,
      event,
      gender,
      rollNumber,
      name,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `inter_iiit_master_registrations_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Admin CSV export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate admin CSV export" },
      { status: error.statusCode || 500 }
    );
  }
}
