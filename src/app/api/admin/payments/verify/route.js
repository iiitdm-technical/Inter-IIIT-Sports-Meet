import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { verifyPayment } from "@/lib/admin/service";

export const runtime = "nodejs";

const bodySchema = z.object({
  iiitCode: z.string().min(1).max(64),
  transactionId: z.string().trim().min(5).max(128),
  amount: z.number().int().positive(),
  bankConfirmed: z.literal(true),
});

export async function POST(request) {
  try {
    const admin = await requireAuth(["admin"]);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter the UTR and amount, and confirm they match the bank statement" }, { status: 400 });
    }
    const { iiitCode, transactionId, amount } = parsed.data;
    const result = await verifyPayment(iiitCode, transactionId, amount, admin.username);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Payment verification failed:", error);
    return NextResponse.json({ error: error.statusCode ? error.message : "Payment verification failed" }, { status: error.statusCode || 500 });
  }
}
