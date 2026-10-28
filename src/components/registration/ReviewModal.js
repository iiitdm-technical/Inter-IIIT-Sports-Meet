"use client";

import { useState } from "react";
import useModalFocus from "@/components/useModalFocus";
import { formatArrival, formatTravelDate } from "@/lib/registration/arrival";
import { countByGender, describeContingent, totalTravelling } from "@/lib/registration/contingent";
import { formatRupees, getCategoryLabel, getEventName, getRegistrationFee, getSportName } from "@/lib/registration/labels";

/**
 * Cleans up Zod validation error strings into readable labels.
 */
function formatError(raw) {
  const schemaMap = {
    "contactDetails.contactName:": "Contact Form — Name:",
    "contactDetails.contactEmail:": "Contact Form — Email:",
    "contactDetails.contactPhone:": "Contact Form — Phone:",
    "contactDetails.arrivalDate:": "Travel — Arrival date:",
    "contactDetails.arrivalTime:": "Travel — Arrival time:",
    "contactDetails.travelMode:": "Travel — Mode:",
    "contactDetails.departureDate:": "Travel — Exit date:",
    "contactDetails.boysSecretary": "Boys' sports secretary —",
    "contactDetails.girlsSecretary": "Girls' sports secretary —",
    "contactDetails.boysTravelling:": "Contingent — Boys travelling:",
    "contactDetails.girlsTravelling:": "Contingent — Girls travelling:",
    "contactDetails.staffCount:": "Contingent — Accompanying staff:",
    "contactDetails.notes:": "Travel — Other notes:",
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
 * The roster two ways for checking: each student (by name) with their events,
 * and each team or event (in catalogue order) with its player count.
 */
function summarizeRoster(payload) {
  const students = new Map((payload?.students || []).map((student) => [student.rollNumber, { ...student, events: [] }]));
  const teams = new Map();
  for (const entry of payload?.entries || []) {
    const sport = getSportName(entry.sportId);
    const event = getEventName(entry.sportId, entry.eventId, entry.gender);
    const category = getCategoryLabel(entry.gender);
    students.get(entry.rollNumber)?.events.push(`${sport} ${category} ${event}${entry.isReserve ? " (reserve)" : ""}`);
    const key = `${entry.sportId}|${entry.gender}|${entry.eventId}`;
    if (!teams.has(key)) teams.set(key, { key, sport, category, event, mains: 0, reserves: 0 });
    teams.get(key)[entry.isReserve ? "reserves" : "mains"]++;
  }
  return {
    roster: [...students.values()].sort((a, b) => a.name.localeCompare(b.name) || a.rollNumber.localeCompare(b.rollNumber)),
    teams: [...teams.values()],
  };
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
  const { boys, girls } = countByGender(payload?.students);
  const staff = Number(payload?.contactDetails?.staffCount) || 0;
  const { roster, teams } = summarizeRoster(payload);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6">
        <div className="fixed inset-0 bg-brand-dark/75 backdrop-blur-[2px] transition-opacity" aria-hidden="true" onClick={isSubmitting ? undefined : onClose} />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabIndex={-1}
          className="relative w-full overflow-hidden rounded-card border border-line bg-paper text-left shadow-lift outline-none sm:max-w-3xl"
        >
          <div className="border-b border-line px-5 pt-5 pb-4 sm:px-6">
            <p className="eyebrow">Step 1 of 3 · Review</p>
            <h3 className="heading-section mt-1 text-[2rem]" id="modal-title">
              Review Registration
            </h3>
          </div>

          <div className="px-5 py-5 sm:px-6">
            {submitError && (
              <div role="alert" className="mb-4 flex items-start gap-3 rounded-control border border-red-200 bg-red-50 p-4">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-bold text-red-800">Submission failed</h4>
                  <p className="mt-0.5 text-sm text-red-700">{submitError}</p>
                </div>
              </div>
            )}

            {hasRegistrationErrors ? (
              <div className="overflow-hidden rounded-control border border-red-200 bg-red-50">
                <div className="flex items-center gap-2 border-b border-red-200 bg-red-100 px-4 py-3">
                  <svg className="h-4 w-4 flex-shrink-0 text-red-700" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-red-800">
                    {issues.length} issue{issues.length !== 1 ? "s" : ""} must be fixed before submitting
                  </span>
                </div>
                <ul className="max-h-72 divide-y divide-red-100 overflow-y-auto">
                  {issues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-200 font-display text-xs font-bold text-red-800" aria-hidden="true">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm leading-snug text-red-800">{formatError(issue.message)}</span>
                      {(issue.slotKeys.length > 0 || issue.fieldId) && (
                        <button
                          type="button"
                          onClick={() => onGoToIssue(issue)}
                          className="flex-shrink-0 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-bold text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
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
                <p className="text-sm text-ink-soft">
                  Save your roster and continue to payment. You can still edit students and teams until you submit your payment details and receipt.
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Unique students", uniqueStudentsCount || 0, `${boys} boys · ${girls} girls`],
                    ["Event entries", payload?.entries?.length || 0, `${teams.length} teams / events`],
                    ["People travelling", totalTravelling(boys, girls, staff), `incl. ${staff || 0} staff`],
                    ["Amount to pay", formatRupees(getRegistrationFee(uniqueStudentsCount || 0)), "incl. GST and deposit"],
                  ].map(([label, value, note]) => (
                    <div key={label} className="card-tint rounded-control p-4">
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
                      <dd className="stat-number mt-1.5 text-2xl text-ink sm:text-3xl">{value}</dd>
                      <dd className="meta mt-1">{note}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 rounded-control border border-line p-4">
                  <h4 className="heading-card text-sm">Contact details</h4>
                  <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-ink-muted">Name</dt><dd className="font-medium text-ink">{payload?.contactDetails?.contactName || "N/A"}</dd>
                    <dt className="text-ink-muted">Email</dt><dd className="break-all font-medium text-ink">{payload?.contactDetails?.contactEmail || "N/A"}</dd>
                    <dt className="text-ink-muted">Phone</dt><dd className="font-medium text-ink">{payload?.contactDetails?.contactPhone || "N/A"}</dd>
                    <dt className="text-ink-muted">Arrival</dt><dd className="font-medium text-ink">{formatArrival(payload?.contactDetails) || "N/A"}</dd>
                    <dt className="text-ink-muted">Exit</dt><dd className="font-medium text-ink">{formatTravelDate(payload?.contactDetails?.departureDate) || "N/A"}</dd>
                    <dt className="text-ink-muted">Boys&apos; sec.</dt><dd className="font-medium text-ink">{[payload?.contactDetails?.boysSecretaryName, payload?.contactDetails?.boysSecretaryPhone, payload?.contactDetails?.boysSecretaryEmail].filter(Boolean).join(" · ") || "N/A"}</dd>
                    <dt className="text-ink-muted">Girls&apos; sec.</dt><dd className="font-medium text-ink">{[payload?.contactDetails?.girlsSecretaryName, payload?.contactDetails?.girlsSecretaryPhone, payload?.contactDetails?.girlsSecretaryEmail].filter(Boolean).join(" · ") || "N/A"}</dd>
                    <dt className="text-ink-muted">Contingent</dt><dd className="font-medium text-ink">{describeContingent(boys, girls, staff)}</dd>
                  </dl>
                </div>

                <div className="mt-4 overflow-hidden rounded-control border border-line">
                  <h4 className="border-b border-line bg-ivory px-4 py-3 text-sm font-bold text-ink">Teams and events ({teams.length})</h4>
                  <div className="max-h-64 overflow-auto bg-white" tabIndex={0} aria-label="Teams and events">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-[0.06em] text-ink-muted">
                        <tr><th className="px-4 py-2 font-semibold">Sport</th><th className="px-4 py-2 font-semibold">Event</th><th className="px-4 py-2 text-right font-semibold">Players</th></tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {teams.map((team) => (
                          <tr key={team.key}>
                            <td className="px-4 py-2 font-semibold text-ink">{team.sport} <span className="font-normal text-ink-muted">· {team.category}</span></td>
                            <td className="px-4 py-2 text-ink-soft">{team.event}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-right text-ink">{team.mains}{team.reserves > 0 && <span className="text-ink-muted"> + {team.reserves} reserve{team.reserves !== 1 ? "s" : ""}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-control border border-line">
                  <h4 className="border-b border-line bg-ivory px-4 py-3 text-sm font-bold text-ink">Students ({roster.length}) — check every name and roll number</h4>
                  <div className="max-h-80 overflow-auto bg-white" tabIndex={0} aria-label="Students and their events">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-[0.06em] text-ink-muted">
                        <tr><th className="px-4 py-2 font-semibold">#</th><th className="px-4 py-2 font-semibold">Student</th><th className="px-4 py-2 font-semibold">Events</th></tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {roster.map((student, index) => (
                          <tr key={student.rollNumber} className="align-top">
                            <td className="px-4 py-2 text-ink-muted">{index + 1}</td>
                            <td className="px-4 py-2">
                              <div className="font-semibold text-ink">{student.name}</div>
                              <div className="font-mono text-xs text-ink-muted">{student.rollNumber} · {student.gender === "F" ? "Girl" : "Boy"}</div>
                            </td>
                            <td className="px-4 py-2 text-ink-soft">{student.events.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <label className="mt-5 flex items-start gap-3 rounded-control border border-amber-300 bg-gold-wash p-4 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={isSubmitting}
                    className="mt-0.5 size-4 shrink-0 accent-brand-primary"
                  />
                  I have checked every student, event and contact detail. I understand the roster locks only when I submit my payment details and receipt.
                </label>
              </>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line bg-ivory px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {hasRegistrationErrors ? "Close & Fix Issues" : "Cancel & Continue Editing"}
            </button>
            {!hasRegistrationErrors && (
              <button
                type="button"
                disabled={!canProceed || !confirmed}
                className="btn btn-accent"
                onClick={onSubmit}
              >
                {isSubmitting ? "Saving roster…" : "Save Roster & Continue →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
