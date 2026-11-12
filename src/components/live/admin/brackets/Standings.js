"use client";

import { useState } from "react";

function PoolStanding({ pool, detail, save, busy }) {
  const t = detail.tournament;
  const [order, setOrder] = useState(null); // codes while reordering by hand
  const rows = order ? order.map((code) => pool.rows.find((row) => row.iiitCode === code)) : pool.rows;
  const moveRow = (index, delta) => {
    const next = order.slice();
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setOrder(next);
  };

  return (
    <section className="rounded-card border border-line bg-white" aria-labelledby={`t${t.id}-st-${pool.pool}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3 id={`t${t.id}-st-${pool.pool}`} className="font-display text-base font-bold uppercase tracking-wide text-ink">
          Pool {pool.pool} {pool.manual && <span className="chip chip-gold ml-1 normal-case">Order set by hand</span>}
        </h3>
        <p className="meta">{pool.played} of {pool.total} played</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
              <th scope="col" className="px-3 py-2">#</th>
              <th scope="col" className="px-2 py-2">IIIT</th>
              <th scope="col" className="px-2 py-2 text-center">P</th>
              <th scope="col" className="px-2 py-2 text-center">W</th>
              <th scope="col" className="px-2 py-2 text-center">D</th>
              <th scope="col" className="px-2 py-2 text-center">L</th>
              <th scope="col" className="px-2 py-2 text-center">+/−</th>
              <th scope="col" className="px-2 py-2 text-center">Pts</th>
              {order && <th scope="col" className="px-2 py-2"><span className="sr-only">Move</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.iiitCode} className={`border-t border-line ${index < t.qualifyPerPool ? "bg-green-wash" : ""}`}>
                <td className="px-3 py-2 text-ink-muted">{index + 1}</td>
                <th scope="row" className="px-2 py-2 text-left font-semibold text-ink">{row.iiitName}</th>
                <td className="px-2 py-2 text-center tabular-nums">{row.played}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.won}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.drawn}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.lost}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                <td className="px-2 py-2 text-center font-bold tabular-nums">{row.points}</td>
                {order && (
                  <td className="whitespace-nowrap px-2 py-1">
                    <button type="button" className="rounded px-2 py-1 font-bold disabled:opacity-30" aria-label={`Move ${row.iiitName} up`} disabled={index === 0} onClick={() => moveRow(index, -1)}>↑</button>
                    <button type="button" className="rounded px-2 py-1 font-bold disabled:opacity-30" aria-label={`Move ${row.iiitName} down`} disabled={index === rows.length - 1} onClick={() => moveRow(index, 1)}>↓</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line p-3">
        {order ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={async () => {
              if (await save(`/api/admin/live/tournaments/${t.id}/pool-order`, "PUT", { pool: pool.pool, order }, `Pool ${pool.pool} order saved`)) setOrder(null);
            }}>Save this order</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setOrder(null)}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-outline btn-sm" disabled={!pool.rows.length} onClick={() => setOrder(pool.rows.map((row) => row.iiitCode))}>Change order by hand</button>
            {pool.manual && (
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => save(`/api/admin/live/tournaments/${t.id}/pool-order`, "PUT", { pool: pool.pool, order: null }, `Pool ${pool.pool} uses the computed order again`)}>
                Use the computed order
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** Pool standings, computed from results; each pool's order can be set by hand. */
export default function Standings(props) {
  const t = props.detail.tournament;
  if (!props.detail.pools.length) return <p className="meta">Put teams into pools first.</p>;
  return (
    <div className="space-y-4">
      <p className="meta">
        Ranked by points (win {t.pointsWin}, draw {t.pointsDraw}, loss {t.pointsLoss}), then head-to-head between teams level on points, then score difference, then score.
        The top {t.qualifyPerPool} of each pool are highlighted. Set the order by hand for a toss, a walkover or a Sports Board decision.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {props.detail.pools.map((pool) => <PoolStanding key={`${pool.pool}-${t.version}`} pool={pool} {...props} />)}
      </div>
    </div>
  );
}
