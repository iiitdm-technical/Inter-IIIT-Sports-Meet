import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { getProof } from '@/lib/storage';
import { getDb } from '@/db/index';
import { registrations, paymentTransactions, earlierPayments } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { errorResponse } from '@/lib/security/respond';
import { LIMITS, enforce } from '@/lib/security/rate-limit';

export const runtime = "nodejs";

export async function GET(request) {
  try {
    // 1. Authenticate user
    const session = await requireAuth(["iiit", "admin"]);
    await enforce(`download:${session.userId}`, LIMITS.download);
    
    // 2. Determine target IIIT
    const { searchParams } = new URL(request.url);
    const targetIiitCode = searchParams.get('iiitCode');
    
    if (!targetIiitCode) {
      return NextResponse.json({ error: "Missing iiitCode parameter" }, { status: 400 });
    }

    // 3. Authorization Check
    if (session.role === "iiit" && session.iiitCode !== targetIiitCode) {
      return NextResponse.json({ error: "Forbidden. Cannot access proofs of other IIITs." }, { status: 403 });
    }

    // 4. Retrieve payment transaction to get the exact pathname
    const db = getDb();

    // A receipt of a payment made before the roster was reopened.
    const earlierId = Number.parseInt(searchParams.get('earlier') || '', 10);
    if (searchParams.has('earlier')) {
      const [row] = Number.isInteger(earlierId) && earlierId > 0
        ? await db.select({ proofPathname: earlierPayments.proofPathname }).from(earlierPayments)
          .where(and(eq(earlierPayments.id, earlierId), eq(earlierPayments.iiitCode, targetIiitCode))).limit(1)
        : [];
      if (!row?.proofPathname) {
        return NextResponse.json({ error: "No stored receipt for this earlier payment" }, { status: 404 });
      }
      const earlierProof = await getProof(row.proofPathname);
      return new NextResponse(earlierProof.body, {
        headers: {
          'Content-Type': earlierProof.contentType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${row.proofPathname.split('/').pop()}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    
    // Find the registration
    const regList = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.iiitCode, targetIiitCode))
      .limit(1);

    if (regList.length === 0) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const regId = regList[0].id;

    // Find the payment transaction
    const paymentList = await db
      .select({ proofPathname: paymentTransactions.proofPathname })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.registrationId, regId))
      .limit(1);

    if (paymentList.length === 0) {
      return NextResponse.json({ error: "Payment proof not found in database" }, { status: 404 });
    }

    const pathname = paymentList[0].proofPathname;
    if (!pathname) {
      return NextResponse.json({ error: "No receipt was needed: the earlier payment covered the fee" }, { status: 404 });
    }

    // 5. Stream the private object only after the ownership check.
    const proof = await getProof(pathname);
    return new NextResponse(proof.body, {
      headers: {
        'Content-Type': proof.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${pathname.split('/').pop()}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error("Proof retrieval error:", error);
    return errorResponse(error, "Failed to retrieve proof");
  }
}
