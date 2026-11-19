import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { getDb } from "@/db/index";
import { registrations, paymentTransactions, earlierPayments } from "@/db/schema";

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
    // Payments made before a reopen must be verified too.
    const [pendingEarlier] = await getDb().select({ id: earlierPayments.id }).from(earlierPayments)
      .where(and(eq(earlierPayments.iiitCode, session.iiitCode), eq(earlierPayments.verificationStatus, "pending"))).limit(1);
    const data = pendingEarlier ? { verificationStatus: "pending", verifiedAt: null } : payment;
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load payment status");
  }
}
