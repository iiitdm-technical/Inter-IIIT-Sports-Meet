import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getAdminAccounts } from "@/lib/admin/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuth(["admin"]);
    return NextResponse.json({ data: await getAdminAccounts() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.statusCode ? error.message : "Unable to load admin accounts" }, { status: error.statusCode || 500 });
  }
}
