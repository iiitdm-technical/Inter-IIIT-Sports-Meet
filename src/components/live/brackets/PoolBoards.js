import { formatWhen } from "@/lib/live/format";

/** Compact list of one pool's matches (the match log under its table). */
export function MatchLogList({ matches, highlight }) {
  if (!matches.length) return <p className="px-4 py-3 text-sm text-ink-muted">No matches yet.</p>;
  return (
    <ol className="divide-y divide-line">
      {matches.map((match) => {
        const played = match.status === "completed" || match.status === "live";
        const mine = highlight && (match.sideA?.code === highlight || match.sideB?.code === highlight);
        return (
          <li key={match.id} className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-2 text-sm ${mine ? "bg-gold-wash" : ""}`}>
            <span className={`min-w-0 truncate text-right ${match.winner === match.sideA?.code ? "font-bold text-ink" : "text-ink-soft"}`}>{match.sideA?.name || match.placeholderA || "TBD"}</span>
            <span className="min-w-[4.5rem] text-center">
              {match.status === "live" && <span className="mr-1 inline-block align-middle"><span className="live-dot" aria-hidden="true" /><span className="sr-only">Live</span></span>}
              {played
                ? <strong className="font-display text-base tabular-nums text-ink">{match.scoreA ?? 0} – {match.scoreB ?? 0}</strong>
                : <span className="text-xs text-ink-muted">{match.scheduledAt ? formatWhen(match.scheduledAt) : "TBA"}</span>}
            </span>
            <span className={`min-w-0 truncate ${match.winner === match.sideB?.code ? "font-bold text-ink" : "text-ink-soft"}`}>{match.sideB?.name || match.placeholderB || "TBD"}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** One leaderboard and match log per pool; qualifying places are marked. */
export default function PoolBoards({ pools, tournament, highlight }) {
  if (!pools.length) return <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">Pools will appear here once the draw is made.</p>;
  return (
    <div>
      <p className="meta mb-4">
        Win {tournament.pointsWin} · {tournament.allowDraws ? `Draw ${tournament.pointsDraw}` : "No draws"} · Loss {tournament.pointsLoss} points.
        Ties: head-to-head, then score difference, then score. {tournament.qualifyPerPool > 0 && <>The top {tournament.qualifyPerPool} of each pool <span className="font-semibold text-brand-primary">(Q)</span> go through.</>}
      </p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {pools.map((pool) => {
          const id = `pool-${tournament.id}-${pool.pool}`;
          return (
            <section key={pool.pool} aria-labelledby={id} className="card overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                <h3 id={id} className="font-display text-lg font-bold uppercase tracking-wide text-ink">Pool {pool.pool}</h3>
                <p className="meta">{pool.played} of {pool.total} played{pool.manual ? " · order set by the Sports Board" : ""}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-sm">
                  <caption className="sr-only">Pool {pool.pool} standings</caption>
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                      <th scope="col" className="px-4 py-2">#</th>
                      <th scope="col" className="px-2 py-2">IIIT</th>
                      <th scope="col" className="px-2 py-2 text-center"><abbr title="Played" className="no-underline">P</abbr></th>
                      <th scope="col" className="px-2 py-2 text-center"><abbr title="Won" className="no-underline">W</abbr></th>
                      <th scope="col" className="px-2 py-2 text-center"><abbr title="Drawn" className="no-underline">D</abbr></th>
                      <th scope="col" className="px-2 py-2 text-center"><abbr title="Lost" className="no-underline">L</abbr></th>
                      <th scope="col" className="px-2 py-2 text-center"><abbr title="Score difference" className="no-underline">+/−</abbr></th>
                      <th scope="col" className="px-4 py-2 text-center"><abbr title="Points" className="no-underline">Pts</abbr></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.rows.map((row) => (
                      <tr key={row.iiitCode} className={`border-t border-line ${row.iiitCode === highlight ? "bg-gold-wash" : row.qualifies ? "bg-green-wash/60" : ""}`}>
                        <td className="px-4 py-2.5 text-ink-muted">{row.rank}</td>
                        <th scope="row" className="px-2 py-2.5 text-left font-semibold text-ink">
                          {row.iiitName}
                          {row.adjustment && <span className="ml-1 text-gold-text" title="Corrected by the Sports Board">*</span>}
                          {row.qualifies && <span className="ml-1.5 text-xs font-bold text-brand-primary" title="Qualifies">Q</span>}
                        </th>
                        <td className="px-2 py-2.5 text-center tabular-nums">{row.played}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{row.won}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{row.drawn}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{row.lost}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                        <td className="px-4 py-2.5 text-center font-bold tabular-nums text-ink">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pool.rows.some((row) => row.adjustment) && (
                <ul className="meta border-t border-line px-4 py-2">
                  {pool.rows.filter((row) => row.adjustment).map((row) => (
                    <li key={row.iiitCode}>* {row.iiitName}: record corrected by the Sports Board{row.adjustment.note ? ` (${row.adjustment.note})` : ""}.</li>
                  ))}
                </ul>
              )}
              <details className="group border-t border-line">
                <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold text-brand-primary">
                  <span className="group-open:hidden">Show matches ({pool.matches.filter((m) => m.status !== "cancelled").length})</span>
                  <span className="hidden group-open:inline">Hide matches</span>
                </summary>
                <MatchLogList matches={pool.matches.filter((m) => m.status !== "cancelled")} highlight={highlight} />
              </details>
            </section>
          );
        })}
      </div>
    </div>
  );
}
