import { genderLabel } from "@/lib/live/format";

/** One table per sport, category and pool. */
export default function PoolTables({ pools, points, highlight }) {
  if (!pools.length) {
    return <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">Pool tables will appear here once the draw is made.</p>;
  }
  return (
    <div>
      <p className="meta mb-5">
        Win {points.win} · Draw {points.draw} · Loss {points.loss} points{points.confirmed ? "" : " (to be confirmed by the Sports Board)"}.
        Ties are split by score difference, then score.
      </p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {pools.map((group) => {
          const id = `pool-${group.sportId}-${group.gender}-${group.pool}`;
          return (
            <section key={id} aria-labelledby={id} className="card overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                <h2 id={id} className="font-display text-lg font-bold uppercase tracking-wide text-ink">
                  {group.sportName} · {genderLabel(group.gender)} · Pool {group.pool}
                </h2>
                <p className="meta">{group.played} of {group.total} played</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-sm">
                  <caption className="sr-only">{group.sportName} {genderLabel(group.gender)} Pool {group.pool} standings</caption>
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
                    {group.rows.map((row, index) => (
                      <tr key={row.iiitCode} className={`border-t border-line ${row.iiitCode === highlight ? "bg-gold-wash" : ""}`}>
                        <td className="px-4 py-2.5 text-ink-muted">{index + 1}</td>
                        <th scope="row" className="px-2 py-2.5 text-left font-semibold text-ink">
                          {row.iiitName}
                          {row.adjustment && <span className="ml-1 text-gold-text" title={`Corrected by the Sports Board${row.adjustment.note ? `: ${row.adjustment.note}` : ""}`}>*</span>}
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
