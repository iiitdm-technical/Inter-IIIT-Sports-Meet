"use client";

import { useState, useRef, useEffect } from "react";
import { getRegistrationFee } from "@/lib/registration/labels";
import { GLOBAL_RULES } from "@/lib/sports/config";
import Image from "next/image";

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
  const amount = getRegistrationFee(uniqueStudentsCount);
  const fileInputRef = useRef(null);

  // idle | uploading | success | error
  const [uploadStatus, setUploadStatus] = useState(
    paymentDetails?.proofPathname ? "success" : "idle"
  );
  const [uploadError, setUploadError] = useState("");
  const [localFile, setLocalFile] = useState(null);
  const [upiPayment, setUpiPayment] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const uploadFile = async (file) => {
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

  const handleFileSelect = (e) => uploadFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploadStatus === "uploading") return;
    uploadFile(e.dataTransfer.files?.[0]);
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
    <div>
      <div className="mb-5">
        <h2 className="heading-section text-[2rem]">Payment Details</h2>
        <p className="meta mt-1">Pay the amount below, then record the transfer and upload its proof.</p>
      </div>

      {/* Amount Summary */}
      <dl className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card-tint rounded-control p-3 sm:p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Students</dt>
          <dd className="stat-number mt-1 text-3xl text-ink">{uniqueStudentsCount}</dd>
        </div>
        <div className="card-tint rounded-control p-3 sm:p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Per student</dt>
          <dd className="stat-number mt-1 text-3xl text-ink">{formatCurrency(GLOBAL_RULES.REGISTRATION_FEE_PER_STUDENT)}</dd>
        </div>
        <div className="rounded-control border border-[#ecd27a] bg-gold-wash p-3 sm:p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-gold-text">Amount payable</dt>
          <dd className="stat-number mt-1 text-3xl text-ink">{formatCurrency(amount)}</dd>
        </div>
      </dl>

      <div className="mb-6 rounded-control border border-[#cfe0c7] bg-green-wash p-4 sm:p-5">
        <h3 className="heading-card text-brand-deep">Pay by UPI</h3>
        {upiPayment?.configured ? (
          <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Image src={upiPayment.qrDataUrl} alt={`UPI payment QR for ${upiPayment.payeeName}, amount ${formatCurrency(upiPayment.amount)}`} width={200} height={200} unoptimized className="rounded-control border border-line bg-white p-2" />
            <div className="text-sm text-ink">
              <p>Scan with your UPI app and confirm the payee and amount before paying.</p>
              <p className="mt-3 font-bold">Payee: {upiPayment.payeeName}</p>
              <p className="font-bold">UPI ID: {upiPayment.upiId}</p>
              <p className="font-bold">Amount: {formatCurrency(upiPayment.amount)}</p>
              <a href={upiPayment.paymentUri} className="btn btn-primary btn-sm mt-3">Open UPI app</a>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-ink-soft">The organizer will publish the official UPI QR here. You can submit a payment made through an approved alternate method.</p>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Transaction Date */}
        <div>
          <label htmlFor="payment-transaction-date" className="mb-1.5 block text-sm font-semibold text-ink">
            Transaction Date <span className="text-red-700" aria-hidden="true">*</span>
          </label>
          <input
            id="payment-transaction-date"
            aria-invalid={Boolean(errors.transactionDate) || undefined}
            aria-describedby={errors.transactionDate ? "payment-transaction-date-error" : undefined}
            type="date"
            max={todayStr}
            value={paymentDetails?.transactionDate || ""}
            onChange={(e) => handleFieldChange("transactionDate", e.target.value)}
            className={`w-full rounded-control border bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors focus:ring-2 focus:ring-brand-primary/20 ${
              errors.transactionDate
                ? "border-red-400 bg-red-50 focus:border-red-600"
                : "border-line focus:border-brand-primary"
            }`}
          />
          {errors.transactionDate && (
            <p id="payment-transaction-date-error" className="mt-1.5 text-sm font-medium text-red-700">{errors.transactionDate}</p>
          )}
        </div>

        {/* Transaction ID */}
        <div>
          <label htmlFor="payment-transaction-id" className="mb-1.5 block text-sm font-semibold text-ink">
            Transaction ID / UTR Number <span className="text-red-700" aria-hidden="true">*</span>
          </label>
          <input
            id="payment-transaction-id"
            aria-invalid={Boolean(errors.transactionId) || undefined}
            aria-describedby={errors.transactionId ? "payment-transaction-id-error" : undefined}
            type="text"
            placeholder="e.g. 423108765432"
            value={paymentDetails?.transactionId || ""}
            onChange={(e) => handleFieldChange("transactionId", e.target.value)}
            className={`w-full rounded-control border bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors focus:ring-2 focus:ring-brand-primary/20 font-mono ${
              errors.transactionId
                ? "border-red-400 bg-red-50 focus:border-red-600"
                : "border-line focus:border-brand-primary"
            }`}
          />
          {errors.transactionId && (
            <p id="payment-transaction-id-error" className="mt-1.5 text-sm font-medium text-red-700">{errors.transactionId}</p>
          )}
        </div>

        {/* Bank Name */}
        <div>
          <label htmlFor="payment-bank-name" className="mb-1.5 block text-sm font-semibold text-ink">
            Bank Name <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="payment-bank-name"
            type="text"
            placeholder="e.g. State Bank of India"
            value={paymentDetails?.bankName || ""}
            onChange={(e) => handleFieldChange("bankName", e.target.value)}
            className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>

        {/* Payment Mode */}
        <div>
          <label htmlFor="payment-mode" className="mb-1.5 block text-sm font-semibold text-ink">
            Payment Mode <span className="text-red-700" aria-hidden="true">*</span>
          </label>
          <select
            id="payment-mode"
            aria-invalid={Boolean(errors.paymentMode) || undefined}
            aria-describedby={errors.paymentMode ? "payment-mode-error" : undefined}
            value={paymentDetails?.paymentMode || ""}
            onChange={(e) => handleFieldChange("paymentMode", e.target.value)}
            className={`w-full rounded-control border bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors focus:ring-2 focus:ring-brand-primary/20 bg-white ${
              errors.paymentMode
                ? "border-red-400 bg-red-50 focus:border-red-600"
                : "border-line focus:border-brand-primary"
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
            <p id="payment-mode-error" className="mt-1.5 text-sm font-medium text-red-700">{errors.paymentMode}</p>
          )}
        </div>

        {/* Other Payment Mode */}
        {paymentDetails?.paymentMode === "OTHER" && (
          <div className="sm:col-span-2">
            <label htmlFor="other-payment-mode" className="mb-1.5 block text-sm font-semibold text-ink">
              Other Payment Mode <span className="text-red-700" aria-hidden="true">*</span>
            </label>
            <input
              id="other-payment-mode"
            aria-invalid={Boolean(errors.otherPaymentMode) || undefined}
            aria-describedby={errors.otherPaymentMode ? "other-payment-mode-error" : undefined}
              type="text"
              placeholder="e.g. Demand Draft"
              value={paymentDetails?.otherPaymentMode || ""}
              onChange={(e) => handleFieldChange("otherPaymentMode", e.target.value)}
              className={`w-full rounded-control border bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors focus:ring-2 focus:ring-brand-primary/20 ${
                errors.otherPaymentMode
                  ? "border-red-400 bg-red-50 focus:border-red-600"
                  : "border-line focus:border-brand-primary"
              }`}
            />
            {errors.otherPaymentMode && (
              <p id="other-payment-mode-error" className="mt-1.5 text-sm font-medium text-red-700">{errors.otherPaymentMode}</p>
            )}
          </div>
        )}

        {/* Proof Upload */}
        <div className="sm:col-span-2">
          <p id="payment-proof-label" className="mb-1.5 block text-sm font-semibold text-ink">
            Transaction Proof <span className="text-red-700" aria-hidden="true">*</span>
          </p>

          {uploadStatus !== "success" && (
            <label
              htmlFor="payment-proof-file"
              onDragOver={(e) => { e.preventDefault(); if (uploadStatus !== "uploading") setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative block rounded-card border-2 border-dashed transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-primary ${
                uploadStatus === "uploading" ? "cursor-wait" : "cursor-pointer"
              } ${
                errors.proof || uploadStatus === "error"
                  ? "border-red-300 bg-red-50"
                  : uploadStatus === "uploading" || isDragging
                  ? "border-brand-primary bg-green-wash"
                  : "border-line hover:border-brand-primary bg-ivory hover:bg-green-wash"
              }`}
            >
              <input
                id="payment-proof-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="sr-only"
                onChange={handleFileSelect}
                disabled={uploadStatus === "uploading"}
                aria-labelledby="payment-proof-label"
                aria-describedby="payment-proof-help payment-proof-error"
                aria-invalid={Boolean(errors.proof || uploadStatus === "error") || undefined}
              />
              <div className="px-5 py-7 text-center">
                {uploadStatus === "uploading" ? (
                  <div className="flex flex-col items-center gap-2" role="status">
                    <svg className="w-6 h-6 text-brand-primary animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm font-bold text-brand-primary">Uploading {localFile?.name}…</p>
                    <p className="text-xs text-ink-muted">{localFile && formatFileSize(localFile.size)}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className={`w-8 h-8 ${uploadStatus === "error" ? "text-red-500" : "text-brand-primary"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-ink">Choose a file or drop it here</p>
                      <p id="payment-proof-help" className="mt-1 text-xs text-ink-muted">Accepted: PDF, JPG, JPEG, PNG — Maximum: 4 MB</p>
                    </div>
                  </div>
                )}
              </div>
            </label>
          )}

          {uploadStatus === "success" && (
            <div role="status" className="rounded-card border border-[#cfe0c7] bg-green-wash p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control bg-brand-primary text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-deep">Upload successful</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-ink-soft">{uploadedFileName}</p>
                  {localFile && (
                    <p className="mt-0.5 text-xs text-ink-muted">{localFile.type} — {formatFileSize(localFile.size)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleReplaceFile}
                  aria-label={`Replace uploaded proof ${uploadedFileName}`}
                  className="btn btn-outline btn-sm flex-shrink-0"
                >
                  Replace
                </button>
              </div>
            </div>
          )}

          {uploadStatus === "error" && uploadError && (
            <p id="payment-proof-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-700">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {uploadError}
            </p>
          )}
          {errors.proof && uploadStatus !== "success" && uploadStatus !== "error" && (
            <p id="payment-proof-error" className="mt-1.5 text-sm font-medium text-red-700">{errors.proof}</p>
          )}
        </div>
      </div>
    </div>
  );
}
