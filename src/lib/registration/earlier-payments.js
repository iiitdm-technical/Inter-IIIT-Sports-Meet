import { asc, eq } from "drizzle-orm";
import { earlierPayments } from "../../db/schema.js";

/**
 * Payments carried over from rosters the Sports SAC reopened for edits.
 * See the earlier_payments table in the schema.
 */

export async function listEarlierPayments(db, iiitCode) {
  return db.select().from(earlierPayments).where(eq(earlierPayments.iiitCode, iiitCode)).orderBy(asc(earlierPayments.id));
}

export function sumEarlierPayments(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

/** What the IIIT and the admin screens may see of an earlier payment. */
export function describeEarlierPayment(row) {
  return {
    id: row.id,
    amount: row.amount,
    uniqueStudentCount: row.uniqueStudentCount,
    transactionId: row.transactionId,
    transactionDate: row.transactionDate,
    paymentMode: row.paymentMode,
    hasProof: Boolean(row.proofPathname),
    verificationStatus: row.verificationStatus,
    verifiedAt: row.verifiedAt,
    verifiedBy: row.verifiedBy,
    note: row.note,
    paidAt: row.paidAt,
  };
}

/** Copies a submitted payment into earlier_payments before its roster is reopened. */
export function earlierPaymentFrom(payment, iiitCode, carriedBy) {
  return {
    iiitCode,
    amount: payment.amount,
    uniqueStudentCount: payment.uniqueStudentCount,
    transactionDate: payment.transactionDate,
    transactionId: payment.transactionId,
    paymentMode: payment.paymentMode,
    proofPathname: payment.proofPathname || null,
    proofFileName: payment.proofFileName || null,
    proofContentType: payment.proofContentType || null,
    verificationStatus: payment.verificationStatus,
    verifiedAt: payment.verifiedAt,
    verifiedBy: payment.verifiedBy,
    paidAt: payment.createdAt,
    carriedBy,
  };
}
