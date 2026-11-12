"use client";

import { useState } from "react";
import { formatWhen } from "@/lib/live/format";
import ScheduleForm from "../ScheduleForm";
import { liveApi } from "../api";

const STATUS = { scheduled: "Scheduled", live: "Live", completed: "Finished", postponed: "Postponed", cancelled: "Cancelled" };

function sideName(side, placeholder) {
  return side?.name || placeholder || "To be decided";
}

/**
 * Tournament matches with an Edit form (teams, time, venue, round, status)
 * and Delete: the hand override for anything generated automatically.
 * Scores are entered from the Matches tab.
 */
export default function MatchRows({ matches, detail, sports, iiits, rounds, pools, reload, onNotice, emptyText = "No matches." }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const teamCodes = new Set(detail.teams.map((team) => team.code));
  // The tournament's teams first; any other IIIT already in a match stays choosable.
  const choices = iiits.filter((item) => teamCodes.has(item.code) || matches.some((m) => m.sideA?.code === item.code || m.sideB?.code === item.code));

  const remove = async (match) => {
    const played = match.status === "completed" || match.status === "live";
    if (!window.confirm(played ? "Delete this match and its result? Standings and the bracket change. This cannot be undone." : "Delete this match?")) return;
    const result = await liveApi(`/api/admin/live/matches/${match.id}`, { method: "DELETE" });
    if (!result.ok) return setError(result.error);
    onNotice("Match deleted");
    reload();
  };

  if (!matches.length) return <p className="meta">{emptyText}</p>;
  return (
    <div>
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
      <ol className="divide-y divide-line rounded-card border border-line bg-white">
        {matches.map((match) => (
          <li key={match.id} className="p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {match.bracketSlot && <span className="chip">{match.bracketSlot}</span>}
              <p className="min-w-0 flex-1 text-sm text-ink">
                <span className={match.winner === match.sideA?.code ? "font-bold" : "font-semibold"}>{sideName(match.sideA, match.placeholderA)}</span>
                {match.status === "completed" || match.status === "live" ? <span className="px-1.5 tabular-nums">{match.scoreA ?? 0}–{match.scoreB ?? 0}</span> : <span className="px-1.5 text-ink-muted">vs</span>}
                <span className={match.winner === match.sideB?.code ? "font-bold" : "font-semibold"}>{sideName(match.sideB, match.placeholderB)}</span>
                {match.winner === "draw" && <span className="meta"> · draw</span>}
              </p>
              <span className="meta">{[match.scheduledAt ? formatWhen(match.scheduledAt) : "Time TBA", match.venue].filter(Boolean).join(" · ")}</span>
              <span className={match.status === "live" ? "chip bg-red-600 text-white" : "chip"}>{match.isBye ? "Bye" : STATUS[match.status]}</span>
              <div className="flex gap-1.5">
                <button type="button" className="btn btn-outline btn-sm" aria-expanded={editing === match.id} onClick={() => setEditing(editing === match.id ? null : match.id)}>Edit</button>
                <button type="button" className="btn btn-outline btn-sm border-red-300 text-red-700" onClick={() => remove(match)}>Delete</button>
              </div>
            </div>
            {editing === match.id && (
              <div className="mt-3 border-t border-line pt-3">
                <ScheduleForm
                  key={match.version} match={match} sports={sports} iiits={choices} rounds={rounds} pools={pools}
                  onSaved={() => { setEditing(null); onNotice("Match saved"); reload(); }}
                  onConflict={reload}
                  onCancel={() => setEditing(null)}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** "Add a match by hand" (e.g. a replay or a tie-break) inside the tournament. */
export function AddMatch({ detail, sports, iiits, rounds, pools, reload, onNotice, defaultLabel = "Add a match by hand" }) {
  const [open, setOpen] = useState(false);
  const teamCodes = new Set(detail.teams.map((team) => team.code));
  return (
    <div>
      <button type="button" className="btn btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : defaultLabel}</button>
      {open && (
        <div className="mt-3 rounded-card border border-line bg-white p-3">
          <ScheduleForm
            tournament={detail.tournament} sports={sports} iiits={iiits.filter((item) => teamCodes.has(item.code))} rounds={rounds} pools={pools}
            onSaved={() => { setOpen(false); onNotice("Match added"); reload(); }}
          />
        </div>
      )}
    </div>
  );
}
