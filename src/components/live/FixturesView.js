import { formatDay, formatTime, genderLabel, stageLabel } from "@/lib/live/format";

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

function Result({ match }) {
  if (match.status === "live") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white"><span className="live-dot" aria-hidden="true" /> Live</span>;
  }
  if (match.status === "postponed") return <span className="chip chip-gold">Postponed</span>;
  if (match.status !== "completed") return null;
  if (match.kind === "event") {
    const first = match.placings.find((p) => p.position === 1);
    return <span className="text-sm text-ink-soft">{first ? <>Won by <strong className="text-ink">{first.iiitName}</strong></> : "Finished"}</span>;
  }
  return <span className="chip">{match.winner === "draw" ? "Draw" : "Final"}</span>;
}

function Sides({ match }) {
  if (match.kind === "event") return <p className="font-semibold text-ink">{match.eventName}</p>;
  const showScore = match.status === "live" || match.status === "completed";
  const line = (side, score) => (
    <span className={`flex items-baseline justify-between gap-3 ${match.status === "completed" && match.winner === side?.code ? "font-bold text-ink" : "text-ink-soft"}`}>
      <span className="min-w-0">{side?.name || "To be decided"}</span>
      {showScore && <span className="shrink-0 font-display text-lg font-bold tabular-nums text-ink">{score ?? 0}</span>}
    </span>
  );
  return (
    <div className="space-y-0.5">
      {line(match.sideA, match.scoreA)}
      {line(match.sideB, match.scoreB)}
    </div>
  );
}

/** The whole schedule, grouped by day (IST), in time order. */
export default function FixturesView({ matches }) {
  const days = [];
  for (const match of matches) {
    const key = dayKey.format(new Date(match.scheduledAt));
    if (days.at(-1)?.key !== key) days.push({ key, label: formatDay(match.scheduledAt), matches: [] });
    days.at(-1).matches.push(match);
  }
  if (!days.length) return <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">The schedule will appear here.</p>;
  return (
    <div className="space-y-8">
      {days.map((day) => (
        <section key={day.key} aria-labelledby={`day-${day.key}`}>
          <h2 id={`day-${day.key}`} className="heading-section mb-3 text-[1.5rem] sm:text-[1.75rem]">{day.label}</h2>
          <ol className="card divide-y divide-line">
            {day.matches.map((match) => (
              <li key={match.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 p-3 sm:grid-cols-[5.5rem_minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center sm:p-4">
                <p className="font-display text-sm font-bold text-ink sm:text-base">{formatTime(match.scheduledAt)}</p>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-brand-primary">{match.sportName}</p>
                  <p className="meta">{[genderLabel(match.gender), stageLabel(match), match.venue].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="col-start-2 min-w-0 sm:col-start-auto"><Sides match={match} /></div>
                <div className="col-start-2 sm:col-start-auto sm:justify-self-end"><Result match={match} /></div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
