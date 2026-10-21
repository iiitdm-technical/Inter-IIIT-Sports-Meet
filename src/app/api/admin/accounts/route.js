import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { getAdminAccounts } from "@/lib/admin/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuth(["admin"]);
    return NextResponse.json({ data: await getAdminAccounts() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load admin accounts");
  }
}
