"use client";

import { useState } from "react";
import { liveApi } from "../api";
import MatchRows, { AddMatch } from "./MatchRows";

function ChangeList({ title, items, render, tone = "" }) {
  if (!items.length) return null;
  return (
    <details className={`rounded-card border px-3 py-2 ${tone || "border-line bg-white"}`}>
      <summary className="cursor-pointer text-sm font-semibold text-ink">{title} ({items.length})</summary>
      <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
        {items.map((item, index) => <li key={item.id ?? index}>{render(item)}</li>)}
      </ul>
    </details>
  );
}

/**
 * Round-robin pool matches. "Check" previews what would change; nothing is
 * created, moved or removed until the Sports SAC applies it. Played matches
 * are never removed automatically.
 */
export default function PoolMatches(props) {
  const { detail, save, busy } = props;
  const t = detail.tournament;
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    setChecking(true);
    setError("");
    const result = await liveApi(`/api/admin/live/tournaments/${t.id}/pool-matches`, { method: "POST", body: { apply: false } });
    setChecking(false);
    if (!result.ok) return setError(result.error);
    setPreview(result.data.changes);
  };
  const apply = async () => {
    const data = await save(`/api/admin/live/tournaments/${t.id}/pool-matches`, "POST", { apply: true }, (d) => `Pool matches updated: ${d.changes.create.length} added, ${d.changes.move.length} moved, ${d.changes.remove.length} removed`);
    if (data) setPreview(null);
  };

  const nothing = preview && !preview.create.length && !preview.move.length && !preview.remove.length;
  const totalPoolMatches = detail.pools.reduce((sum, pool) => sum + pool.matches.length, 0);

  return (
    <div className="space-y-5">
      <div className="card-tint rounded-card p-3 text-sm">
        <p className="text-ink-soft">
          Every team plays every other team in its pool once. Check first to see what will be added; matches you have edited or played are kept.
          Times are left empty: set them under <strong className="font-semibold text-ink">Schedule</strong> or match by match.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={checking || busy || !detail.pools.length} onClick={check}>{checking ? "Checking…" : totalPoolMatches ? "Check pool matches against the pools" : "Generate pool matches"}</button>
          {!detail.pools.length && <span className="meta self-center">Put teams into pools first.</span>}
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}

      {preview && (
        <div className="space-y-2 rounded-card border-2 border-brand-primary/40 p-3">
          {nothing ? (
            <p className="text-sm font-semibold text-brand-primary">Pool matches are up to date ({preview.kept} matches).</p>
          ) : (
            <p className="text-sm font-semibold text-ink">
              {preview.create.length} to add, {preview.move.length} to move to another pool, {preview.remove.length} unplayed to remove; {preview.kept} unchanged.
            </p>
          )}
          <ChangeList title="To add" items={preview.create} render={(m) => `Pool ${m.pool}: ${m.sideA} vs ${m.sideB}`} />
          <ChangeList title="To move" items={preview.move} render={(m) => `${m.sideA} vs ${m.sideB}: Pool ${m.pool} → Pool ${m.toPool}`} />
          <ChangeList title="To remove (not played yet)" items={preview.remove} render={(m) => `Pool ${m.pool}: ${m.sideA} vs ${m.sideB}`} />
          <ChangeList
            title="Played or live, but the teams are no longer in the same pool: kept, not counted in the standings. Delete them below if they should go"
            items={preview.stale} tone="border-amber-300 bg-gold-wash"
            render={(m) => `Pool ${m.pool}: ${m.sideA} vs ${m.sideB} (${m.status})`}
          />
          {!nothing && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={apply}>{busy ? "Applying…" : "Apply these changes"}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreview(null)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {detail.pools.map((pool) => (
        <section key={pool.pool} aria-labelledby={`t${t.id}-pm-${pool.pool}`}>
          <h3 id={`t${t.id}-pm-${pool.pool}`} className="mb-2 font-display text-base font-bold uppercase tracking-wide text-ink">
            Pool {pool.pool} <span className="meta normal-case">{pool.played} of {pool.total} played</span>
          </h3>
          <MatchRows {...props} matches={pool.matches} emptyText="No matches yet." />
        </section>
      ))}

      {detail.others.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-ink">Other matches</h3>
          <MatchRows {...props} matches={detail.others} />
        </section>
      )}
      <AddMatch {...props} />
    </div>
  );
}
