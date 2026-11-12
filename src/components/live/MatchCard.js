import { agoLabel, formatWhen, genderLabel, matchTitle, ordinal, stageLabel } from "@/lib/live/format";

/** One fixture on the public board: score card for team matches, placings for events. */

function StatusChip({ match }) {
  if (match.status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
        <span className="live-dot" aria-hidden="true" /> Live
      </span>
    );
  }
  if (match.status === "completed") return <span className="chip">Final</span>;
  if (match.status === "postponed") return <span className="chip chip-gold">Postponed</span>;
  return <span className="chip">{match.scheduledAt ? formatWhen(match.scheduledAt) : "Time TBA"}</span>;
}

function Side({ side, score, isWinner, showScore }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${isWinner ? "font-bold text-ink" : "text-ink-soft"}`}>
      <span className="min-w-0 break-words">
        {side?.name || "To be decided"}
        {isWinner && <span className="sr-only"> (winner)</span>}
      </span>
      {showScore && <span className="stat-number shrink-0 text-3xl tabular-nums text-ink">{score ?? 0}</span>}
    </div>
  );
}

function Placings({ placings, limit }) {
  if (!placings.length) return <p className="meta mt-3">Results will appear here.</p>;
  return (
    <ol className="mt-3 space-y-1.5 text-sm">
      {placings.slice(0, limit).map((p) => (
        <li key={p.position} className="flex items-baseline gap-3">
          <span className={`w-9 shrink-0 font-display font-bold ${p.position <= 3 ? "text-gold-text" : "text-ink-muted"}`}>{ordinal(p.position)}</span>
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-ink">{p.iiitName}</span>
            {p.athlete && <span className="text-ink-soft"> · {p.athlete}</span>}
          </span>
          {p.mark && <span className="shrink-0 tabular-nums text-ink-soft">{p.mark}</span>}
        </li>
      ))}
    </ol>
  );
}

export default function MatchCard({ match, now }) {
  const isVersus = match.kind === "versus";
  const showScore = isVersus && (match.status === "live" || match.status === "completed");
  const isLive = match.status === "live";
  return (
    <article className={`card p-4 sm:p-5 ${isLive ? "ring-2 ring-red-600/70" : ""}`} aria-label={`${matchTitle(match)}${match.round ? `, ${match.round}` : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold uppercase tracking-wide text-brand-primary">{match.sportName}</p>
          <p className="meta">
            {[genderLabel(match.gender), match.eventName, stageLabel(match)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusChip match={match} />
      </div>

      {isVersus ? (
        <div className="mt-3 space-y-1.5">
          <Side side={match.sideA} score={match.scoreA} showScore={showScore} isWinner={match.status === "completed" && match.winner === match.sideA?.code} />
          <Side side={match.sideB} score={match.scoreB} showScore={showScore} isWinner={match.status === "completed" && match.winner === match.sideB?.code} />
        </div>
      ) : (
        (match.status === "live" || match.status === "completed") && <Placings placings={match.placings} limit={match.status === "completed" ? 4 : 8} />
      )}

      {match.scoreDetail && <p className="mt-2 text-sm text-ink-soft">{match.scoreDetail}</p>}
      {match.status === "completed" && match.winner === "draw" && <p className="mt-2 text-sm font-semibold text-ink">Match drawn</p>}
      {match.resultNote && <p className="mt-1 text-sm font-semibold text-ink">{match.resultNote}</p>}

      <p className="meta mt-3">
        {[match.venue, isLive && match.updatedAt ? `Updated ${agoLabel(match.updatedAt, now)}` : null, match.status === "completed" ? formatWhen(match.scheduledAt) : null]
          .filter(Boolean).join(" · ")}
      </p>
    </article>
  );
}
