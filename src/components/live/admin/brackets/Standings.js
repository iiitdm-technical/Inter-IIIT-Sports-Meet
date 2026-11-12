"use client";

import { useState } from "react";

const counter = "h-9 w-14 rounded-control border border-line bg-white text-center text-sm tabular-nums";

/** Number input that keeps 0–99. */
function Tally({ id, label, value, onChange }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} type="number" inputMode="numeric" min={0} max={99} className={counter} value={value}
        onChange={(e) => onChange(Math.min(99, Math.max(0, Number.parseInt(e.target.value, 10) || 0)))} />
    </>
  );
}

/**
 * Edits a pool's wins, draws and losses by hand. Played and points follow
 * from them with the tournament's points. Saved as a correction on top of
 * the results, so matches finished later still count.
 */
function RecordsEditor({ pool, detail, save, busy, onDone }) {
  const t = detail.tournament;
  const [draft, setDraft] = useState(() => pool.rows.map((row) => ({ iiitCode: row.iiitCode, iiitName: row.iiitName, won: row.won, drawn: row.drawn, lost: row.lost, note: row.adjustment?.note || "", adjusted: Boolean(row.adjustment) })));
  const set = (code, key, value) => setDraft(draft.map((row) => (row.iiitCode === code ? { ...row, [key]: value } : row)));
  const pointsOf = (row) => row.won * t.pointsWin + row.drawn * t.pointsDraw + row.lost * t.pointsLoss;
  const prefix = `t${t.id}-rec-${pool.pool}`;

  const submit = async (teams, message) => {
    if (await save(`/api/admin/live/tournaments/${t.id}/pool-records`, "PUT", { pool: pool.pool, teams }, message)) onDone();
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
              <th scope="col" className="px-3 py-2">IIIT</th>
              <th scope="col" className="px-1 py-2 text-center">W</th>
              <th scope="col" className="px-1 py-2 text-center">D</th>
              <th scope="col" className="px-1 py-2 text-center">L</th>
              <th scope="col" className="px-2 py-2 text-center">P</th>
              <th scope="col" className="px-2 py-2 text-center">Pts</th>
              <th scope="col" className="px-2 py-2">Reason (shown publicly)</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row) => (
              <tr key={row.iiitCode} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left font-semibold text-ink">{row.iiitName}</th>
                <td className="px-1 py-1.5 text-center"><Tally id={`${prefix}-${row.iiitCode}-w`} label={`${row.iiitName} wins`} value={row.won} onChange={(v) => set(row.iiitCode, "won", v)} /></td>
                <td className="px-1 py-1.5 text-center"><Tally id={`${prefix}-${row.iiitCode}-d`} label={`${row.iiitName} draws`} value={row.drawn} onChange={(v) => set(row.iiitCode, "drawn", v)} /></td>
                <td className="px-1 py-1.5 text-center"><Tally id={`${prefix}-${row.iiitCode}-l`} label={`${row.iiitName} losses`} value={row.lost} onChange={(v) => set(row.iiitCode, "lost", v)} /></td>
                <td className="px-2 py-2 text-center tabular-nums">{row.won + row.drawn + row.lost}</td>
                <td className="px-2 py-2 text-center font-bold tabular-nums">{pointsOf(row)}</td>
                <td className="px-2 py-1.5">
                  <label htmlFor={`${prefix}-${row.iiitCode}-note`} className="sr-only">Reason for {row.iiitName}</label>
                  <input id={`${prefix}-${row.iiitCode}-note`} className="h-9 w-full min-w-[10rem] rounded-control border border-line bg-white px-2 text-sm" maxLength={255} value={row.note} placeholder="e.g. Walkover v IIIT Una" onChange={(e) => set(row.iiitCode, "note", e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta px-3 pt-2">Points follow the tournament&apos;s settings (win {t.pointsWin}, draw {t.pointsDraw}, loss {t.pointsLoss}). The change is kept as a correction: results finished later still add on top.</p>
      <div className="flex flex-wrap gap-2 p-3">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => submit(draft.map(({ iiitCode, won, drawn, lost, note }) => ({ iiitCode, won, drawn, lost, note: note.trim() })), `Pool ${pool.pool} table saved`)}>Save table</button>
        {draft.some((row) => row.adjusted) && (
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => {
            if (window.confirm(`Remove every hand correction in Pool ${pool.pool}? The table goes back to the results.`)) submit(draft.map(({ iiitCode }) => ({ iiitCode, reset: true })), `Pool ${pool.pool} table reset to the results`);
          }}>Reset to the results</button>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function PoolStanding({ pool, detail, save, busy }) {
  const t = detail.tournament;
  const [order, setOrder] = useState(null); // codes while reordering by hand
  const [editingRecords, setEditingRecords] = useState(false);
  const rows = order ? order.map((code) => pool.rows.find((row) => row.iiitCode === code)) : pool.rows;
  const moveRow = (index, delta) => {
    const next = order.slice();
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setOrder(next);
  };

  return (
    <section className={`rounded-card border border-line bg-white ${editingRecords ? "lg:col-span-2" : ""}`} aria-labelledby={`t${t.id}-st-${pool.pool}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3 id={`t${t.id}-st-${pool.pool}`} className="font-display text-base font-bold uppercase tracking-wide text-ink">
          Pool {pool.pool} {pool.manual && <span className="chip chip-gold ml-1 normal-case">Order set by hand</span>}
          {pool.rows.some((row) => row.adjustment) && <span className="chip chip-gold ml-1 normal-case">Table corrected by hand</span>}
        </h3>
        <p className="meta">{pool.played} of {pool.total} played</p>
      </div>
      {editingRecords ? (
        <RecordsEditor pool={pool} detail={detail} save={save} busy={busy} onDone={() => setEditingRecords(false)} />
      ) : (
      <>
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
                <th scope="row" className="px-2 py-2 text-left font-semibold text-ink">
                  {row.iiitName}
                  {row.adjustment && <span className="ml-1 text-gold-text" title={`Corrected by hand${row.adjustment.note ? `: ${row.adjustment.note}` : ""}`}>*</span>}
                </th>
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
            <button type="button" className="btn btn-outline btn-sm" disabled={!pool.rows.length} onClick={() => setEditingRecords(true)}>Edit wins, draws, losses</button>
            <button type="button" className="btn btn-outline btn-sm" disabled={!pool.rows.length} onClick={() => setOrder(pool.rows.map((row) => row.iiitCode))}>Change order by hand</button>
            {pool.manual && (
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => save(`/api/admin/live/tournaments/${t.id}/pool-order`, "PUT", { pool: pool.pool, order: null }, `Pool ${pool.pool} uses the computed order again`)}>
                Use the computed order
              </button>
            )}
          </>
        )}
      </div>
      {pool.rows.some((row) => row.adjustment) && (
        <ul className="meta border-t border-line px-3 py-2">
          {pool.rows.filter((row) => row.adjustment).map((row) => (
            <li key={row.iiitCode}>* {row.iiitName}: {[["W", row.adjustment.won], ["D", row.adjustment.drawn], ["L", row.adjustment.lost]].filter(([, v]) => v).map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`).join(", ")} by hand{row.adjustment.note ? ` (${row.adjustment.note})` : ""}</li>
          ))}
        </ul>
      )}
      </>
      )}
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
        The top {t.qualifyPerPool} of each pool are highlighted. For a walkover or a Sports Board decision, edit a team&apos;s wins, draws and losses (points follow), or set the order by hand.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {props.detail.pools.map((pool) => <PoolStanding key={`${pool.pool}-${t.version}`} pool={pool} {...props} />)}
      </div>
    </div>
  );
}
