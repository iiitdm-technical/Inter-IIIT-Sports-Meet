"use client";

import { useCallback, useEffect, useState } from "react";
import { genderLabel } from "@/lib/live/format";
import { fieldControl, fieldLabel, liveApi } from "../api";
import TournamentEditor from "./TournamentEditor";
import SettingsFields, { DEFAULT_SETTINGS } from "./SettingsFields";

function CreateTournament({ sports, onCreated }) {
  const versusSports = sports.filter((sport) => sport.kind === "versus");
  const [form, setForm] = useState({ sportId: "", gender: "", ...DEFAULT_SETTINGS });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sport = versusSports.find((item) => item.id === form.sportId);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.sportId || !form.gender) return setError("Choose the sport and category");
    setBusy(true);
    setError("");
    const result = await liveApi("/api/admin/live/tournaments", { method: "POST", body: { ...form, name: form.name.trim() } });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setForm({ sportId: "", gender: "", ...DEFAULT_SETTINGS });
    onCreated(result.data.id);
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label htmlFor="new-t-sport" className={fieldLabel}>Sport</label>
        <select id="new-t-sport" className={fieldControl} value={form.sportId} onChange={(e) => {
          const chosen = versusSports.find((item) => item.id === e.target.value);
          setForm({ ...form, sportId: e.target.value, gender: chosen?.genders.length === 1 ? chosen.genders[0] : "" });
        }}>
          <option value="">Choose a sport</option>
          {versusSports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="new-t-gender" className={fieldLabel}>Category</label>
        <select id="new-t-gender" className={fieldControl} value={form.gender} disabled={!sport} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="">Choose a category</option>
          {(sport?.genders || []).map((gender) => <option key={gender} value={gender}>{genderLabel(gender)}</option>)}
        </select>
      </div>
      <SettingsFields idPrefix="new-t" value={form} onChange={(next) => setForm({ ...form, ...next })} />
      {error && <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create tournament"}</button>
      </div>
    </form>
  );
}

/**
 * Brackets tab (Sports SAC): tournaments with pools and a knockout bracket.
 * Pool and knockout matches are scored from the Matches tab like any other.
 */
export default function BracketsPanel({ sports, iiits, rounds, pools, onNotice, onMatchesChanged }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const result = await liveApi("/api/admin/live/tournaments");
    if (!result.ok) return setError(result.error);
    setError("");
    setList(result.data);
    setSelected((current) => (current && result.data.some((t) => t.id === current) ? current : result.data[0]?.id ?? null));
  }, []);

  // load() only sets state after its request finishes.
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        A tournament has pools (every team plays every other team in its pool) and a knockout bracket you fill by hand.
        Matches created here are scored from the <strong className="font-semibold text-ink">Matches</strong> tab, and appear on the public <a href="/brackets" className="font-semibold text-brand-primary underline underline-offset-2">Brackets</a> page.
      </p>
      {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}
      {!list && !error && <p className="meta">Loading…</p>}

      {list && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {list.length > 0 && (
            <div className="sm:w-96">
              <label htmlFor="t-pick" className={fieldLabel}>Tournament</label>
              <select id="t-pick" className={fieldControl} value={selected ?? ""} onChange={(e) => { setSelected(Number(e.target.value) || null); setCreating(false); }}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {[t.sportName, genderLabel(t.gender), t.name].filter(Boolean).join(" · ")} ({t.teamCount} teams){t.isSample ? " · sample" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="button" className="btn btn-outline" aria-expanded={creating} onClick={() => setCreating(!creating)}>
            {creating ? "Close" : "New tournament"}
          </button>
        </div>
      )}

      {creating && (
        <section className="card p-4 sm:p-5" aria-labelledby="new-t-title">
          <h2 id="new-t-title" className="heading-card mb-4">New tournament</h2>
          <CreateTournament sports={sports} onCreated={(id) => { setCreating(false); setSelected(id); onNotice("Tournament created. Add the teams and pools next."); load(); }} />
        </section>
      )}

      {list && list.length === 0 && !creating && (
        <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">No tournaments yet. Create one to set up pools and a bracket.</p>
      )}

      {selected && !creating && (
        <TournamentEditor
          key={selected} id={selected} sports={sports} iiits={iiits} rounds={rounds} pools={pools}
          onNotice={onNotice}
          onChanged={() => { load(); onMatchesChanged?.(); }}
          onDeleted={() => { setSelected(null); onNotice("Tournament deleted"); load(); onMatchesChanged?.(); }}
        />
      )}
    </div>
  );
}
