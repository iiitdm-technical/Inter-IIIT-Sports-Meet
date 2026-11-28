"use client";

import { useState, useEffect, useCallback } from "react";
import { getCategoryLabel, getEventName, getSportName } from "@/lib/registration/labels";

function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function CheckInPanel({ registrationsOverview, onCheckInSuccess }) {
  const [selectedIiit, setSelectedIiit] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'false' | 'true'
  const [results, setResults] = useState({ rows: [], total: 0, page: 1, totalPages: 1 });
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const searchStudents = useCallback(async (page = 1, { iiit = selectedIiit, q = query, status = statusFilter } = {}) => {
    setSearching(true);
    setSearchError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (iiit) params.set("iiit", iiit);
      if (q.trim()) params.set("q", q.trim());
      if (status === "true" || status === "false") params.set("checkedIn", status);

      const res = await fetch(`/api/admin/students?${params.toString()}`);
      if (!res.ok) throw new Error("Could not load students");
      const data = await res.json();
      setResults(data.data || { rows: [], total: 0, page: 1, totalPages: 1 });
    } catch (err) {
      console.error("Check-in search error:", err);
      setSearchError("Could not load students. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }, [selectedIiit, query, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchStudents(1, { iiit: selectedIiit, q: query, status: statusFilter });
    }, 220);
    return () => clearTimeout(timer);
  }, [selectedIiit, query, statusFilter, searchStudents]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setOverrideDuplicate(false);
    setActionError("");
    setActionSuccess("");
  };

  const handleCheckIn = async () => {
    if (!selectedStudent || actionBusy) return;
    const isOverride = Boolean(selectedStudent.checkedIn && overrideDuplicate);
    setActionBusy(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/admin/students/${selectedStudent.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: isOverride }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Could not check in student");
      }

      const updated = payload.data;
      const mergedStudent = {
        ...selectedStudent,
        checkedIn: true,
        checkedInAt: updated.checkedInAt,
        checkedInBy: updated.checkedInBy,
      };
      setSelectedStudent(mergedStudent);
      setOverrideDuplicate(false);
      setResults((prev) => ({
        ...prev,
        rows: prev.rows.map((row) => (row.id === mergedStudent.id ? mergedStudent : row)),
      }));
      if (onCheckInSuccess) onCheckInSuccess();

      const msg = updated.wasAlreadyCheckedIn
        ? `Check-in overridden for ${mergedStudent.studentName} at ${formatTimestamp(updated.checkedInAt)}.`
        : `${mergedStudent.studentName} checked in at ${formatTimestamp(updated.checkedInAt)}.`;
      setActionSuccess(msg);
    } catch (err) {
      setActionError(err.message || "Could not check in student");
    } finally {
      setActionBusy(false);
    }
  };

  const activeInstitutes = (registrationsOverview || []).filter((r) => r.isSubmitted);
  const controlClass =
    "w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

  return (
    <section aria-labelledby="checkin-heading">
      <div className="mb-5">
        <p className="eyebrow">On-site arrival</p>
        <h2 id="checkin-heading" className="heading-section mt-1 text-[2rem]">
          Student Check-in
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Pick an institute, search by student name or roll number, and mark them checked in. Checked-in students appear automatically in the Print IDs tab.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Institute + Search & Student List */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="card p-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="checkin-institute" className="mb-1.5 block text-sm font-semibold text-ink">
                  Institute
                </label>
                <select
                  id="checkin-institute"
                  value={selectedIiit}
                  onChange={(e) => setSelectedIiit(e.target.value)}
                  className={controlClass}
                >
                  <option value="">All Registered Institutes ({activeInstitutes.length})</option>
                  {activeInstitutes.map((row) => (
                    <option key={row.iiitCode} value={row.iiitCode}>
                      {row.iiitName} ({row.totalStudentsCount} students)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="checkin-search" className="mb-1.5 block text-sm font-semibold text-ink">
                  Search Student (Name or Roll Number)
                </label>
                <div className="relative">
                  <input
                    id="checkin-search"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type student name or roll number…"
                    className={`${controlClass} pr-16`}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs font-semibold text-ink-muted hover:bg-ivory hover:text-ink"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Filter by check-in status">
                {[
                  ["all", "All"],
                  ["false", "Not Checked In"],
                  ["true", "Checked In"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStatusFilter(val)}
                    className={`rounded-control border px-3 py-1 text-xs font-semibold transition-colors ${
                      statusFilter === val
                        ? "border-brand-primary bg-brand-primary text-white"
                        : "border-line bg-ivory text-ink-soft hover:border-brand-primary/50 hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-ivory px-4 py-2.5 text-xs font-semibold text-ink-soft">
              <span>{searching ? "Searching…" : `${results.total} matching student${results.total === 1 ? "" : "s"}`}</span>
              {results.totalPages > 1 && (
                <span>Page {results.page} / {results.totalPages}</span>
              )}
            </div>

            {searchError && (
              <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800">
                {searchError}
              </div>
            )}

            <div className="max-h-[540px] divide-y divide-line overflow-y-auto bg-paper">
              {results.rows.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-ink-muted">
                  {searching ? "Loading students…" : "No students match your search."}
                </div>
              ) : (
                results.rows.map((student) => {
                  const isSelected = selectedStudent?.id === student.id;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleSelectStudent(student)}
                      className={`w-full px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary ${
                        isSelected
                          ? "bg-green-wash/60 ring-1 ring-inset ring-brand-primary/40"
                          : "hover:bg-ivory/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink">{student.studentName}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-soft">
                            <span className="font-mono font-medium">{student.rollNumber}</span>
                            {" · "}
                            <span>{student.iiitName}</span>
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                            student.checkedIn
                              ? "bg-green-100 text-brand-primary"
                              : "bg-ivory-dark text-ink-muted"
                          }`}
                        >
                          {student.checkedIn ? "Checked In" : "Pending"}
                        </span>
                      </div>
                      {student.checkedIn && student.checkedInAt && (
                        <p className="mt-1 text-[11px] text-ink-muted">
                          Checked in: {formatTimestamp(student.checkedInAt)}
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {results.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line bg-ivory px-3 py-2 text-xs">
                <button
                  type="button"
                  disabled={results.page <= 1 || searching}
                  onClick={() => searchStudents(results.page - 1)}
                  className="btn btn-outline btn-sm"
                >
                  &larr; Prev
                </button>
                <span className="font-medium text-ink-soft">
                  {results.page} / {results.totalPages}
                </span>
                <button
                  type="button"
                  disabled={results.page >= results.totalPages || searching}
                  onClick={() => searchStudents(results.page + 1)}
                  className="btn btn-outline btn-sm"
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Student Check-in Card */}
        <div className="lg:col-span-7">
          {!selectedStudent ? (
            <div className="card flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ivory-dark text-brand-primary">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="heading-card text-lg">No Student Selected</h3>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">
                Select a student from the list to view their check-in status and record arrival.
              </p>
            </div>
          ) : (
            <div className="card card-accent p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{selectedStudent.iiitName}</p>
                  <h3 className="mt-1 font-display text-2xl font-bold tracking-wide text-ink">
                    {selectedStudent.studentName}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    <span className="font-mono font-semibold text-ink">{selectedStudent.rollNumber}</span>
                    <span>·</span>
                    <span className={`chip ${selectedStudent.studentGender === "F" ? "chip-gold" : ""}`}>
                      {selectedStudent.studentGender === "F" ? "Female (F)" : "Male (M)"}
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    selectedStudent.checkedIn
                      ? "border border-green-300 bg-green-100 text-brand-primary"
                      : "border border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {selectedStudent.checkedIn ? "Checked In" : "Not Checked In"}
                </span>
              </div>

              {selectedStudent.events?.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                    Registered Events ({selectedStudent.events.length})
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {selectedStudent.events.map((ev) => (
                      <li key={`${ev.sportId}:${ev.eventId}`} className={`chip ${ev.isReserve ? "chip-gold" : ""}`}>
                        {getSportName(ev.sportId)}
                        {ev.eventId !== "team" && ` · ${getEventName(ev.sportId, ev.eventId, ev.eventGender)}`}
                        {` (${getCategoryLabel(ev.eventGender)}${ev.isReserve ? ", Reserve" : ""})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 border-t border-line pt-4">
                {selectedStudent.checkedIn ? (
                  <div className="rounded-control border border-amber-300 bg-amber-50/80 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-amber-900">Already Checked In</p>
                      <p className="text-xs font-semibold text-amber-800">
                        {formatTimestamp(selectedStudent.checkedInAt)}
                        {selectedStudent.checkedInBy ? ` · by ${selectedStudent.checkedInBy}` : ""}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-amber-800">
                      Duplicate check-in is prevented by default. Enable override below if you need to re-check in and update the timestamp.
                    </p>
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-950">
                      <input
                        type="checkbox"
                        checked={overrideDuplicate}
                        onChange={(e) => setOverrideDuplicate(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-400 text-brand-primary focus:ring-brand-primary"
                      />
                      Override duplicate check-in
                    </label>
                  </div>
                ) : (
                  <div className="rounded-control border border-line bg-ivory p-3.5 text-sm text-ink-soft">
                    This student has not checked in yet.
                  </div>
                )}

                {actionError && (
                  <div role="alert" className="mt-3 rounded-control border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-800">
                    {actionError}
                  </div>
                )}
                {actionSuccess && (
                  <div role="status" className="mt-3 rounded-control border border-green-200 bg-green-wash px-3.5 py-2.5 text-sm font-semibold text-brand-primary">
                    {actionSuccess}
                  </div>
                )}

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={actionBusy || (selectedStudent.checkedIn && !overrideDuplicate)}
                    onClick={handleCheckIn}
                    className={`btn btn-sm px-5 ${
                      !selectedStudent.checkedIn
                        ? "btn-primary"
                        : overrideDuplicate
                          ? "btn-accent"
                          : "btn-outline opacity-60 cursor-not-allowed"
                    }`}
                  >
                    {actionBusy
                      ? "Saving…"
                      : !selectedStudent.checkedIn
                        ? "Check In"
                        : overrideDuplicate
                          ? "Override Check-in"
                          : "Already Checked In"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
