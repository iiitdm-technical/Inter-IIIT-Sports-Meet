"use client";

import { useState } from "react";
import { fromIstInput } from "@/lib/live/format";
import { fieldControl, fieldLabel } from "../api";

/**
 * Optional: gives times and venues to unplayed matches in play order. One
 * match per venue at a time, a team never twice in one slot, knockout
 * matches after the matches that feed them. Any time can be edited after.
 */
export default function BulkSchedule({ detail, save, busy }) {
  const t = detail.tournament;
  const [form, setForm] = useState({ start: "2026-12-19T09:00", minutesPerMatch: 60, venues: "", stage: "all", onlyUnscheduled: true, useWindow: true, dayStart: "09:00", dayEnd: "18:00" });
  const [error, setError] = useState("");
  const set = (key, value) => setForm({ ...form, [key]: value });

  const unplayed = detail.matches.filter((m) => ["scheduled", "postponed"].includes(m.status));
  const untimed = unplayed.filter((m) => !m.scheduledAt).length;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const start = fromIstInput(form.start);
    const venues = form.venues.split(",").map((v) => v.trim()).filter(Boolean);
    if (!start) return setError("Enter the first match's date and time");
    if (!venues.length) return setError("Enter at least one venue or court");
    if (!form.onlyUnscheduled && !window.confirm("Replace the times of every unplayed match in this stage?")) return;
    await save(`/api/admin/live/tournaments/${t.id}/schedule`, "POST", {
      start, minutesPerMatch: form.minutesPerMatch, venues, stage: form.stage, onlyUnscheduled: form.onlyUnscheduled,
      ...(form.useWindow ? { dayStart: form.dayStart, dayEnd: form.dayEnd } : {}),
    }, (d) => `${d.scheduled} match${d.scheduled === 1 ? "" : "es"} scheduled`);
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      <p className="meta sm:col-span-2">
        Optional. {unplayed.length} unplayed matches, {untimed} without a time. Times are IST. Each match can still be moved by hand afterwards.
      </p>
      <div>
        <label htmlFor={`t${t.id}-sch-start`} className={fieldLabel}>First match (IST)</label>
        <input id={`t${t.id}-sch-start`} type="datetime-local" className={fieldControl} value={form.start} onChange={(e) => set("start", e.target.value)} />
      </div>
      <div>
        <label htmlFor={`t${t.id}-sch-len`} className={fieldLabel}>Minutes per match (incl. changeover)</label>
        <input id={`t${t.id}-sch-len`} type="number" min={5} max={1440} className={fieldControl} value={form.minutesPerMatch} onChange={(e) => set("minutesPerMatch", Math.max(5, Number.parseInt(e.target.value, 10) || 5))} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`t${t.id}-sch-venues`} className={fieldLabel}>Venues or courts, separated by commas</label>
        <input id={`t${t.id}-sch-venues`} className={fieldControl} value={form.venues} onChange={(e) => set("venues", e.target.value)} placeholder="e.g. Court 1, Court 2" />
        <p className="meta mt-1">Matches at the same time are spread over these.</p>
      </div>
      <div>
        <label htmlFor={`t${t.id}-sch-stage`} className={fieldLabel}>Matches</label>
        <select id={`t${t.id}-sch-stage`} className={fieldControl} value={form.stage} onChange={(e) => set("stage", e.target.value)}>
          <option value="all">Pool and knockout</option>
          <option value="pool">Pool matches only</option>
          <option value="knockout">Knockout only</option>
        </select>
      </div>
      <div className="flex flex-col justify-center gap-1">
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.onlyUnscheduled} onChange={(e) => set("onlyUnscheduled", e.target.checked)} /> Only matches without a time
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.useWindow} onChange={(e) => set("useWindow", e.target.checked)} /> Play only between set hours each day
        </label>
      </div>
      {form.useWindow && (
        <>
          <div>
            <label htmlFor={`t${t.id}-sch-from`} className={fieldLabel}>Day starts</label>
            <input id={`t${t.id}-sch-from`} type="time" className={fieldControl} value={form.dayStart} onChange={(e) => set("dayStart", e.target.value)} />
          </div>
          <div>
            <label htmlFor={`t${t.id}-sch-to`} className={fieldLabel}>Last match ends by</label>
            <input id={`t${t.id}-sch-to`} type="time" className={fieldControl} value={form.dayEnd} onChange={(e) => set("dayEnd", e.target.value)} />
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Scheduling…" : "Set times"}</button>
      </div>
    </form>
  );
}
