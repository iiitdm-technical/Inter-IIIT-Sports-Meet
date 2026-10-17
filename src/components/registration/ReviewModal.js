"use client";

import { useState } from "react";
import { getSportConfig } from "@/lib/sports/config";
import useModalFocus from "@/components/useModalFocus";

/**
 * Cleans up Zod validation error strings into readable labels.
 */
function formatError(raw) {
  const schemaMap = {
    "contactDetails.contactName:": "Contact Form — Name:",
    "contactDetails.contactEmail:": "Contact Form — Email:",
    "contactDetails.contactPhone:": "Contact Form — Phone:",
    "students.": "Student roster —",
    "entries.": "Event entry —",
  };
  for (const [prefix, label] of Object.entries(schemaMap)) {
    if (raw.startsWith(prefix)) {
      return label + " " + raw.slice(prefix.length).trim();
    }
  }
  return raw;
}

/**
 * Rendered only while open, so the confirmation resets each time it opens.
 */
export default function ReviewModal({
  onClose, onSubmit,
  isSubmitting, payload, issues,
  submitError, uniqueStudentsCount,
  onGoToIssue,
}) {
  const [confirmed, setConfirmed] = useState(false);
  const panelRef = useModalFocus(true, isSubmitting ? undefined : onClose);

  const hasRegistrationErrors = issues && issues.length > 0;
  const canProceed = !hasRegistrationErrors && !isSubmitting;
  const studentsByRoll = new Map((payload?.students || []).map((student) => [student.rollNumber, student]));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 sm:items-center">
        <div className="fixed inset-0 bg-gray-900/75 transition-opacity" aria-hidden="true" onClick={isSubmitting ? undefined : onClose} />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabIndex={-1}
          className="relative w-full overflow-hidden rounded-2xl bg-white text-left shadow-xl outline-none sm:my-8 sm:max-w-2xl"
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-xl leading-6 font-black text-gray-900" id="modal-title">
              Review Registration
            </h3>
            <div className="mt-4">
              {submitError && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="text-red-800 font-bold text-sm">Submission Failed</h4>
                    <p className="text-sm text-red-700 mt-0.5">{submitError}</p>
                  </div>
                </div>
              )}

              {hasRegistrationErrors ? (
                <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden mb-2">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-red-200 bg-red-100">
                    <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-800 font-bold text-sm">
                      {issues.length} issue{issues.length !== 1 ? "s" : ""} must be fixed before submitting
                    </span>
                  </div>
                  <ul className="divide-y divide-red-100 max-h-64 overflow-y-auto">
                    {issues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-3 px-4 py-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-200 text-red-700 text-[10px] font-black flex items-center justify-center mt-0.5" aria-hidden="true">
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-sm text-red-800 leading-snug">{formatError(issue.message)}</span>
                        {(issue.slotKeys.length > 0 || issue.fieldId) && (
                          <button
                            type="button"
                            onClick={() => onGoToIssue(issue)}
                            className="flex-shrink-0 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-bold text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                          >
                            Show<span className="sr-only"> issue {idx + 1} in the form</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-bold text-blue-800">Proceed to Payment</h4>
                    <p className="mt-2 text-sm text-blue-700">Submitting will lock the student and event registration data. You will then be redirected to complete your payment.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Unique Students</p>
                      <p className="text-2xl font-black text-gray-900">{uniqueStudentsCount || 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Event Entries</p>
                      <p className="text-2xl font-black text-gray-900">{payload?.entries?.length || 0}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">Contact Details</h4>
                    <p className="text-sm text-gray-700"><strong>Name:</strong> {payload?.contactDetails?.contactName || "N/A"}</p>
                    <p className="text-sm text-gray-700"><strong>Email:</strong> {payload?.contactDetails?.contactEmail || "N/A"}</p>
                    <p className="text-sm text-gray-700"><strong>Phone:</strong> {payload?.contactDetails?.contactPhone || "N/A"}</p>
                  </div>
                  <div className="mt-4 rounded-lg border border-gray-200 overflow-hidden">
                    <h4 className="px-4 py-3 text-sm font-bold text-gray-900 bg-gray-50 border-b border-gray-200">Student roster and event entries</h4>
                    <div className="max-h-64 overflow-auto divide-y divide-gray-100" tabIndex={0} aria-label="Student roster and event entries">
                      {payload?.entries?.map((entry, index) => {
                        const student = studentsByRoll.get(entry.rollNumber);
                        const sport = getSportConfig(entry.sportId);
                        const event = sport?.events?.[entry.gender]?.find((item) => item.id === entry.eventId);
                        return (
                          <div key={`${entry.rollNumber}-${entry.sportId}-${entry.eventId}-${index}`} className="px-4 py-3 text-xs sm:flex sm:justify-between gap-4">
                            <div className="font-semibold text-gray-900">{student?.name || entry.rollNumber} <span className="font-mono font-normal text-gray-500">({entry.rollNumber})</span></div>
                            <div className="text-gray-600">{sport?.name || entry.sportId} · {event?.name || entry.eventId} · {entry.gender === "mixed" ? "Mixed" : entry.gender === "M" ? "Men" : "Women"}{entry.isReserve ? " · Reserve" : ""}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <label className="mt-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      disabled={isSubmitting}
                      className="mt-0.5 size-4 shrink-0 accent-[#1b5e20]"
                    />
                    I have checked every student, event and contact detail. I understand the roster cannot be changed after it is locked.
                  </label>
                </>
              )}
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200">
            {!hasRegistrationErrors && (
              <button
                type="button"
                disabled={!canProceed || !confirmed}
                className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-[#f5c518] text-[#0a2112] text-base font-black hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a2112] disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                onClick={onSubmit}
              >
                {isSubmitting ? "Locking roster…" : "Lock Roster & Continue →"}
              </button>
            )}
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b5e20] sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {hasRegistrationErrors ? "Close & Fix Issues" : "Cancel & Continue Editing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
