import { Trophy } from "lucide-react";
import { formatWhen } from "@/lib/live/format";

/**
 * The knockout as a tree: one column per round, each match centred between
 * the two matches that feed it, joined by lines. Scrolls sideways on phones.
 */

function Side({ side, placeholder, score, showScore, isWinner, isBye, highlight }) {
  const name = side?.name || (isBye ? "Bye" : placeholder || "To be decided");
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-1.5 ${isWinner ? "bg-green-wash" : ""} ${side?.code && side.code === highlight ? "ring-1 ring-inset ring-amber-400" : ""}`}>
      <span className={`min-w-0 truncate text-sm ${isWinner ? "font-bold text-ink" : side ? "text-ink-soft" : "italic text-ink-muted"}`} title={name}>
        {name}
        {isWinner && <span className="sr-only"> (winner)</span>}
      </span>
      {showScore && <span className="shrink-0 font-display text-base font-bold tabular-nums text-ink">{score ?? 0}</span>}
    </div>
  );
}

export function BracketMatch({ match, highlight }) {
  const showScore = match.status === "live" || match.status === "completed";
  const when = match.isBye ? "" : match.status === "live" ? "Live" : match.scheduledAt ? formatWhen(match.scheduledAt) : "Time TBA";
  return (
    <div className={`w-full overflow-hidden rounded-card border bg-white shadow-sm ${match.status === "live" ? "border-red-500 ring-2 ring-red-500/40" : "border-line"} ${match.isBye ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-ivory px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        <span>{match.bracketSlot === "3P" ? "3rd place" : match.bracketSlot}</span>
        <span className={match.status === "live" ? "inline-flex items-center gap-1 text-red-700" : "truncate normal-case tracking-normal"}>
          {match.status === "live" && <span className="live-dot" aria-hidden="true" />}
          {when}{match.venue && !match.isBye && match.status !== "live" ? ` · ${match.venue}` : ""}
        </span>
      </div>
      <Side side={match.sideA} placeholder={match.placeholderA} score={match.scoreA} showScore={showScore} isWinner={match.status === "completed" && match.winner === match.sideA?.code} isBye={match.isBye} highlight={highlight} />
      <div className="border-t border-line" />
      <Side side={match.sideB} placeholder={match.placeholderB} score={match.scoreB} showScore={showScore} isWinner={match.status === "completed" && match.winner === match.sideB?.code} isBye={match.isBye} highlight={highlight} />
      {match.resultNote && !match.isBye && <p className="border-t border-line px-3 py-1 text-xs text-ink-muted">{match.resultNote}</p>}
    </div>
  );
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export default function BracketTree({ knockout, champion, highlight }) {
  const { rounds, third } = knockout;
  if (!rounds.length) {
    return <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">The knockout bracket will appear here once the pool stage is over.</p>;
  }
  const last = rounds.length - 1;
  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" tabIndex={0} aria-label="Knockout bracket, scrolls sideways">
        <div className="flex min-w-max gap-8">
          {rounds.map((round, r) => (
            <section key={round.name} className="flex w-60 flex-col" aria-label={round.name}>
              <h3 className="mb-3 text-center font-display text-sm font-bold uppercase tracking-[0.12em] text-brand-primary">{round.name}</h3>
              <div className="flex flex-1 flex-col">
                {(r === last ? [round.matches] : chunk(round.matches, 2)).map((pair, p) => (
                  <div key={p} className="relative flex flex-1 flex-col">
                    {pair.map((match) => (
                      <div key={match.id} className="relative flex flex-1 items-center py-2">
                        {r > 0 && <span aria-hidden="true" className="absolute -left-4 top-1/2 w-4 border-t-2 border-line" />}
                        <BracketMatch match={match} highlight={highlight} />
                      </div>
                    ))}
                    {r < last && pair.length === 2 && (
                      <span aria-hidden="true" className="pointer-events-none absolute -right-4 top-1/4 bottom-1/4 w-4 rounded-r border-y-2 border-r-2 border-line" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
          <section className="flex w-48 flex-col" aria-label="Champion">
            <h3 className="mb-3 text-center font-display text-sm font-bold uppercase tracking-[0.12em] text-gold-text">Champion</h3>
            <div className="flex flex-1 items-center">
              <div className={`w-full rounded-card border-2 px-4 py-5 text-center ${champion ? "border-amber-400 bg-gold-wash" : "border-dashed border-line"}`}>
                <Trophy aria-hidden="true" className={`mx-auto h-8 w-8 ${champion ? "text-gold-text" : "text-ink-muted"}`} strokeWidth={1.75} />
                <p className={`mt-1 font-display text-lg font-bold uppercase leading-tight ${champion ? "text-ink" : "text-ink-muted"}`}>{champion ? champion.name : "To be decided"}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
      {third && (
        <div className="mt-6 max-w-xs">
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-brand-primary">3rd place</h3>
          <BracketMatch match={third} highlight={highlight} />
        </div>
      )}
    </div>
  );
}
