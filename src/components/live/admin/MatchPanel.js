"use client";

import { useEffect, useState } from "react";
import { formatWhen, genderLabel, ordinal, stageLabel } from "@/lib/live/format";
import ScheduleForm from "./ScheduleForm";
import { fieldControl, fieldLabel, liveApi } from "./api";

const STATUS_LABEL = { scheduled: "Scheduled", live: "Live", completed: "Finished", postponed: "Postponed", cancelled: "Cancelled" };

function Stepper({ label, value, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-white p-3 min-[440px]:flex-row min-[440px]:items-center min-[440px]:justify-between min-[440px]:gap-3">
      <span className="min-w-0 flex-1 font-semibold text-ink">{label}</span>
      <div className="flex shrink-0 items-center justify-between gap-2 min-[440px]:justify-end">
        <button type="button" className="h-12 w-12 rounded-control border border-line text-2xl font-bold text-ink disabled:opacity-40" aria-label={`Decrease ${label} score`} disabled={disabled || value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <input
          type="number" inputMode="numeric" min={0} max={9999}
          className="h-12 w-20 rounded-control border border-line text-center text-2xl font-bold tabular-nums text-ink"
          aria-label={`${label} score`} value={value} disabled={disabled}
          onChange={(e) => onChange(Math.min(9999, Math.max(0, Number.parseInt(e.target.value, 10) || 0)))}
        />
        <button type="button" className="h-12 w-12 rounded-control bg-brand-primary text-2xl font-bold text-white disabled:opacity-40" aria-label={`Increase ${label} score`} disabled={disabled || value >= 9999} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function emptyRows(count) {
  return Array.from({ length: count }, (_, index) => ({ position: index + 1, iiitCode: "", athlete: "", mark: "" }));
}

function PlacingsEditor({ rows, setRows, iiits, disabled, idPrefix }) {
  const update = (index, key, value) => setRows(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold text-ink">Placings</legend>
      {rows.map((row, index) => (
        <div key={row.position} className="grid grid-cols-1 gap-2 rounded-card border border-line bg-white p-3 sm:grid-cols-[3rem_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
          <p className="font-display text-lg font-bold text-ink sm:pb-2">{ordinal(row.position)}</p>
          <div>
            <label htmlFor={`${idPrefix}-p${index}-iiit`} className="mb-1 block text-xs font-semibold text-ink-muted">IIIT</label>
            <select id={`${idPrefix}-p${index}-iiit`} className={fieldControl} value={row.iiitCode} onChange={(e) => update(index, "iiitCode", e.target.value)}>
              <option value="">Choose an IIIT</option>
              {iiits.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-p${index}-athlete`} className="mb-1 block text-xs font-semibold text-ink-muted">Athlete or team</label>
            <input id={`${idPrefix}-p${index}-athlete`} className={fieldControl} maxLength={128} value={row.athlete} onChange={(e) => update(index, "athlete", e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-p${index}-mark`} className="mb-1 block text-xs font-semibold text-ink-muted">Time / mark</label>
            <input id={`${idPrefix}-p${index}-mark`} className={fieldControl} maxLength={64} value={row.mark} onChange={(e) => update(index, "mark", e.target.value)} placeholder="e.g. 11.02 s" />
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows(rows.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i + 1 })))} aria-label={`Remove ${ordinal(row.position)} place`} disabled={rows.length <= 1}>
            Remove
          </button>
        </div>
      ))}
      {rows.length < 16 && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows([...rows, { position: rows.length + 1, iiitCode: "", athlete: "", mark: "" }])}>
          Add {ordinal(rows.length + 1)} place
        </button>
      )}
    </fieldset>
  );
}

