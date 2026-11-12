"use client";

import { useCallback, useEffect, useState } from "react";
import { genderLabel } from "@/lib/live/format";
import { liveApi } from "../api";
import SettingsFields from "./SettingsFields";
import TeamsPools from "./TeamsPools";
import PoolMatches from "./PoolMatches";
import Standings from "./Standings";
import Knockout from "./Knockout";
import BulkSchedule from "./BulkSchedule";

const STEPS = [
  { id: "teams", label: "1. Teams and pools" },
  { id: "pool-matches", label: "2. Pool matches" },
  { id: "standings", label: "3. Standings" },
  { id: "knockout", label: "4. Knockout" },
  { id: "schedule", label: "Schedule" },
  { id: "settings", label: "Settings" },
];

function Settings({ detail, save, onDelete }) {
  const t = detail.tournament;
  const [form, setForm] = useState({ name: t.name, pointsWin: t.pointsWin, pointsDraw: t.pointsDraw, pointsLoss: t.pointsLoss, allowDraws: t.allowDraws, qualifyPerPool: t.qualifyPerPool, thirdPlace: t.thirdPlace });
  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate
      onSubmit={(e) => { e.preventDefault(); save(`/api/admin/live/tournaments/${t.id}`, "PATCH", { ...form, name: form.name.trim(), version: t.version }, "Settings saved. Standings use the new points."); }}
    >
      <SettingsFields idPrefix={`t${t.id}`} value={form} onChange={(next) => setForm({ ...form, ...next })} />
      <p className="meta sm:col-span-2">Changing the points recalculates every pool table straight away; results stay as they are. The 3rd-place setting applies when the bracket is next built.</p>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-primary">Save settings</button>
        <button type="button" className="btn btn-outline border-red-300 text-red-700" onClick={onDelete}>Delete tournament</button>
      </div>
    </form>
  );
}

/** One tournament: teams and pools, pool matches, standings, knockout, schedule. */
export default function TournamentEditor({ id, sports, iiits, rounds, pools, onNotice, onChanged, onDeleted }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("teams");

  const load = useCallback(async () => {
    const result = await liveApi(`/api/admin/live/tournaments/${id}`);
    if (!result.ok) return setError(result.error);
    setError("");
    setDetail(result.data);
  }, [id]);

  // load() only sets state after its request finishes.
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  /** Sends a change; the response is the updated tournament (or { tournament }). */
  const save = useCallback(async (url, method, body, message) => {
    setBusy(true);
    setError("");
    const result = await liveApi(url, { method, body });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (result.status === 409) load();
      return null;
    }
    // Most routes answer with the whole tournament; some wrap it as { tournament }.
    const data = result.data;
    const next = data?.pools ? data : data?.tournament?.pools ? data.tournament : null;
    if (next) setDetail(next);
    else load();
    if (message) onNotice(typeof message === "function" ? message(result.data) : message);
    onChanged();
    return result.data;
  }, [load, onNotice, onChanged]);

  const remove = async () => {
    if (!window.confirm("Delete this tournament with its pools, bracket and every match in it (including results)? This cannot be undone.")) return;
    const result = await liveApi(`/api/admin/live/tournaments/${id}`, { method: "DELETE" });
    if (!result.ok) return setError(result.error);
    onDeleted();
  };

  if (!detail) return error ? <div role="alert" className="text-sm font-semibold text-red-700">{error}</div> : <p className="meta">Loading tournament…</p>;
  const t = detail.tournament;
  const shared = { detail, save, busy, reload: load, onNotice, sports, iiits, rounds, pools };

  return (
    <section className="card p-4 sm:p-5" aria-labelledby={`t${t.id}-title`}>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`t${t.id}-title`} className="heading-card">{[t.sportName, genderLabel(t.gender), t.name].filter(Boolean).join(" · ")}</h2>
        <p className="meta">
          Win {t.pointsWin} · Draw {t.allowDraws ? t.pointsDraw : "not allowed"} · Loss {t.pointsLoss} · {t.qualifyPerPool} through per pool
          {t.isSample && " · sample"}
        </p>
      </header>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Tournament steps">
        {STEPS.map((item) => (
          <button
            key={item.id} type="button" role="tab" aria-selected={step === item.id}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${step === item.id ? "border-brand-primary text-brand-primary" : "border-transparent text-ink-muted hover:text-ink"}`}
            onClick={() => setStep(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="mb-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}

      {step === "teams" && <TeamsPools key={t.version} {...shared} onNext={() => setStep("pool-matches")} />}
      {step === "pool-matches" && <PoolMatches {...shared} />}
      {step === "standings" && <Standings {...shared} />}
      {step === "knockout" && <Knockout {...shared} />}
      {step === "schedule" && <BulkSchedule {...shared} />}
      {step === "settings" && <Settings key={t.version} detail={detail} save={save} onDelete={remove} />}
    </section>
  );
}
