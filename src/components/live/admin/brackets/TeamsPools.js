"use client";

import { useMemo, useState } from "react";
import { fieldControl, fieldLabel } from "../api";

const letter = (index) => String.fromCharCode(65 + index);

/**
 * The tournament's IIITs and their pools, edited locally and saved together.
 * Any number of pools and teams per pool; "Spread evenly" is only a helper.
 */
export default function TeamsPools({ detail, save, busy, iiits, onNext }) {
  const t = detail.tournament;
  const initialTeams = detail.teams.map((team) => ({ code: team.code, pool: team.pool }));
  const initialPools = detail.pools.map((pool) => pool.pool);
  const [teams, setTeams] = useState(initialTeams);
  const [poolNames, setPoolNames] = useState(initialPools);
  const [poolCount, setPoolCount] = useState(Math.max(initialPools.length, 1));
  const [saved, setSaved] = useState(false);

  const names = useMemo(() => new Map(iiits.map((item) => [item.code, item.name])), [iiits]);
  const inTournament = new Set(teams.map((team) => team.code));
  const available = iiits.filter((item) => !inTournament.has(item.code));
  const dirty = JSON.stringify(teams) !== JSON.stringify(initialTeams);
  const playedPoolMatches = detail.pools.some((pool) => pool.played > 0);

  const setPools = (count) => {
    const next = Array.from({ length: count }, (_, i) => letter(i));
    setPoolNames(next);
    setTeams((list) => list.map((team) => (team.pool && !next.includes(team.pool) ? { ...team, pool: "" } : team)));
  };
  const addPool = () => {
    const used = new Set(poolNames);
    let i = 0;
    while (used.has(letter(i)) && i < 26) i += 1;
    if (i < 26) setPoolNames([...poolNames, letter(i)].sort());
  };
  const removePool = (pool) => {
    setPoolNames(poolNames.filter((name) => name !== pool));
    setTeams(teams.map((team) => (team.pool === pool ? { ...team, pool: "" } : team)));
  };
  const add = (code, pool) => code && setTeams([...teams, { code, pool }]);
  const move = (code, pool) => setTeams(teams.map((team) => (team.code === code ? { ...team, pool } : team)));
  const drop = (code) => setTeams(teams.filter((team) => team.code !== code));
  const spread = () => {
    if (!poolNames.length) return;
    if (playedPoolMatches && !window.confirm("Some pool matches have been played. Spreading the teams again moves them between pools; played results are kept. Continue?")) return;
    // Snake order (A B C D D C B A …) keeps pool sizes within one of each other.
    setTeams(teams.map((team, index) => {
      const round = Math.floor(index / poolNames.length);
      const pos = index % poolNames.length;
      return { ...team, pool: poolNames[round % 2 === 0 ? pos : poolNames.length - 1 - pos] };
    }));
  };

  const submit = async () => {
    const result = await save(`/api/admin/live/tournaments/${t.id}/teams`, "PUT", { version: t.version, teams: teams.map((team) => ({ iiitCode: team.code, pool: team.pool })) }, "Teams and pools saved");
    if (result) setSaved(true);
  };

  const groups = [...poolNames.map((pool) => ({ pool, label: `Pool ${pool}` })), { pool: "", label: "Not in a pool" }];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="sm:w-40">
          <label htmlFor={`t${t.id}-pools`} className={fieldLabel}>Number of pools</label>
          <input id={`t${t.id}-pools`} type="number" min={1} max={26} className={fieldControl} value={poolCount} onChange={(e) => setPoolCount(Math.min(26, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))} />
        </div>
        <button type="button" className="btn btn-outline" onClick={() => setPools(poolCount)}>Set pools</button>
        <button type="button" className="btn btn-outline" onClick={addPool} disabled={poolNames.length >= 26}>Add a pool</button>
        <button type="button" className="btn btn-outline" onClick={() => setTeams([...teams, ...available.map((item) => ({ code: item.code, pool: "" }))])} disabled={!available.length}>Add every IIIT</button>
        <button type="button" className="btn btn-outline" onClick={spread} disabled={!poolNames.length || !teams.length}>Spread evenly across pools</button>
      </div>
      <p className="meta">
        {teams.length} teams in {poolNames.length} pool{poolNames.length === 1 ? "" : "s"}. Move a team with its pool menu.
        {playedPoolMatches && " Results already played are kept when teams move; the standings only count matches between teams in the same pool."}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {groups.map((group) => {
          const members = teams.filter((team) => team.pool === group.pool);
          if (!group.pool && !members.length && !available.length) return null;
          return (
            <div key={group.pool || "none"} className={`rounded-card border p-3 ${group.pool ? "border-line bg-white" : "border-dashed border-line bg-ivory"}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">{group.label} <span className="meta normal-case">{members.length}</span></h3>
                {group.pool && <button type="button" className="text-sm font-semibold text-red-700 underline underline-offset-2" onClick={() => removePool(group.pool)}>Remove pool</button>}
              </div>
              <ul className="divide-y divide-line">
                {members.map((team) => (
                  <li key={team.code} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{names.get(team.code) || team.code}</span>
                    <label className="sr-only" htmlFor={`t${t.id}-move-${team.code}`}>Pool for {names.get(team.code)}</label>
                    <select id={`t${t.id}-move-${team.code}`} className="rounded-control border border-line bg-white px-2 py-1.5 text-sm" value={team.pool} onChange={(e) => move(team.code, e.target.value)}>
                      {poolNames.map((pool) => <option key={pool} value={pool}>Pool {pool}</option>)}
                      <option value="">No pool</option>
                    </select>
                    <button type="button" className="rounded-control px-2 py-1 text-sm font-semibold text-red-700" aria-label={`Remove ${names.get(team.code)}`} onClick={() => drop(team.code)}>✕</button>
                  </li>
                ))}
              </ul>
              {available.length > 0 && (
                <div className="mt-2">
                  <label className="sr-only" htmlFor={`t${t.id}-add-${group.pool || "none"}`}>Add an IIIT to {group.label}</label>
                  <select id={`t${t.id}-add-${group.pool || "none"}`} className={fieldControl} value="" onChange={(e) => add(e.target.value, group.pool)}>
                    <option value="">+ Add an IIIT</option>
                    {available.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={submit}>{busy ? "Saving…" : dirty ? "Save teams and pools" : "Teams and pools are saved"}</button>
        {dirty && <button type="button" className="btn btn-outline" onClick={() => { setTeams(initialTeams); setPoolNames(initialPools); }}>Undo changes</button>}
        {(saved || (!dirty && teams.length > 0)) && <button type="button" className="btn btn-accent" onClick={onNext}>Next: pool matches →</button>}
      </div>
    </div>
  );
}
