"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { agoLabel, genderLabel } from "@/lib/live/format";
import FixturesView from "../FixturesView";
import BracketTree from "./BracketTree";
import PoolBoards, { MatchLogList } from "./PoolBoards";

const POLL_MS = 15_000;
const VIEWS = [
  { id: "bracket", label: "Bracket" },
  { id: "schedule", label: "Schedule" },
  { id: "list", label: "Match log" },
];

const control = "w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";
const titleOf = (t) => [t.sportName, genderLabel(t.gender), t.name].filter(Boolean).join(" · ");

/** Every stage in order, for the match log view. */
function stages(detail) {
  const list = detail.pools.map((pool) => ({ id: `pool-${pool.pool}`, title: `Pool ${pool.pool}`, matches: pool.matches }));
  for (const round of detail.knockout.rounds) list.push({ id: `round-${round.teams}`, title: round.name, matches: round.matches, knockout: true });
  if (detail.knockout.third) list.splice(list.length - 1, 0, { id: "third", title: "3rd place", matches: [detail.knockout.third], knockout: true });
  if (detail.others.length) list.push({ id: "others", title: "Other matches", matches: detail.others });
  return list.map((stage) => ({ ...stage, matches: stage.matches.filter((m) => m.status !== "cancelled") })).filter((stage) => stage.matches.length);
}

/**
 * Public brackets: choose a tournament, then see pools and the knockout tree,
 * the schedule, or the full match log. Polls while the tab is visible.
 */
export default function BracketsBoard({ initialTournament, initialView }) {
  const [tournamentId, setTournamentId] = useState(initialTournament);
  const [view, setView] = useState(initialView);
  const [highlight, setHighlight] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [lastOk, setLastOk] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const requestId = useRef(0);

  const load = useCallback(async (id) => {
    const current = ++requestId.current;
    try {
      const response = await fetch(`/api/live/brackets${id ? `?tournament=${id}` : ""}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to load the brackets");
      if (current !== requestId.current) return;
      setData(body.data);
      setError("");
      setLastOk(Date.now());
    } catch (err) {
      if (current !== requestId.current) return;
      setError(err instanceof TypeError ? "Reconnecting…" : err.message);
    }
  }, []);

  useEffect(() => {
    // load() only sets state after its request finishes.
    load(tournamentId); // eslint-disable-line react-hooks/set-state-in-effect
    let timer = setInterval(() => load(tournamentId), POLL_MS);
    const onVisibility = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") {
        load(tournamentId);
        timer = setInterval(() => load(tournamentId), POLL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tournamentId, load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const updateUrl = (id, nextView) => {
    const query = new URLSearchParams();
    if (id) query.set("t", String(id));
    if (nextView !== "bracket") query.set("view", nextView);
    const text = query.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${text ? `?${text}` : ""}`);
  };

  const detail = data?.detail;
  const shownId = detail?.tournament.id ?? null;
  const visibleMatches = detail ? detail.matches.filter((m) => m.status !== "cancelled") : [];
  const teams = detail ? detail.teams.slice().sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {data?.hasSample && (
        <div role="note" className="mb-6 rounded-card border border-amber-300 bg-gold-wash px-4 py-3 text-sm text-ink">
          <strong className="font-semibold">Sample data.</strong> These brackets show how the page will look. The official draw is coming soon.
        </div>
      )}

      {data && data.tournaments.length === 0 && (
        <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">
          Brackets will appear here once the draw is made. Meanwhile, follow the <Link href="/live" className="font-semibold text-brand-primary underline underline-offset-2">live board</Link>.
        </p>
      )}

      {data && data.tournaments.length > 0 && (
        <form className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5" onSubmit={(e) => e.preventDefault()} aria-label="Choose a tournament">
          <div>
            <label htmlFor="br-tournament" className="mb-1.5 block text-sm font-semibold text-ink">Sport</label>
            <select id="br-tournament" className={control} value={shownId ?? ""} onChange={(e) => {
              const id = Number(e.target.value);
              setTournamentId(id);
              setHighlight("");
              updateUrl(id, view);
            }}>
              {data.tournaments.map((t) => <option key={t.id} value={t.id}>{titleOf(t)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="br-iiit" className="mb-1.5 block text-sm font-semibold text-ink">Follow an IIIT</label>
            <select id="br-iiit" className={control} value={highlight} onChange={(e) => setHighlight(e.target.value)} disabled={!teams.length}>
              <option value="">All IIITs</option>
              {teams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}
            </select>
          </div>
        </form>
      )}

      <p className="meta mb-6 flex flex-wrap items-center gap-x-3 gap-y-1" role="status" aria-live="polite">
        {error ? (
          <span className="font-semibold text-red-700">{error}</span>
        ) : lastOk ? (
          <span className="inline-flex items-center gap-1.5 text-brand-primary"><span className="live-dot" aria-hidden="true" /> Updating automatically</span>
        ) : (
          <span>Loading brackets…</span>
        )}
        {lastOk && <span>Last updated {agoLabel(new Date(lastOk).toISOString(), now)}</span>}
        <Link href="/live" className="font-semibold text-brand-primary underline underline-offset-2">Live board</Link>
      </p>

      {detail && (
        <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-line">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Views">
              {VIEWS.map((item) => (
                <button
                  key={item.id} type="button" role="tab" aria-selected={view === item.id}
                  className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 font-display text-base font-bold uppercase tracking-wide ${view === item.id ? "border-brand-primary text-brand-primary" : "border-transparent text-ink-muted hover:text-ink"}`}
                  onClick={() => { setView(item.id); updateUrl(shownId, item.id); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <h2 className="pb-2 font-display text-lg font-bold uppercase tracking-wide text-ink">{titleOf(detail.tournament)}</h2>
          </div>

          {view === "bracket" && (
            <div className="space-y-12">
              {detail.pools.length > 0 && (
                <section aria-labelledby="br-pools">
                  <h2 id="br-pools" className="heading-section mb-4 text-[1.75rem] sm:text-[2rem]">Pool stage</h2>
                  <PoolBoards pools={detail.pools} tournament={detail.tournament} highlight={highlight} />
                </section>
              )}
              <section aria-labelledby="br-knockout">
                <h2 id="br-knockout" className="heading-section mb-4 text-[1.75rem] sm:text-[2rem]">Knockout</h2>
                <BracketTree knockout={detail.knockout} champion={detail.champion} highlight={highlight} />
              </section>
            </div>
          )}

          {view === "schedule" && (
            <FixturesView matches={highlight ? visibleMatches.filter((m) => m.sideA?.code === highlight || m.sideB?.code === highlight) : visibleMatches} />
          )}

          {view === "list" && (
            <div className="space-y-6">
              {stages(detail).length === 0 && <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">No matches yet.</p>}
              {stages(detail).map((stage) => (
                <section key={stage.id} aria-labelledby={`br-${stage.id}`} className="card overflow-hidden">
                  <h3 id={`br-${stage.id}`} className="border-b border-line px-4 py-3 font-display text-lg font-bold uppercase tracking-wide text-ink">{stage.title}</h3>
                  <MatchLogList matches={stage.matches} highlight={highlight} />
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
