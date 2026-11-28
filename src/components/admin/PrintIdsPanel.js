"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const MAX_QUEUE = 3;

function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function PrintIdsPanel({ registrationsOverview }) {
  const [selectedIiit, setSelectedIiit] = useState("");
  const [query, setQuery] = useState("");
  const [checkedInOnly, setCheckedInOnly] = useState(true);
  const [results, setResults] = useState({ rows: [], total: 0, page: 1, totalPages: 1 });
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Print queue: up to 3 students per vertical A4 sheet
  const [queue, setQueue] = useState([]);

  // Generated sheet metadata (PDF stays in 5-min server cache until Print/Download is clicked)
  const [generatedSheet, setGeneratedSheet] = useState(null); // { key, filename, count, expiresAt, studentIds }
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [sheetError, setSheetError] = useState("");

  // Browser memory cache for already-fetched sheet blobs (key -> { url, expiresAt })
  const blobCacheRef = useRef(new Map());
  const printIframeRef = useRef(null);

  useEffect(() => {
    const cache = blobCacheRef.current;
    return () => {
      for (const entry of cache.values()) {
        URL.revokeObjectURL(entry.url);
      }
      cache.clear();
    };
  }, []);

  const searchStudents = useCallback(async (page = 1, { iiit = selectedIiit, q = query, onlyCheckedIn = checkedInOnly } = {}) => {
    setSearching(true);
    setSearchError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (iiit) params.set("iiit", iiit);
      if (q.trim()) params.set("q", q.trim());
      if (onlyCheckedIn) {
        params.set("checkedIn", "true");
        params.set("sort", "checked_in_desc");
      }

      const res = await fetch(`/api/admin/students?${params.toString()}`);
      if (!res.ok) throw new Error("Could not load students");
      const data = await res.json();
      setResults(data.data || { rows: [], total: 0, page: 1, totalPages: 1 });
    } catch (err) {
      console.error("Print IDs search error:", err);
      setSearchError("Could not load students. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }, [selectedIiit, query, checkedInOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchStudents(1, { iiit: selectedIiit, q: query, onlyCheckedIn: checkedInOnly });
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedIiit, query, checkedInOnly, searchStudents]);

  const toggleStudentInQueue = (student) => {
    setSheetError("");
    setQueue((prev) => {
      const exists = prev.some((s) => s.id === student.id);
      if (exists) {
        setGeneratedSheet(null);
        return prev.filter((s) => s.id !== student.id);
      }
      if (prev.length >= MAX_QUEUE) {
        setSheetError(`Print queue is full (${MAX_QUEUE} IDs per A4 sheet). Remove one or print the current sheet first.`);
        return prev;
      }
      setGeneratedSheet(null);
      return [...prev, student];
    });
  };

  const removeFromQueue = (studentId) => {
    setSheetError("");
    setGeneratedSheet(null);
    setQueue((prev) => prev.filter((s) => s.id !== studentId));
  };

  const clearQueue = () => {
    setSheetError("");
    setGeneratedSheet(null);
    setQueue([]);
  };

  // Step 1: Generate PDF on server & cache in server memory for 5 mins (tiny JSON response, no download)
  const handleGenerateSheet = async () => {
    if (queue.length === 0 || generating) return;
    setGenerating(true);
    setSheetError("");
    setGeneratedSheet(null);

    try {
      const studentIds = queue.map((s) => s.id);
      const res = await fetch("/api/admin/id-cards/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to generate ID card sheet");
      }
      setGeneratedSheet({
        ...payload.data,
        studentIds,
      });
    } catch (err) {
      setSheetError(err.message || "Failed to generate ID card sheet");
    } finally {
      setGenerating(false);
    }
  };

  // Helper: fetch PDF blob only when Print or Download is clicked (cached in browser memory for 5 mins)
  const getOrFetchSheetBlobUrl = async (sheet) => {
    const cache = blobCacheRef.current;
    const cached = cache.get(sheet.key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
    if (cached) {
      URL.revokeObjectURL(cached.url);
      cache.delete(sheet.key);
    }

    const res = await fetch(`/api/admin/id-cards/sheet?key=${encodeURIComponent(sheet.key)}`);
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error || "Could not fetch generated ID sheet");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cache.set(sheet.key, { url, expiresAt: sheet.expiresAt });
    return url;
  };

  // Step 2: Fetch PDF from 5-min cache and immediately trigger browser print dialog
  const handlePrintSheet = async () => {
    if (!generatedSheet || printing) return;
    setPrinting(true);
    setSheetError("");

    try {
      const blobUrl = await getOrFetchSheetBlobUrl(generatedSheet);
      const iframe = printIframeRef.current;
      if (iframe) {
        await new Promise((resolve, reject) => {
          const onLoad = () => {
            iframe.removeEventListener("load", onLoad);
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          iframe.addEventListener("load", onLoad);
          iframe.src = blobUrl;
        });
      } else {
        window.open(blobUrl, "_blank", "noopener");
      }
    } catch (err) {
      setSheetError(err.message || "Could not open print dialog. Try Download PDF instead.");
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadSheet = async () => {
    if (!generatedSheet || printing) return;
    setPrinting(true);
    setSheetError("");
    try {
      const blobUrl = await getOrFetchSheetBlobUrl(generatedSheet);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = generatedSheet.filename || "ID_Sheet.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setSheetError(err.message || "Could not download ID sheet");
    } finally {
      setPrinting(false);
    }
  };

  const activeInstitutes = (registrationsOverview || []).filter((r) => r.isSubmitted);
  const queuedIds = new Set(queue.map((s) => s.id));
  const controlClass =
    "w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

  return (
    <section aria-labelledby="print-ids-heading">
      {/* Hidden iframe used exclusively to trigger native print dialog without rendering a heavy preview */}
      <iframe
        ref={printIframeRef}
        title="ID Card Print Frame"
        className="pointer-events-none fixed left-0 top-0 h-0 w-0 border-0 opacity-0"
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">3-up Portrait A4 · Foldable with 12 mm top pad &amp; crop marks</p>
          <h2 id="print-ids-heading" className="heading-section mt-1 text-[2rem]">
            Print ID Cards
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Recently checked-in students appear first. Click up to 3 students to queue them side by side on one A4 sheet, generate the PDF, and print.
          </p>
        </div>
        <button
          type="button"
          onClick={() => searchStudents(1)}
          disabled={searching}
          className="btn btn-outline btn-sm"
        >
          {searching ? "Refreshing…" : "Refresh List"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Recently Checked-in / Searchable Student List */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="print-institute" className="mb-1.5 block text-sm font-semibold text-ink">
                  Institute
                </label>
                <select
                  id="print-institute"
                  value={selectedIiit}
                  onChange={(e) => setSelectedIiit(e.target.value)}
                  className={controlClass}
                >
                  <option value="">All Institutes ({activeInstitutes.length})</option>
                  {activeInstitutes.map((row) => (
                    <option key={row.iiitCode} value={row.iiitCode}>
                      {row.iiitName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="print-search" className="mb-1.5 block text-sm font-semibold text-ink">
                  Search (Name or Roll No.)
                </label>
                <div className="relative">
                  <input
                    id="print-search"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or roll number…"
                    className={`${controlClass} pr-14`}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-semibold text-ink-muted hover:bg-ivory hover:text-ink"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              <div className="flex gap-1.5" role="group" aria-label="Student list scope">
                <button
                  type="button"
                  onClick={() => setCheckedInOnly(true)}
                  className={`rounded-control border px-3 py-1 text-xs font-semibold transition-colors ${
                    checkedInOnly
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-line bg-ivory text-ink-soft hover:border-brand-primary/50 hover:text-ink"
                  }`}
                >
                  Recently Checked In
                </button>
                <button
                  type="button"
                  onClick={() => setCheckedInOnly(false)}
                  className={`rounded-control border px-3 py-1 text-xs font-semibold transition-colors ${
                    !checkedInOnly
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-line bg-ivory text-ink-soft hover:border-brand-primary/50 hover:text-ink"
                  }`}
                >
                  All Students
                </button>
              </div>
              <span className="text-xs text-ink-muted">Click a row to add/remove</span>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-ivory px-4 py-2.5 text-xs font-semibold text-ink-soft">
              <span>
                {searching
                  ? "Loading…"
                  : `${results.total} ${checkedInOnly ? "checked-in " : ""}student${results.total === 1 ? "" : "s"}`}
              </span>
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
                  {searching
                    ? "Loading students…"
                    : checkedInOnly
                      ? "No checked-in students match your filter yet."
                      : "No students match your search."}
                </div>
              ) : (
                results.rows.map((student) => {
                  const inQueue = queuedIds.has(student.id);
                  const queuePos = queue.findIndex((s) => s.id === student.id) + 1;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudentInQueue(student)}
                      className={`w-full px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary ${
                        inQueue
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
                        {inQueue ? (
                          <span className="shrink-0 rounded-full bg-brand-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                            Slot {queuePos}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-line bg-ivory px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                            + Add
                          </span>
                        )}
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

        {/* Right: Print Queue (up to 3) & Generate / Print Controls */}
        <div className="lg:col-span-6">
          <div className="card card-accent p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">A4 Sheet Print Queue</p>
                <h3 className="mt-0.5 font-display text-2xl font-bold tracking-wide text-ink">
                  {queue.length} / {MAX_QUEUE} Selected
                </h3>
              </div>
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  disabled={generating || printing}
                  className="btn btn-outline btn-sm"
                >
                  Clear Queue
                </button>
              )}
            </div>

            <p className="mt-1 text-xs text-ink-soft">
              Each vertical A4 sheet fits up to 3 ID cards side by side (Front upright on top, Back rotated 180° below for folding, 12 mm top white space for punch hole, and crop marks).
            </p>

            {/* 3 Visual A4 Column Slots */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((slotIdx) => {
                const student = queue[slotIdx];
                return (
                  <div
                    key={slotIdx}
                    className={`flex min-h-[132px] flex-col justify-between rounded-control border p-3.5 ${
                      student
                        ? "border-brand-primary/50 bg-green-wash/40"
                        : "border-dashed border-line bg-ivory/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                        Card {slotIdx + 1}
                      </span>
                      {student && (
                        <button
                          type="button"
                          onClick={() => removeFromQueue(student.id)}
                          aria-label={`Remove ${student.studentName} from queue`}
                          className="rounded px-1.5 py-0.5 text-xs font-bold text-ink-muted hover:bg-white hover:text-red-700"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {student ? (
                      <div className="mt-2">
                        <p className="line-clamp-2 text-sm font-bold leading-snug text-ink">
                          {student.studentName}
                        </p>
                        <p className="mt-1 truncate text-xs text-ink-soft">{student.iiitName}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{student.rollNumber}</p>
                      </div>
                    ) : (
                      <p className="my-auto text-center text-xs text-ink-muted">
                        Empty slot
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {sheetError && (
              <div role="alert" className="mt-4 rounded-control border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-800">
                {sheetError}
              </div>
            )}

            {/* Generate / Print Actions */}
            <div className="mt-5 border-t border-line pt-4">
              {!generatedSheet ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={queue.length === 0 || generating}
                    onClick={handleGenerateSheet}
                    className="btn btn-primary btn-sm px-5"
                  >
                    {generating
                      ? "Generating A4 Sheet…"
                      : `Generate Sheet PDF (${queue.length} ${queue.length === 1 ? "ID" : "IDs"})`}
                  </button>
                  <span className="text-xs text-ink-muted">
                    Prepares the sheet in server memory (5 min) without downloading until you click Print.
                  </span>
                </div>
              ) : (
                <div className="rounded-control border border-green-300 bg-green-wash/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-brand-primary">
                        A4 Sheet Ready ({generatedSheet.count} {generatedSheet.count === 1 ? "ID card" : "ID cards"})
                      </p>
                      <p className="text-xs text-ink-soft">
                        Cached in memory until {formatTimestamp(generatedSheet.expiresAt)}. Print with 100% scale / Actual size on A4 portrait.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={printing}
                      onClick={handlePrintSheet}
                      className="btn btn-primary btn-sm px-5"
                    >
                      {printing ? "Fetching PDF to print…" : "Print ID Sheet"}
                    </button>
                    <button
                      type="button"
                      disabled={printing}
                      onClick={handleDownloadSheet}
                      className="btn btn-outline btn-sm"
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      disabled={printing || generating}
                      onClick={clearQueue}
                      className="btn btn-outline btn-sm"
                    >
                      Start Next Batch
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
