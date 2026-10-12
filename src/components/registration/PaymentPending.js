"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PaymentSection from "./PaymentSection";

export default function PaymentPending({ iiitCode, registrationData }) {
  const router = useRouter();
  const [paymentDetails, setPaymentDetails] = useState({
    transactionDate: "",
    transactionId: "",
    bankName: "",
    proofPathname: "",
    proofFileName: "",
  });
  const [paymentErrors, setPaymentErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  const { registration } = registrationData;
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
    if (!paymentDetails?.transactionId?.trim()) {
      errors.transactionId = "Transaction ID / UTR is required.";
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
    const pErrors = validatePayment();
    if (Object.keys(pErrors).length > 0) {
      setPaymentErrors(pErrors);
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
      window.location.reload();
    } catch (err) {
      setSubmitError(err.message || "An unexpected error occurred during payment submission.");
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (e) {
      console.error(e);
    }
  };

  const canFinalSubmit = !uploadBusy && !isSubmitting;

  return (
    <div className="min-h-screen bg-[#faf6ee] font-sans pb-20">
      <div className="bg-[#0a2112] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#c9972f] block">9th All India Inter-IIIT Sports Meet</span>
              <span className="font-bold text-white text-lg">{registration.iiitName}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm font-bold hover:text-[#f5c518] transition-colors">
            Log out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-8 py-10 text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Registration Locked — Payment Pending</h1>
            <p className="text-amber-800 font-medium">Your student registration has already been submitted and cannot be changed.</p>
          </div>

          <div className="p-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-green-900 mb-2">Registration Submitted Successfully</h3>
              <p className="text-sm text-green-800 mb-1">Your student registration has now been submitted and cannot be edited.</p>
              <p className="text-sm text-green-800 font-bold mb-4">Any corrections after this point must be requested through the IIITDM Kancheepuram Sports Cell.</p>
              
              <h4 className="text-md font-bold text-green-900 mb-1">Next Step: Payment Details</h4>
              <p className="text-sm text-green-800">Complete the payment details and upload the transaction proof to finalize your registration.</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-sm font-bold text-blue-900 mb-2">Before submitting payment, you can verify the submitted participant details below.</h3>
              
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = "/api/registration/csv";
                    a.download = "";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Registration CSV
                </button>
              </div>
              <p className="text-sm text-blue-900 font-black mb-4">Please verify your registration carefully before submitting payment.</p>
              
              <div className="pt-4 border-t border-blue-200">
                <h3 className="text-sm font-bold text-blue-800 mb-1">Your registration contains {uniqueStudentsCount} unique students.</h3>
                <p className="text-sm text-blue-700">Amount payable: <strong>₹{(uniqueStudentsCount * 2500).toLocaleString('en-IN')}</strong></p>
              </div>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-red-800 font-bold text-sm">Submission Failed</h4>
                  <p className="text-sm text-red-700 mt-0.5">{submitError}</p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-black text-gray-900 mb-1">Payment submission is the final step.</h3>
              <p className="text-sm text-gray-700 mb-4">Once payment details and proof are submitted, both the registration and payment record will be permanently locked.</p>
              
              <PaymentSection
                uniqueStudentsCount={uniqueStudentsCount}
                iiitCode={iiitCode}
                paymentDetails={paymentDetails}
                onChange={setPaymentDetails}
                errors={paymentErrors}
                onUploadBusy={setUploadBusy}
              />
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h4 className="text-md font-bold text-red-900 mb-2">Final Submission — Permanent Lock</h4>
              <p className="text-sm text-red-800 mb-2">After submitting payment, you will not be able to modify the registration, payment details, transaction proof, or transaction information.</p>
              <p className="text-sm text-red-800 font-bold">For any correction after final submission, contact the IIITDM Kancheepuram Sports Cell.</p>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                disabled={!canFinalSubmit}
                className="w-full sm:w-auto inline-flex justify-center rounded-lg border border-transparent shadow-sm px-6 py-3 bg-[#1b5e20] text-base font-black text-white hover:bg-green-800 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleFinalSubmit}
              >
                {isSubmitting
                  ? "Submitting…"
                  : uploadBusy
                  ? "Upload in progress…"
                  : "Submit Payment & Lock Registration"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
