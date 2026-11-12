"use client";

import { useState } from "react";
import { bracketSizeFor, suggestSlots } from "@/lib/live/bracket-seeding";
import { fieldControl, fieldLabel } from "../api";
import MatchRows from "./MatchRows";

const SIZES = [2, 4, 8, 16, 32];
const FIRST_ROUND = { 2: "Final", 4: "Semi-final", 8: "Quarter-final", 16: "Round of 16", 32: "Round of 32" };

/** Builds the bracket from teams placed by hand; a pre-fill from the standings is only a suggestion. */
function Builder({ detail, save, busy, onDone }) {
  const t = detail.tournament;
  const existing = detail.knockout.rounds[0]?.matches || [];
  const qualifiers = detail.pools.length * t.qualifyPerPool;
  const [size, setSize] = useState(detail.knockout.size || bracketSizeFor(Math.max(2, qualifiers || detail.teams.length)));
  const [thirdPlace, setThirdPlace] = useState(t.thirdPlace);
  const [slots, setSlots] = useState(() => (existing.length
    ? existing.flatMap((match) => [match.sideA?.code || null, match.sideB?.code || null])
    : Array(size).fill(null)));
  const [error, setError] = useState("");

  // "A1 · IIIT Kota" labels from the standings help placing teams.
  const labels = new Map();
  for (const pool of detail.pools) pool.rows.forEach((row, index) => labels.set(row.iiitCode, `${pool.pool}${index + 1}`));
  const teams = detail.teams.slice().sort((a, b) => (labels.get(a.code) || "ZZ").localeCompare(labels.get(b.code) || "ZZ") || a.name.localeCompare(b.name));
  const used = new Set(slots.filter(Boolean));

  const resize = (next) => {
    setSize(next);
    setSlots((current) => Array.from({ length: next }, (_, i) => current[i] || null));
  };
  const setSlot = (index, code) => setSlots(slots.map((value, i) => (i === index ? code || null : value)));
  const prefill = () => {
    setSlots(suggestSlots(detail.pools, t.qualifyPerPool, size));
    setError("");
  };

  const submit = async () => {
    const placed = slots.filter(Boolean);
    if (placed.length < 2) return setError("Place at least two teams");
    if (new Set(placed).size !== placed.length) return setError("A team is placed twice");
    const message = existing.length
      ? "Rebuild the bracket with these teams? Unplayed knockout matches are replaced; their times and venues are kept."
      : `Build a ${size}-team bracket${thirdPlace ? " with a 3rd-place match" : ""}? Empty positions are byes.`;
    if (!window.confirm(message)) return;
    if (await save(`/api/admin/live/tournaments/${t.id}/bracket`, "PUT", { size, thirdPlace, slots }, "Bracket built. Winners move on automatically; every match can still be edited.")) onDone();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_auto_1fr] sm:items-end">
        <div>
          <label htmlFor={`t${t.id}-size`} className={fieldLabel}>Bracket size</label>
          <select id={`t${t.id}-size`} className={fieldControl} value={size} onChange={(e) => resize(Number(e.target.value))}>
            {SIZES.map((value) => <option key={value} value={value}>{value} teams ({FIRST_ROUND[value]})</option>)}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={thirdPlace} disabled={size < 4} onChange={(e) => setThirdPlace(e.target.checked)} /> 3rd-place match
        </label>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button type="button" className="btn btn-outline btn-sm" disabled={!detail.pools.length} onClick={prefill}>Pre-fill from standings</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSlots(Array(size).fill(null))}>Clear all</button>
        </div>
      </div>
      <p className="meta">
        Choose the team for each position. Leave a position empty for a bye (the other team goes straight through).
        Pre-fill pairs pool winners with runners-up from another pool (A1 v B2, B1 v A2…); change anything you like.
        {qualifiers > 0 && ` ${detail.pools.length} pools × ${t.qualifyPerPool} = ${qualifiers} qualifiers.`}
      </p>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: size / 2 }, (_, m) => (
          <li key={m} className="rounded-card border border-line bg-white p-3">
            <p className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-brand-primary">{FIRST_ROUND[size]} {size > 2 ? m + 1 : ""}</p>
            {[0, 1].map((side) => {
              const index = m * 2 + side;
              const value = slots[index] || "";
              return (
                <div key={side} className={side ? "mt-2" : ""}>
                  <label htmlFor={`t${t.id}-slot-${index}`} className="sr-only">{FIRST_ROUND[size]} {m + 1}, {side ? "side B" : "side A"}</label>
                  <select id={`t${t.id}-slot-${index}`} className={fieldControl} value={value} onChange={(e) => setSlot(index, e.target.value)}>
                    <option value="">— Empty (bye) —</option>
                    {teams.filter((team) => team.code === value || !used.has(team.code)).map((team) => (
                      <option key={team.code} value={team.code}>{labels.get(team.code) ? `${labels.get(team.code)} · ` : ""}{team.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Saving…" : existing.length ? "Rebuild bracket" : "Build bracket"}</button>
        {existing.length > 0 && <button type="button" className="btn btn-outline" onClick={onDone}>Cancel</button>}
      </div>
    </div>
  );
}

/**
 * The knockout: build it by placing teams, then each match can be edited by
 * hand (teams, time, venue). Finishing a match moves its winner on.
 */
export default function Knockout(props) {
  const { detail, save, busy } = props;
  const t = detail.tournament;
  const built = detail.knockout.rounds.length > 0;
  const [building, setBuilding] = useState(!built);

  if (building || !built) {
    return <Builder key={t.version} {...props} onDone={() => setBuilding(false)} />;
  }
  const played = [...detail.knockout.rounds.flatMap((r) => r.matches), detail.knockout.third].some((m) => m && ["live", "completed"].includes(m.status));
  return (
    <div className="space-y-5">
      {detail.champion && <p className="rounded-card border border-amber-300 bg-gold-wash px-4 py-3 font-semibold text-ink">Champion: {detail.champion.name}</p>}
      <p className="meta">
        Winners move into the next match when a match finishes{t.thirdPlace ? ", and semi-final losers into the 3rd-place match" : ""}. Use Edit to change any team, time or venue by hand.
      </p>
      {detail.knockout.rounds.map((round) => (
        <section key={round.name}>
          <h3 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-ink">{round.name}</h3>
          <MatchRows {...props} matches={round.matches} />
        </section>
      ))}
      {detail.knockout.third && (
        <section>
          <h3 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-ink">3rd place</h3>
          <MatchRows {...props} matches={[detail.knockout.third]} />
        </section>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" className="btn btn-outline btn-sm" disabled={played} title={played ? "Knockout matches have been played; edit matches one by one" : undefined} onClick={() => setBuilding(true)}>Rebuild bracket</button>
        <button type="button" className="btn btn-outline btn-sm border-red-300 text-red-700" disabled={busy || played} onClick={() => {
          if (window.confirm("Remove the whole knockout bracket? Its matches are deleted.")) save(`/api/admin/live/tournaments/${t.id}/bracket`, "DELETE", undefined, "Bracket removed");
        }}>Remove bracket</button>
        {played && <span className="meta self-center">Knockout matches have been played, so the bracket can no longer be rebuilt; edit matches one by one.</span>}
      </div>
    </div>
  );
}
