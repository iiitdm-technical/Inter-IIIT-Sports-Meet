import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/request";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getSession();
    await destroySession();
    if (session) await audit({ actor: session.username, role: session.role, action: "logout", ip: await getClientIp() });
    return NextResponse.json({ success: true, message: "Successfully logged out" });
  } catch (error) {
    console.error("Logout API error:", error);
    return NextResponse.json({ error: "Could not sign out. Please try again." }, { status: 500 });
  }
}
