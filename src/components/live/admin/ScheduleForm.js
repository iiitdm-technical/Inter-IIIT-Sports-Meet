"use client";

import { useState } from "react";
import { fromIstInput, genderLabel, toIstInput } from "@/lib/live/format";
import { fieldControl, fieldLabel, liveApi } from "./api";

/**
 * Schedules a new match, or edits an existing one's details (super admin).
 * Times are entered and shown in IST, whatever the device's time zone.
 */
export default function ScheduleForm({ sports, iiits, rounds, pools = [], match = null, tournament = null, onSaved, onCancel, onConflict }) {
  const editing = Boolean(match);
  // Tournament matches may wait for a team (the winner of an earlier match).
  const tournamentId = match?.tournamentId || tournament?.id || null;
  const [form, setForm] = useState(() => ({
    sportId: match?.sportId || tournament?.sportId || "",
    gender: match?.gender || tournament?.gender || "",
    eventId: match?.eventId || "",
    sideA: match?.sideA?.code || "",
    sideB: match?.sideB?.code || "",
    round: match?.round || "",
    pool: match?.pool || "",
    venue: match?.venue || "",
    scheduledAt: toIstInput(match?.scheduledAt),
    status: match?.status || "scheduled",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sport = sports.find((item) => item.id === form.sportId);
  const isEvent = sport?.kind === "event";
  const events = isEvent ? sport.events?.[form.gender] || [] : [];
  const canChangeStatus = !editing || ["scheduled", "postponed", "cancelled"].includes(match.status);
  const idPrefix = editing ? `edit-${match.id}` : "new";

  const set = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "sportId") {
      const chosen = sports.find((item) => item.id === value);
      next.gender = chosen?.genders.length === 1 ? chosen.genders[0] : "";
      next.eventId = "";
    }
    if (key === "gender") next.eventId = "";
    return next;
  });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const scheduledAt = form.scheduledAt ? fromIstInput(form.scheduledAt) : null;
    if (!form.sportId || !form.gender) return setError("Choose the sport and category");
    if (isEvent && !form.eventId) return setError("Choose the event");
    if (!isEvent && !tournamentId && (!form.sideA || !form.sideB)) return setError("Choose both IIITs");
    if (!isEvent && form.sideA && form.sideA === form.sideB) return setError("An IIIT cannot play itself");
    if (form.scheduledAt && !scheduledAt) return setError("Enter a valid date and time, or leave it empty");

    const common = {
      eventId: isEvent ? form.eventId : null,
      sideA: isEvent ? null : form.sideA,
      sideB: isEvent ? null : form.sideB,
      round: form.round,
      pool: isEvent ? "" : form.pool,
      venue: form.venue.trim(),
      scheduledAt,
    };
    setBusy(true);
    const result = editing
      ? await liveApi(`/api/admin/live/matches/${match.id}`, {
        method: "PATCH",
        body: { action: "details", version: match.version, ...common, ...(canChangeStatus ? { status: form.status } : {}) },
      })
      : await liveApi("/api/admin/live/matches", { method: "POST", body: { sportId: form.sportId, gender: form.gender, ...common, ...(tournamentId ? { tournamentId } : {}) } });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (result.status === 409) onConflict?.();
      return;
    }
    if (!editing) setForm((current) => ({ ...current, sideA: "", sideB: "", eventId: "" }));
    onSaved?.(result);
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label htmlFor={`${idPrefix}-sport`} className={fieldLabel}>Sport</label>
        <select id={`${idPrefix}-sport`} className={fieldControl} value={form.sportId} disabled={editing || Boolean(tournament)} onChange={(e) => set("sportId", e.target.value)}>
          <option value="">Choose a sport</option>
          {sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-gender`} className={fieldLabel}>Category</label>
        <select id={`${idPrefix}-gender`} className={fieldControl} value={form.gender} disabled={editing || Boolean(tournament) || !sport} onChange={(e) => set("gender", e.target.value)}>
          <option value="">Choose a category</option>
          {(sport?.genders || []).map((gender) => <option key={gender} value={gender}>{genderLabel(gender)}</option>)}
        </select>
      </div>

      {isEvent ? (
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-event`} className={fieldLabel}>Event</label>
          <select id={`${idPrefix}-event`} className={fieldControl} value={form.eventId} disabled={!form.gender} onChange={(e) => set("eventId", e.target.value)}>
            <option value="">Choose an event</option>
            {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor={`${idPrefix}-side-a`} className={fieldLabel}>IIIT (side A)</label>
            <select id={`${idPrefix}-side-a`} className={fieldControl} value={form.sideA} onChange={(e) => set("sideA", e.target.value)}>
              <option value="">{tournamentId ? "To be decided" : "Choose an IIIT"}</option>
              {iiits.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-side-b`} className={fieldLabel}>IIIT (side B)</label>
            <select id={`${idPrefix}-side-b`} className={fieldControl} value={form.sideB} onChange={(e) => set("sideB", e.target.value)}>
              <option value="">{tournamentId ? "To be decided" : "Choose an IIIT"}</option>
              {iiits.filter((item) => item.code !== form.sideA).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </div>
        </>
      )}

      <div>
        <label htmlFor={`${idPrefix}-round`} className={fieldLabel}>Round</label>
        <select id={`${idPrefix}-round`} className={fieldControl} value={form.round} onChange={(e) => set("round", e.target.value)}>
          <option value="">Not set</option>
          {rounds.map((round) => <option key={round} value={round}>{round}</option>)}
        </select>
      </div>
      {!isEvent && (
        <div>
          <label htmlFor={`${idPrefix}-pool`} className={fieldLabel}>Pool (group stage)</label>
          <select id={`${idPrefix}-pool`} className={fieldControl} value={form.pool} onChange={(e) => set("pool", e.target.value)}>
            <option value="">No pool</option>
            {pools.map((item) => <option key={item} value={item}>Pool {item}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-venue`} className={fieldLabel}>Venue</label>
        <input id={`${idPrefix}-venue`} className={fieldControl} value={form.venue} maxLength={128} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. Main Ground" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-when`} className={fieldLabel}>Date and time (IST, optional)</label>
        <input id={`${idPrefix}-when`} type="datetime-local" className={fieldControl} value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} />
      </div>
      {editing && canChangeStatus && (
        <div>
          <label htmlFor={`${idPrefix}-status`} className={fieldLabel}>Status</label>
          <select id={`${idPrefix}-status`} className={fieldControl} value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="scheduled">Scheduled</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled (hidden from the board)</option>
          </select>
        </div>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add to schedule"}</button>
        {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </form>
  );
}
