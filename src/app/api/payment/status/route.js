import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { getDb } from "@/db/index";
import { registrations, paymentTransactions } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAuth(["iiit"]);
    const [payment] = await getDb()
      .select({
        verificationStatus: paymentTransactions.verificationStatus,
        verifiedAt: paymentTransactions.verifiedAt,
      })
      .from(registrations)
      .innerJoin(paymentTransactions, eq(registrations.id, paymentTransactions.registrationId))
      .where(eq(registrations.iiitCode, session.iiitCode))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: "Payment has not been submitted" }, { status: 404 });
    }
    return NextResponse.json({ data: payment }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.statusCode ? error.message : "Unable to load payment status" }, { status: error.statusCode || 500 });
  }
}