function ChangeLog({ matchId }) {
  const [state, setState] = useState({ loading: true, rows: [], error: "" });
  useEffect(() => {
    let active = true;
    liveApi(`/api/admin/live/matches/${matchId}`).then((result) => {
      if (active) setState({ loading: false, rows: result.ok ? result.data : [], error: result.ok ? "" : result.error });
    });
    return () => { active = false; };
  }, [matchId]);
  if (state.loading) return <p className="meta">Loading history…</p>;
  if (state.error) return <p className="text-sm text-red-700">{state.error}</p>;
  return (
    <ol className="space-y-1 text-sm">
      {state.rows.map((row) => (
        <li key={row.id} className="text-ink-soft">
          <span className="font-semibold text-ink">{row.action}</span> by {row.actor || "unknown"} · {formatWhen(new Date(row.at).toISOString())}
          {row.after && row.after.scoreA != null && <span> · {row.after.scoreA}–{row.after.scoreB}</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * One match on the scoring screen: start, update the score or placings,
 * finish; the super admin can also edit, reopen, delete and see the history.
 */
export default function MatchPanel({ match, isSuper, sports, iiits, rounds, pools, onChanged, onConflict, onNotice }) {
  const isVersus = match.kind === "versus";
  const [scoreA, setScoreA] = useState(match.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(match.scoreB ?? 0);
  const [detail, setDetail] = useState(match.scoreDetail || "");
  const [winner, setWinner] = useState(match.winner || "");
  const [note, setNote] = useState(match.resultNote || "");
  const [rows, setRows] = useState(() => (match.placings.length ? match.placings.map(({ position, iiitCode, athlete, mark }) => ({ position, iiitCode, athlete, mark })) : emptyRows(3)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(""); // "", "edit", "history"
  const [syncedVersion, setSyncedVersion] = useState(match.version);

  // A newer version from the server (another device, or our own save) replaces the local draft.
  if (syncedVersion !== match.version) {
    setSyncedVersion(match.version);
    setScoreA(match.scoreA ?? 0);
    setScoreB(match.scoreB ?? 0);
    setDetail(match.scoreDetail || "");
    setWinner(match.winner || "");
    setNote(match.resultNote || "");
    setRows(match.placings.length ? match.placings.map(({ position, iiitCode, athlete, mark }) => ({ position, iiitCode, athlete, mark })) : emptyRows(3));
  }

  const scoreDirty = isVersus && (scoreA !== (match.scoreA ?? 0) || scoreB !== (match.scoreB ?? 0) || detail.trim() !== (match.scoreDetail || ""));
  const filledRows = rows.filter((row) => row.iiitCode);
  const placingsDirty = !isVersus && JSON.stringify(filledRows) !== JSON.stringify(match.placings.map(({ position, iiitCode, athlete, mark }) => ({ position, iiitCode, athlete, mark })));
  const editable = match.status === "live" || (isSuper && match.status === "completed");
  const idPrefix = `m${match.id}`;

  const act = async (body, message) => {
    setBusy(true);
    setError("");
    const result = await liveApi(`/api/admin/live/matches/${match.id}`, { method: "PATCH", body: { version: match.version, ...body } });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (result.status === 409) onConflict();
      return false;
    }
    onChanged(result.data);
    if (message) onNotice(message);
    return true;
  };

  const placingsPayload = () => {
    const positions = new Set();
    for (const row of filledRows) {
      if (positions.has(row.position)) return null;
      positions.add(row.position);
    }
    return filledRows.map((row) => ({ ...row, athlete: row.athlete.trim(), mark: row.mark.trim() }));
  };

  const finish = async () => {
    if (isVersus) {
      if (!winner) return setError("Choose the winner first");
      const name = winner === "draw" ? "a draw" : `${winner === match.sideA?.code ? match.sideA.name : match.sideB.name} winning`;
      if (!window.confirm(`Finish this match ${scoreA}–${scoreB}, with ${name}? Only the Sports SAC can reopen it.`)) return;
      await act({ action: "finish", winner, scoreA, scoreB, scoreDetail: detail.trim(), resultNote: note.trim() }, "Match finished");
    } else {
      const placings = placingsPayload();
      if (!placings?.length) return setError("Enter at least the winner before finishing");
      if (!window.confirm(`Finish this event with ${placings.length} placing${placings.length === 1 ? "" : "s"}? Only the Sports SAC can reopen it.`)) return;
      await act({ action: "finish", placings, resultNote: note.trim() }, "Event finished");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this match and its history? This cannot be undone.")) return;
    setBusy(true);
    const result = await liveApi(`/api/admin/live/matches/${match.id}`, { method: "DELETE" });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onChanged(null, match.id);
    onNotice("Match deleted");
  };

  const sidesKnown = !isVersus || (match.sideA && match.sideB);

  return (
    <article className={`card p-4 sm:p-5 ${match.status === "live" ? "ring-2 ring-red-600/60" : ""}`} aria-labelledby={`${idPrefix}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`${idPrefix}-title`} className="font-display text-lg font-bold uppercase leading-tight text-ink">
            {isVersus ? `${match.sideA?.name || "To be decided"} vs ${match.sideB?.name || "To be decided"}` : match.eventName}
          </h3>
          <p className="meta mt-0.5">
            {[match.sportName, genderLabel(match.gender), stageLabel(match), match.bracketSlot, match.venue, match.scheduledAt ? formatWhen(match.scheduledAt) : "Time TBA"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {match.isSample && <span className="chip chip-gold">Sample</span>}
          <span className={match.status === "live" ? "chip bg-red-600 text-white" : "chip"}>{STATUS_LABEL[match.status]}</span>
        </div>
      </header>

      <div className="mt-4 space-y-4">
        {["scheduled", "postponed"].includes(match.status) && !sidesKnown && (
          <p className="text-sm text-ink-soft">Waiting for both teams: the winners of the earlier matches move here when those finish{isSuper ? ", or set them with Edit details" : ""}.</p>
        )}
        {["scheduled", "postponed"].includes(match.status) && sidesKnown && (
          <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={() => act({ action: "start" }, "Match started: it is now live on the board")}>
            {busy ? "Starting…" : isVersus ? "Start match" : "Start event"}
          </button>
        )}

        {isVersus && (editable || match.status === "completed") && (
          <div className="space-y-2">
            <Stepper label={match.sideA?.name} value={scoreA} onChange={setScoreA} disabled={busy || !editable} />
            <Stepper label={match.sideB?.name} value={scoreB} onChange={setScoreB} disabled={busy || !editable} />
            <div>
              <label htmlFor={`${idPrefix}-detail`} className={fieldLabel}>Score detail (optional)</label>
              <input id={`${idPrefix}-detail`} className={fieldControl} maxLength={255} value={detail} disabled={busy || !editable} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. 25-21, 22-25, 8-6 or 142/6 (17.2 ov)" />
            </div>
            {editable && (
              <button type="button" className="btn btn-accent w-full sm:w-auto" disabled={busy || !scoreDirty} onClick={() => act({ action: "score", scoreA, scoreB, scoreDetail: detail.trim() }, "Score updated")}>
                {busy ? "Saving…" : scoreDirty ? "Update score" : "Score is up to date"}
              </button>
            )}
          </div>
        )}

        {!isVersus && (editable || match.status === "completed") && (
          <div className="space-y-3">
            <PlacingsEditor rows={rows} setRows={setRows} iiits={iiits} disabled={busy || !editable} idPrefix={idPrefix} />
            {editable && (
              <button type="button" className="btn btn-accent w-full sm:w-auto" disabled={busy || !placingsDirty} onClick={() => {
                const placings = placingsPayload();
                if (!placings) return setError("Each position can be entered once");
                act({ action: "placings", placings }, "Placings saved");
              }}>
                {busy ? "Saving…" : placingsDirty ? "Save placings" : "Placings are up to date"}
              </button>
            )}
          </div>
        )}

        {match.status === "live" && (
          <div className="space-y-3 border-t border-line pt-4">
            {isVersus && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink">Result</legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {[match.sideA, match.sideB].map((side) => (
                    <label key={side.code} className="flex min-h-12 items-center gap-2 rounded-control border border-line bg-white px-3 py-2">
                      <input type="radio" name={`${idPrefix}-winner`} value={side.code} checked={winner === side.code} onChange={() => setWinner(side.code)} />
                      <span>{side.name} won</span>
                    </label>
                  ))}
                  {match.drawAllowed && (
                    <label className="flex min-h-12 items-center gap-2 rounded-control border border-line bg-white px-3 py-2">
                      <input type="radio" name={`${idPrefix}-winner`} value="draw" checked={winner === "draw"} onChange={() => setWinner("draw")} />
                      <span>Draw</span>
                    </label>
                  )}
                </div>
              </fieldset>
            )}
            <div>
              <label htmlFor={`${idPrefix}-note`} className={fieldLabel}>Result note (optional)</label>
              <input id={`${idPrefix}-note`} className={fieldControl} maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder={isVersus ? "e.g. Won on penalties 4–3" : "e.g. New meet record"} />
            </div>
            <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={finish}>
              {isVersus ? "Finish match" : "Finish event"}
            </button>
          </div>
        )}

        {match.status === "completed" && (
          <p className="text-sm text-ink-soft">
            {isVersus
              ? match.winner === "draw" ? "Finished as a draw." : `Won by ${match.winner === match.sideA?.code ? match.sideA?.name : match.sideB?.name}.`
              : "Event finished."}
            {match.resultNote && ` ${match.resultNote}`}
            {!isSuper && " Contact the Sports SAC to correct it."}
          </p>
        )}

        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}

        {isSuper && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {match.status === "completed" && (
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => {
                const advance = match.nextMatchId ? " Its winner is taken back out of the next match, unless that match has started (then change it by hand)." : "";
                if (window.confirm(`Reopen this match? It goes back to live and leaves the results and medal tally until finished again.${advance}`)) act({ action: "reopen" }, "Match reopened");
              }}>Reopen</button>
            )}
            <button type="button" className="btn btn-outline btn-sm" aria-expanded={mode === "edit"} onClick={() => setMode(mode === "edit" ? "" : "edit")}>Edit details</button>
            <button type="button" className="btn btn-outline btn-sm" aria-expanded={mode === "history"} onClick={() => setMode(mode === "history" ? "" : "history")}>History</button>
            <button type="button" className="btn btn-outline btn-sm border-red-300 text-red-700" disabled={busy} onClick={remove}>Delete</button>
          </div>
        )}
        {isSuper && mode === "edit" && (
          <ScheduleForm
            key={match.version}
            sports={sports} iiits={iiits} rounds={rounds} pools={pools} match={match}
            onSaved={(result) => { onChanged(result.data); onNotice("Match details saved"); setMode(""); }}
            onConflict={onConflict}
            onCancel={() => setMode("")}
          />
        )}
        {isSuper && mode === "history" && <ChangeLog key={match.version} matchId={match.id} />}
      </div>
    </article>
  );
}
