import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { getRegistrationFee } from "@/lib/registration/labels";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { requireAuth } from "@/lib/auth/session";
import { getDb } from "@/db/index";
import { registrations } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAuth(["iiit"]);
    const [registration] = await getDb().select({
      status: registrations.status,
      totalStudentsCount: registrations.totalStudentsCount,
    }).from(registrations).where(eq(registrations.iiitCode, session.iiitCode)).limit(1);

    if (!registration || registration.status !== "payment_pending") {
      return NextResponse.json({ error: "A locked registration awaiting payment is required" }, { status: 409 });
    }

    const upiId = process.env.PAYMENT_UPI_ID?.trim();
    const payeeName = process.env.PAYMENT_PAYEE_NAME?.trim();
    if (!upiId || !payeeName || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(upiId)) {
      return NextResponse.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const amount = getRegistrationFee(registration.totalStudentsCount);
    const query = new URLSearchParams({ pa: upiId, pn: payeeName, am: String(amount), cu: "INR" });
    const paymentUri = `upi://pay?${query.toString()}`;
    const qrDataUrl = await QRCode.toDataURL(paymentUri, { width: 280, margin: 2, errorCorrectionLevel: "M" });
    return NextResponse.json({ configured: true, upiId, payeeName, amount, paymentUri, qrDataUrl }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, "Unable to load payment QR");
  }
}
