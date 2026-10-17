"use client";

import { useEffect, useState } from "react";
import PaymentSection from "./PaymentSection";
import LockedHeader from "./LockedHeader";
import RegistrationSteps from "./RegistrationSteps";
import RosterSummary from "./RosterSummary";
import { SPORTS_CELL_EMAIL, formatRupees, getRegistrationFee } from "@/lib/registration/labels";

const EMPTY_PAYMENT_DETAILS = {
  transactionDate: "",
  transactionId: "",
  bankName: "",
  proofPathname: "",
  proofFileName: "",
};

export default function PaymentPending({ iiitCode, registrationData }) {
  // Keep entered details and the uploaded proof reference in this browser so a
  // reload or expired session does not lose them before submission.
  const storageKey = `inter_iiit_payment_${iiitCode}`;
  const [paymentDetails, setPaymentDetails] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      return saved && typeof saved === "object" ? { ...EMPTY_PAYMENT_DETAILS, ...saved } : EMPTY_PAYMENT_DETAILS;
    } catch {
      return EMPTY_PAYMENT_DETAILS;
    }
  });
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
    if (!paymentDetails?.paymentMode) {
      errors.paymentMode = "Payment Mode is required.";
    } else if (paymentDetails.paymentMode === "OTHER" && !paymentDetails?.otherPaymentMode?.trim()) {
      errors.otherPaymentMode = "Please specify the payment mode.";
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
        body: JSON.stringify({ paymentDetails }),
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
  const amount = getRegistrationFee(uniqueStudentsCount);

  return (
    <div className="min-h-screen bg-[#faf6ee] font-sans pb-20">
      <LockedHeader iiitName={registration.iiitName} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-8 sm:px-8">
            <h1 className="text-center text-2xl sm:text-3xl font-black text-gray-900">Roster locked — payment pending</h1>
            <p className="mt-2 text-center text-sm text-amber-900">
              Your roster of {uniqueStudentsCount} {uniqueStudentsCount === 1 ? "student" : "students"} is saved and can no longer be edited. Pay {formatRupees(amount)} and submit the proof below.
            </p>
            <div className="mx-auto mt-6 max-w-md">
              <RegistrationSteps current={1} />
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <details className="group mb-8 rounded-xl border border-gray-200 bg-gray-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b5e20]">
                <h2 className="text-sm font-bold">Check your locked roster ({entries?.length || 0} event entries)</h2>
                <svg className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="space-y-3 px-4 pb-4">
                <RosterSummary entries={entries} />
                <a href="/api/registration/csv" download className="inline-flex items-center gap-2 text-sm font-bold text-[#1b5e20] underline underline-offset-2">
                  Download roster as CSV
                </a>
                <p className="text-xs text-gray-600">
                  Found a mistake? Email <a href={`mailto:${SPORTS_CELL_EMAIL}`} className="font-bold underline">{SPORTS_CELL_EMAIL}</a> before paying.
                </p>
              </div>
            </details>

            {submitError && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h2 className="text-red-800 font-bold text-sm">Payment could not be submitted</h2>
                <p className="text-sm text-red-700 mt-0.5">{submitError}</p>
              </div>
            )}

            <PaymentSection
              uniqueStudentsCount={uniqueStudentsCount}
              paymentDetails={paymentDetails}
              onChange={setPaymentDetails}
              errors={paymentErrors}
              onUploadBusy={setUploadBusy}
            />

            <div className="mt-8 flex flex-col gap-4 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700 sm:max-w-md">
                Submitting locks your payment details and proof. The organizers then check the transfer against their bank statement.
              </p>
              <button
                type="button"
                disabled={!canFinalSubmit}
                className="w-full sm:w-auto shrink-0 inline-flex justify-center rounded-lg px-6 py-3 bg-[#1b5e20] text-base font-black text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b5e20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleFinalSubmit}
              >
                {isSubmitting
                  ? "Submitting…"
                  : uploadBusy
                  ? "Upload in progress…"
                  : "Submit payment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
