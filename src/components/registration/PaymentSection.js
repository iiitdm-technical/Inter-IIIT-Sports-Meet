"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

const RATE_PER_STUDENT = 2500;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

/**
 * PaymentSection — Embeds inside ReviewModal.
 * Manages private proof upload, transaction form fields, and communicates state upward.
 *
 * Props:
 *  uniqueStudentsCount  — number
 *  paymentDetails       — { transactionDate, transactionId, bankName, proofPathname, proofFileName }
 *  onChange             — fn(details) called on any change
 *  errors               — { transactionDate?, transactionId?, proof? }
 *  onUploadBusy         — fn(bool) so parent can gate submit button
 */
export default function PaymentSection({ uniqueStudentsCount, paymentDetails, onChange, errors = {}, onUploadBusy }) {
  const amount = uniqueStudentsCount * RATE_PER_STUDENT;
  const fileInputRef = useRef(null);

  // idle | uploading | success | error
  const [uploadStatus, setUploadStatus] = useState(
    paymentDetails?.proofPathname ? "success" : "idle"
  );
  const [uploadError, setUploadError] = useState("");
  const [localFile, setLocalFile] = useState(null);
  const [upiPayment, setUpiPayment] = useState(null);

  useEffect(() => {
    let active = true;
    fetch("/api/payment/upi", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load payment QR");
        return response.json();
      })
      .then((data) => { if (active) setUpiPayment(data); })
      .catch(() => { if (active) setUpiPayment({ configured: false }); });
    return () => { active = false; };
  }, []);

  const handleFieldChange = (field, value) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadStatus("error");
      setUploadError(`Invalid file type. Accepted: PDF, JPG, JPEG, PNG.`);
      onChange((current) => ({ ...current, proofPathname: "", proofFileName: "" }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadStatus("error");
      setUploadError(`File is ${formatFileSize(file.size)}, exceeding the 4 MB maximum.`);
      onChange((current) => ({ ...current, proofPathname: "", proofFileName: "" }));
      return;
    }

    setLocalFile(file);
    setUploadStatus("uploading");
    if (onUploadBusy) onUploadBusy(true);
    onChange((current) => ({ ...current, proofPathname: "", proofFileName: "" }));

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      setUploadStatus("success");
      onChange((current) => ({ ...current, proofPathname: result.pathname, proofFileName: file.name }));
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err.message || "Upload failed. Please try again.");
      onChange((current) => ({ ...current, proofPathname: "", proofFileName: "" }));
    } finally {
      if (onUploadBusy) onUploadBusy(false);
    }
  };

  const handleReplaceFile = () => {
    setUploadStatus("idle");
    setUploadError("");
    setLocalFile(null);
    onChange((current) => ({ ...current, proofPathname: "", proofFileName: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const localToday = new Date();
  localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset());
  const todayStr = localToday.toISOString().slice(0, 10);
  const uploadedFileName = paymentDetails?.proofFileName || localFile?.name || "";

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h4 className="text-base font-black text-gray-900 uppercase tracking-wider">Payment Details</h4>
      </div>

      {/* Amount Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Unique Students</p>
          <p className="text-2xl font-black text-gray-900">{uniqueStudentsCount}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Rate Per Student</p>
          <p className="text-lg font-black text-gray-700">₹2,500</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-center">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">Amount Payable</p>
          <p className="text-xl font-black text-amber-800">{formatCurrency(amount)}</p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-5">
        <h5 className="text-sm font-black uppercase tracking-wider text-green-950">Pay by UPI</h5>
        {upiPayment?.configured ? (
          <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Image src={upiPayment.qrDataUrl} alt={`UPI payment QR for ${upiPayment.payeeName}, amount ${formatCurrency(upiPayment.amount)}`} width={200} height={200} unoptimized className="rounded-lg border border-green-200 bg-white p-2" />
            <div className="text-sm text-green-950">
              <p>Scan with your UPI app and confirm the payee and amount before paying.</p>
              <p className="mt-3 font-bold">Payee: {upiPayment.payeeName}</p>
              <p className="font-bold">UPI ID: {upiPayment.upiId}</p>
              <p className="font-bold">Amount: {formatCurrency(upiPayment.amount)}</p>
              <a href={upiPayment.paymentUri} className="mt-3 inline-block font-bold underline underline-offset-2">Open UPI app</a>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-green-900">The organizer will publish the official UPI QR here. You can submit a payment made through an approved alternate method.</p>
        )}
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Transaction Date */}
        <div>
          <label htmlFor="payment-transaction-date" className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
            Transaction Date <span className="text-red-500">*</span>
          </label>
          <input
            id="payment-transaction-date"
            type="date"
            max={todayStr}
            value={paymentDetails?.transactionDate || ""}
            onChange={(e) => handleFieldChange("transactionDate", e.target.value)}
            className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors ${
              errors.transactionDate
                ? "border-red-400 bg-red-50 focus:border-red-500"
                : "border-gray-300 focus:border-[#1b5e20]"
            }`}
          />
          {errors.transactionDate && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.transactionDate}</p>
          )}
        </div>

        {/* Transaction ID */}
        <div>
          <label htmlFor="payment-transaction-id" className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
            Transaction ID / UTR Number <span className="text-red-500">*</span>
          </label>
          <input
            id="payment-transaction-id"
            type="text"
            placeholder="e.g. 423108765432"
            value={paymentDetails?.transactionId || ""}
            onChange={(e) => handleFieldChange("transactionId", e.target.value)}
            className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors font-mono ${
              errors.transactionId
                ? "border-red-400 bg-red-50 focus:border-red-500"
                : "border-gray-300 focus:border-[#1b5e20]"
            }`}
          />
          {errors.transactionId && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.transactionId}</p>
          )}
        </div>

        {/* Bank Name */}
        <div>
          <label htmlFor="payment-bank-name" className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
            Bank Name <span className="text-gray-400 font-medium normal-case text-xs">(optional)</span>
          </label>
          <input
            id="payment-bank-name"
            type="text"
            placeholder="e.g. State Bank of India"
            value={paymentDetails?.bankName || ""}
            onChange={(e) => handleFieldChange("bankName", e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20] transition-colors"
          />
        </div>

        {/* Payment Mode */}
        <div>
          <label htmlFor="payment-mode" className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
            Payment Mode <span className="text-red-500">*</span>
          </label>
          <select
            id="payment-mode"
            value={paymentDetails?.paymentMode || ""}
            onChange={(e) => handleFieldChange("paymentMode", e.target.value)}
            className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors bg-white ${
              errors.paymentMode
                ? "border-red-400 bg-red-50 focus:border-red-500"
                : "border-gray-300 focus:border-[#1b5e20]"
            }`}
          >
            <option value="" disabled>Select payment mode</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="UPI">UPI</option>
            <option value="OTHER">Other</option>
          </select>
          {errors.paymentMode && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.paymentMode}</p>
          )}
        </div>

        {/* Other Payment Mode */}
        {paymentDetails?.paymentMode === "OTHER" && (
          <div>
            <label htmlFor="other-payment-mode" className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
              Other Payment Mode <span className="text-red-500">*</span>
            </label>
            <input
              id="other-payment-mode"
              type="text"
              placeholder="e.g. Demand Draft"
              value={paymentDetails?.otherPaymentMode || ""}
              onChange={(e) => handleFieldChange("otherPaymentMode", e.target.value)}
              className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors ${
                errors.otherPaymentMode
                  ? "border-red-400 bg-red-50 focus:border-red-500"
                  : "border-gray-300 focus:border-[#1b5e20]"
              }`}
            />
            {errors.otherPaymentMode && (
              <p className="mt-1 text-xs text-red-600 font-medium">{errors.otherPaymentMode}</p>
            )}
          </div>
        )}

        {/* Proof Upload */}
        <div>
          <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
            Transaction Proof <span className="text-red-500">*</span>
          </label>

          {uploadStatus !== "success" && (
            <div
              className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                errors.proof || uploadStatus === "error"
                  ? "border-red-300 bg-red-50"
                  : uploadStatus === "uploading"
                  ? "border-green-300 bg-green-50"
                  : "border-gray-300 hover:border-[#1b5e20] bg-gray-50 hover:bg-green-50"
              }`}
              onClick={() => uploadStatus !== "uploading" && fileInputRef.current?.click()}
            >
              <div className="p-5 text-center">
                {uploadStatus === "uploading" ? (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-6 h-6 text-green-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm font-bold text-green-700">Uploading {localFile?.name}…</p>
                    <p className="text-xs text-gray-500">{localFile && formatFileSize(localFile.size)}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className={`w-8 h-8 ${uploadStatus === "error" ? "text-red-400" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-gray-700">Choose File / Upload Proof</p>
                      <p className="text-xs text-gray-500 mt-0.5">Accepted: PDF, JPG, JPEG, PNG — Maximum: 4 MB</p>
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploadStatus === "uploading"}
              />
            </div>
          )}

          {uploadStatus === "success" && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-green-800">Upload successful</p>
                  <p className="text-xs text-green-700 mt-0.5 truncate font-mono">{uploadedFileName}</p>
                  {localFile && (
                    <p className="text-xs text-green-600 mt-0.5">{localFile.type} — {formatFileSize(localFile.size)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleReplaceFile}
                  className="flex-shrink-0 text-xs font-bold text-green-700 hover:text-green-900 underline underline-offset-2"
                >
                  Replace
                </button>
              </div>
            </div>
          )}

          {uploadStatus === "error" && uploadError && (
            <p className="mt-1.5 text-xs text-red-600 font-medium flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {uploadError}
            </p>
          )}
          {errors.proof && uploadStatus !== "success" && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.proof}</p>
          )}
        </div>
      </div>
    </div>
  );
}
