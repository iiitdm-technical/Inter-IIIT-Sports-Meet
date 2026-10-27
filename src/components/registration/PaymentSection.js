"use client";

import { useState, useRef } from "react";
import { MAX_PROOF_BYTES, MAX_PROOF_LABEL, formatRupees, getRegistrationFeeBreakdown } from "@/lib/registration/labels";
import { GLOBAL_RULES } from "@/lib/sports/config";
import { guessProofType } from "@/lib/registration/proof-file";

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Re-encodes a photo of a receipt as a smaller JPEG so phone photos over the
 * limit still upload. Returns null when the browser cannot decode the image
 * or it cannot be brought under the limit while staying readable.
 */
async function shrinkImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff"; // transparent PNG areas become white, not black
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (blob && blob.size <= MAX_PROOF_BYTES) {
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
      scale *= 0.8;
    }
    return null;
  } finally {
    bitmap.close?.();
  }
}

/**
 * PaymentSection — Embeds inside ReviewModal.
 * Manages private proof upload, transaction form fields, and communicates state upward.
 *
 * Props:
 *  uniqueStudentsCount  — number
 *  paymentDetails       — { transactionDate, transactionId, proofPathname, proofFileName }
 *  onChange             — fn(details) called on any change
 *  errors               — { transactionDate?, transactionId?, proof? }
 *  onUploadBusy         — fn(bool) so parent can gate submit button
 */
export default function PaymentSection({ uniqueStudentsCount, paymentDetails, onChange, errors = {}, onUploadBusy }) {
  const { registrationFee, gst, registrationWithGst, cautionDeposit, total } = getRegistrationFeeBreakdown(uniqueStudentsCount);
  const fileInputRef = useRef(null);

  // idle | uploading | success | error
  const [uploadStatus, setUploadStatus] = useState(
    paymentDetails?.proofPathname ? "success" : "idle"
  );
  const [uploadError, setUploadError] = useState("");
  const [localFile, setLocalFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFieldChange = (field, value) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  const rejectFile = (message) => {
    setUploadStatus("error");
    setUploadError(message);
    onChange((current) => ({ ...current, proofPathname: "", proofFileName: "" }));
  };

  const uploadFile = async (selected) => {
    if (!selected) return;
    let file = selected;

    setUploadError("");

    const type = guessProofType(file);
    if (!type) {
      rejectFile("Upload the receipt as a PDF, JPG or PNG. Screenshots and phone photos work.");
      return;
    }
    if (file.size === 0) {
      rejectFile("The chosen file is empty. Choose the receipt again.");
      return;
    }

    if (file.size > MAX_PROOF_BYTES) {
      const shrunk = type === "application/pdf" ? null : await shrinkImage(file);
      if (!shrunk) {
        rejectFile(type === "application/pdf"
          ? `The PDF is ${formatFileSize(file.size)}, over the ${MAX_PROOF_LABEL} limit. Save or print it again as a smaller PDF, or upload a screenshot of the receipt.`
          : `File is ${formatFileSize(file.size)}, exceeding the ${MAX_PROOF_LABEL} maximum. Upload a screenshot of the receipt instead.`);
        return;
      }
      file = shrunk;
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
        <p className="meta mt-1">Complete payment on the portal, then record the transfer and upload its receipt here.</p>
      </div>

      {/* Payment summary */}
      <dl className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card-tint rounded-control p-3 sm:p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Students</dt>
          <dd className="stat-number mt-1 text-3xl text-ink">{uniqueStudentsCount}</dd>
        </div>
        <div className="card-tint rounded-control p-3 sm:p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Per student</dt>
          <dd className="stat-number mt-1 whitespace-nowrap text-base leading-tight text-ink sm:text-3xl">{formatRupees(GLOBAL_RULES.REGISTRATION_FEE_PER_STUDENT)}</dd>
        </div>
        <div className="rounded-control border border-[#ecd27a] bg-gold-wash p-3 sm:p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-gold-text">Amount payable</dt>
          <dd className="stat-number mt-1 whitespace-nowrap text-base leading-tight text-ink sm:text-3xl">{formatRupees(total)}</dd>
        </div>
      </dl>

      <div className="mb-6 rounded-control border border-line bg-ivory p-4 sm:p-5">
        <h3 className="text-sm font-bold text-brand-deep">Payment breakdown</h3>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
            <dt className="text-ink-soft">Registration fee ({formatRupees(GLOBAL_RULES.REGISTRATION_FEE_PER_STUDENT)} × {uniqueStudentsCount} {uniqueStudentsCount === 1 ? "student" : "students"})</dt>
            <dd className="shrink-0 font-semibold text-ink">{formatRupees(registrationFee)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
            <dt className="text-ink-soft">GST ({GLOBAL_RULES.REGISTRATION_GST_PERCENT}%)</dt>
            <dd className="shrink-0 font-semibold text-ink">{formatRupees(gst)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
            <dt className="text-ink-soft">Registration fee + GST</dt>
            <dd className="shrink-0 font-semibold text-ink">{formatRupees(registrationWithGst)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
            <dt className="text-ink-soft">Refundable caution deposit (one per IIIT)</dt>
            <dd className="shrink-0 font-semibold text-ink">{formatRupees(cautionDeposit)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-control border border-[#ecd27a] bg-gold-wash px-3 py-2.5 sm:col-span-2">
            <dt className="font-bold text-gold-text">Total payable</dt>
            <dd className="stat-number whitespace-nowrap text-lg text-ink sm:text-xl">{formatRupees(total)}</dd>
          </div>
        </dl>
      </div>

      <div className="mb-6 rounded-control border border-[#cfe0c7] bg-green-wash p-4 sm:p-5">
        <h3 className="heading-card text-brand-deep">How to pay</h3>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-ink-soft marker:font-bold marker:text-brand-primary">
          <li>
            Access the payment portal:
            <a
              href="https://formbuilder.ccavenue.com/live/indian-bank/iiitdm-kancheepuram/9th-all-india-inter-iiit-students-sports-meet"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the CCAvenue payment portal (opens in a new tab)"
              className="btn btn-primary mt-2 inline-flex items-center gap-2"
            >
              Open payment portal
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5h5v5m-1-4-9 9" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
              </svg>
            </a>
          </li>
          <li>Fill in all required form details, including your contact information.</li>
          <li>Verify the details and total payable on the portal, then accept the Terms and Conditions.</li>
          <li>Click Pay Now and choose the applicable payment option on the portal.</li>
          <li>For NEFT/RTGS, download the portal-generated challan to complete payment.</li>
        </ol>
        <p role="note" className="mt-5 rounded-control border border-[#ecd27a] bg-gold-wash p-3.5 text-sm leading-6 text-ink">
          <strong>After payment, download your receipt from PAYMENT HISTORY. Then return here and submit the transaction date, reference number, and receipt below.</strong>
        </p>
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
            min="2026-01-01"
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
            Transaction ID / UTR / Reference No. <span className="text-red-700" aria-hidden="true">*</span>
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

        {/* Proof Upload */}
        <div className="sm:col-span-2">
          <p id="payment-proof-label" className="mb-1.5 block text-sm font-semibold text-ink">
            Payment Receipt <span className="text-red-700" aria-hidden="true">*</span>
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
                      <p id="payment-proof-help" className="mt-1 text-xs text-ink-muted">PDF, JPG or PNG up to {MAX_PROOF_LABEL}. Larger photos are reduced automatically.</p>
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
