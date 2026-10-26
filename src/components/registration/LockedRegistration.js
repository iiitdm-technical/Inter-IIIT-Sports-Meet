"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LockedHeader from "./LockedHeader";
import RegistrationSteps from "./RegistrationSteps";
import RosterSummary from "./RosterSummary";
import { GLOBAL_RULES } from "@/lib/sports/config";
import { SPORTS_CELL_EMAIL, formatRupees } from "@/lib/registration/labels";
import { formatArrival, formatTravelDate } from "@/lib/registration/arrival";

export default function LockedRegistration({ registrationData }) {
  const [verification, setVerification] = useState({
    status: registrationData.payment?.verificationStatus || "pending",
    verifiedAt: registrationData.payment?.verifiedAt || null,
  });

  const refreshPaymentStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/payment/status", { cache: "no-store" });
      if (!response.ok) return;
      const { data } = await response.json();
      if (data?.verificationStatus === "verified") {
        setVerification({ status: "verified", verifiedAt: data.verifiedAt });
      }
    } catch {
      // Keep the last known status until the next check.
    }
  }, []);

  useEffect(() => {
    if (verification.status === "verified") return;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      await refreshPaymentStatus();
    };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [verification.status, refreshPaymentStatus]);

  const { registration, students, entries, payment } = registrationData;
  const isPaymentVerified = verification.status === "verified";

  const downloadCsv = () => {
    const a = document.createElement("a");
    a.href = "/api/registration/csv";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatDateTime = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";
  const detailLabel = "text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted";
  const detailValue = "mt-0.5 text-sm font-semibold text-ink";

  return (
    <div className="min-h-screen bg-ivory pb-20">
      <LockedHeader iiitName={registration.iiitName} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-10 space-y-5">
        <section className="card card-accent overflow-hidden">
          <div className="flex flex-col gap-4 px-5 pt-6 pb-5 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:pt-8">
            <div>
              <p className="eyebrow">{isPaymentVerified ? "All steps complete" : "Step 3 of 3 · Verification"}</p>
              <h1 className="heading-section mt-2">{isPaymentVerified ? "Registration complete" : "Payment submitted — awaiting verification"}</h1>
              <p className="mt-3 max-w-2xl text-[15px] text-ink-soft">{isPaymentVerified ? "The organizers have confirmed your bank transfer. Your registration is complete and locked." : "Your roster and payment details are locked. The organizers will check the transfer against their bank statement; this page updates when they do."}</p>
            </div>
            <span className={`chip shrink-0 self-start ${isPaymentVerified ? "" : "chip-gold"}`}>
              {isPaymentVerified ? "Verified" : "Awaiting verification"}
            </span>
          </div>
          <div className="border-t border-line bg-ivory/70 px-5 py-5 sm:px-8">
            <div className="mx-auto max-w-lg">
              <RegistrationSteps current={isPaymentVerified ? 3 : 2} />
            </div>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="card p-5 sm:p-6" aria-labelledby="locked-summary-title">
            <h2 id="locked-summary-title" className="heading-card">Summary</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="card-tint rounded-control p-3">
                <dt className={detailLabel}>Unique students</dt>
                <dd className="stat-number mt-1 text-3xl text-ink">{students?.length || 0}</dd>
              </div>
              <div className="card-tint rounded-control p-3">
                <dt className={detailLabel}>Event entries</dt>
                <dd className="stat-number mt-1 text-3xl text-ink">{entries?.length || 0}</dd>
              </div>
              <div>
                <dt className={detailLabel}>Submitted at</dt>
                <dd className={detailValue}>{formatDateTime(registration.submittedAt)}</dd>
              </div>
              <div>
                <dt className={detailLabel}>Submitted by</dt>
                <dd className={detailValue}>{registration.submittedBy || "N/A"}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="locked-contact-title">
            <h2 id="locked-contact-title" className="heading-card">Contact Details</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className={detailLabel}>Faculty in-charge</dt>
                <dd className={detailValue}>{registration.contactName || "—"}</dd>
              </div>
              <div>
                <dt className={detailLabel}>Email</dt>
                <dd className={`${detailValue} break-all`}>{registration.contactEmail || "—"}</dd>
              </div>
              <div>
                <dt className={detailLabel}>Phone</dt>
                <dd className={detailValue}>{registration.contactPhone || "—"}</dd>
              </div>
              <div>
                <dt className={detailLabel}>Arrival</dt>
                <dd className={detailValue}>{formatArrival(registration) || "—"}</dd>
              </div>
              {registration.departureDate && (
                <div>
                  <dt className={detailLabel}>Departure</dt>
                  <dd className={detailValue}>{formatTravelDate(registration.departureDate)}</dd>
                </div>
              )}
              {registration.notes && (
                <div>
                  <dt className={detailLabel}>Notes</dt>
                  <dd className={`${detailValue} whitespace-pre-line`}>{registration.notes}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        {payment && (
          <section className="card p-5 sm:p-6" aria-labelledby="locked-payment-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 id="locked-payment-title" className="heading-card">Payment Details</h2>
              <div className="text-right">
                <span role="status" aria-live="polite" className={`chip ${isPaymentVerified ? "" : "chip-gold"}`}>
                  {isPaymentVerified ? "Bank Verified" : "Awaiting Bank Verification"}
                </span>
                {isPaymentVerified && verification.verifiedAt && (
                  <span className="meta mt-1 block">Verified {new Date(verification.verifiedAt).toLocaleDateString("en-IN")}</span>
                )}
                {!isPaymentVerified && (
                  <button type="button" onClick={refreshPaymentStatus} className="mt-1.5 block w-full text-right text-sm font-semibold text-brand-primary underline underline-offset-2">Check status now</button>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <dl className="space-y-2 rounded-control border border-[#ecd27a] bg-gold-wash p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-ink-soft">Unique students</dt>
                  <dd className="font-semibold text-ink">{payment.uniqueStudentCount}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-ink-soft">Rate</dt>
                  <dd className="font-semibold text-ink">{formatRupees(GLOBAL_RULES.REGISTRATION_FEE_PER_STUDENT)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-[#ecd27a] pt-2">
                  <dt className="text-sm font-semibold text-gold-text">Amount paid</dt>
                  <dd className="stat-number text-3xl text-ink">{formatRupees(payment.amount)}</dd>
                </div>
              </dl>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <dt className={detailLabel}>Transaction ID / UTR</dt>
                  <dd className={`${detailValue} font-mono break-all`}>{payment.transactionId}</dd>
                </div>
                <div>
                  <dt className={detailLabel}>Transaction date</dt>
                  <dd className={detailValue}>
                    {payment.transactionDate ? new Date(payment.transactionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className={detailLabel}>Payment mode</dt>
                  <dd className={detailValue}>
                    {payment.paymentMode === "OTHER"
                      ? `Other (${payment.otherPaymentMode})`
                      : payment.paymentMode || "Not provided"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className={detailLabel}>Bank</dt>
                  <dd className={detailValue}>{payment.bankName || "Not provided"}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        <section className="card p-5 sm:p-6" aria-labelledby="locked-roster-title">
          <h2 id="locked-roster-title" className="heading-card">Locked roster</h2>
          <div className="mt-4">
            <RosterSummary entries={entries} />
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            Need a correction? Email the IIITDM Kancheepuram Sports Cell at{" "}
            <a href={`mailto:${SPORTS_CELL_EMAIL}`} className="font-semibold text-brand-primary underline underline-offset-2">{SPORTS_CELL_EMAIL}</a>.
          </p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={downloadCsv} className="btn btn-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Registration CSV
          </button>
          {payment?.proofPathname && (
            <a
              href={`/api/payment/proof?iiitCode=${registration.iiitCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              View payment proof
            </a>
          )}
          <Link href="/" className="btn btn-outline">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
