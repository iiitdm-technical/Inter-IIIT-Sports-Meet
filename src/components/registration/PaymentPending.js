"use client";

import { useEffect, useState } from "react";
import PaymentSection from "./PaymentSection";
import LockedHeader from "./LockedHeader";
import RegistrationSteps from "./RegistrationSteps";
import RosterSummary from "./RosterSummary";
import { SPORTS_CELL_EMAIL, formatRupees, getRegistrationFee } from "@/lib/registration/labels";
import { GLOBAL_RULES } from "@/lib/sports/config";

const EMPTY_PAYMENT_DETAILS = {
  transactionDate: "",
  transactionId: "",
  proofPathname: "",
  proofFileName: "",
};

function getStoredPaymentDetails(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return { ...EMPTY_PAYMENT_DETAILS };
    }

    return {
      transactionDate: typeof saved.transactionDate === "string" ? saved.transactionDate : "",
      transactionId: typeof saved.transactionId === "string" ? saved.transactionId : "",
      proofPathname: typeof saved.proofPathname === "string" ? saved.proofPathname : "",
      proofFileName: typeof saved.proofFileName === "string" ? saved.proofFileName : "",
    };
  } catch {
    return { ...EMPTY_PAYMENT_DETAILS };
  }
}

export default function PaymentPending({ iiitCode, registrationData }) {
  // Keep entered details and the uploaded proof reference in this browser so a
  // reload or expired session does not lose them before submission.
  const storageKey = `inter_iiit_payment_${iiitCode}`;
  const [paymentDetails, setPaymentDetails] = useState(() => getStoredPaymentDetails(storageKey));
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(paymentDetails));
    } catch {
      // Storage is a convenience; the form still works without it.
    }
  }, [storageKey, paymentDetails]);

  const { registration, entries } = registrationData;
  const uniqueStudentsCount = registration.totalStudentsCount;
  const totalPayable = getRegistrationFee(uniqueStudentsCount);

  const validatePayment = () => {
    const errors = {};
    if (!paymentDetails?.transactionDate) {
      errors.transactionDate = "Transaction date is required.";
    } else {
      const d = new Date(paymentDetails.transactionDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (d > today) errors.transactionDate = "Transaction date cannot be in the future.";
    }
    const transactionId = paymentDetails?.transactionId?.trim() || "";
    if (!transactionId) {
      errors.transactionId = "Transaction ID / UTR is required.";
    } else if (transactionId.length < 5 || transactionId.length > 64) {
      errors.transactionId = "Transaction ID / UTR must be 5 to 64 characters.";
    }
    if (!paymentDetails?.proofPathname) {
      errors.proof = "Transaction proof is required.";
    }
    return errors;
  };

  const handleFinalSubmit = async () => {
    setSubmitError("");
    setAttempted(true);
    if (Object.keys(validatePayment()).length > 0) {
      // Errors render on the next paint; then move focus to the first one.
      setTimeout(() => document.querySelector("[aria-invalid='true']")?.focus(), 0);
      return;
    }
    if (uploadBusy || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentDetails: {
            transactionDate: paymentDetails.transactionDate,
            transactionId: paymentDetails.transactionId,
            proofPathname: paymentDetails.proofPathname,
          },
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((data && data.error) ? data.error : `Submission failed with status ${res.status}`);
      }

      // Success — reload to show submitted/locked state
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // The server has the payment; a stale local copy is harmless.
      }
      window.location.reload();
    } catch (err) {
      setSubmitError(err.message || "An unexpected error occurred during payment submission.");
      setIsSubmitting(false);
    }
  };

  // After the first submit attempt, errors update as the coordinator fixes them.
  const paymentErrors = attempted ? validatePayment() : {};
  const canFinalSubmit = !uploadBusy && !isSubmitting;

  return (
    <div className="min-h-screen bg-ivory pb-20">
      <LockedHeader iiitName={registration.iiitName} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-10 space-y-5">
        <section className="card card-accent overflow-hidden">
          <div className="px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
            <p className="eyebrow">Step 2 of 3 · Payment</p>
            <h1 className="heading-section mt-2">Roster locked — payment pending</h1>
            <p className="mt-3 max-w-2xl text-[15px] text-ink-soft">
              Your roster of {uniqueStudentsCount} {uniqueStudentsCount === 1 ? "student" : "students"} is saved and can no longer be edited. The total payable is <strong className="text-ink">{formatRupees(totalPayable)}</strong>, including {GLOBAL_RULES.REGISTRATION_GST_PERCENT}% GST and the refundable caution deposit. Complete payment on the portal, then submit the transaction date, reference, and receipt below.
            </p>
          </div>
          <div className="border-t border-line bg-ivory/70 px-5 py-5 sm:px-8">
            <div className="mx-auto max-w-lg">
              <RegistrationSteps current={1} />
            </div>
          </div>
        </section>

        <details className="group card overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-ivory/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary sm:px-6">
            <h2 className="heading-card">Check your locked roster <span className="font-medium text-ink-muted">({entries?.length || 0} event entries)</span></h2>
            <svg className="h-5 w-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="space-y-3 border-t border-line bg-ivory/60 px-5 py-4 sm:px-6">
            <RosterSummary entries={entries} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href="/api/registration/csv" download className="btn btn-outline btn-sm">
                Download roster as CSV
              </a>
              <p className="meta">
                Found a mistake? Email <a href={`mailto:${SPORTS_CELL_EMAIL}`} className="font-semibold text-brand-primary underline underline-offset-2">{SPORTS_CELL_EMAIL}</a> before paying.
              </p>
            </div>
          </div>
        </details>

        {submitError && (
          <div role="alert" className="rounded-card border border-red-200 bg-red-50 p-4">
            <h2 className="text-sm font-bold text-red-800">Payment could not be submitted</h2>
            <p className="mt-0.5 text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <section className="card p-5 sm:p-8">
          <PaymentSection
            uniqueStudentsCount={uniqueStudentsCount}
            paymentDetails={paymentDetails}
            onChange={setPaymentDetails}
            errors={paymentErrors}
            onUploadBusy={setUploadBusy}
          />

          <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-soft sm:max-w-md">
              Submitting locks your payment details and proof. The organizers then check the transfer against their bank statement.
            </p>
            <button
              type="button"
              disabled={!canFinalSubmit}
              className="btn btn-primary w-full shrink-0 px-7 sm:w-auto"
              onClick={handleFinalSubmit}
            >
              {isSubmitting
                ? "Submitting…"
                : uploadBusy
                ? "Upload in progress…"
                : "Submit payment"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
