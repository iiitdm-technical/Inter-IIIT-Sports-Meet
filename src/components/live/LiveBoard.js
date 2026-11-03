"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MatchCard from "./MatchCard";
import { agoLabel } from "@/lib/live/format";

const POLL_MS = 10_000;
const GENDERS = [
  { value: "", label: "All categories" },
  { value: "M", label: "Men" },
  { value: "F", label: "Women" },
  { value: "mixed", label: "Mixed" },
];

const control = "w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

function Section({ id, title, count, children, empty }) {
  return (
    <section aria-labelledby={id} className="mt-10 first:mt-0">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 id={id} className="heading-section text-[1.75rem] sm:text-[2rem]">{title}</h2>
        {count > 0 && <span className="meta">{count}</span>}
      </div>
      {count > 0 ? children : <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">{empty}</p>}
    </section>
  );
}

function MedalTable({ medals }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <caption className="sr-only">Medal tally by IIIT</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
            <th scope="col" className="px-4 py-3">#</th>
            <th scope="col" className="px-4 py-3">IIIT</th>
            <th scope="col" className="px-3 py-3 text-center">Gold</th>
            <th scope="col" className="px-3 py-3 text-center">Silver</th>
            <th scope="col" className="px-3 py-3 text-center">Bronze</th>
            <th scope="col" className="px-4 py-3 text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {medals.map((row, index) => (
            <tr key={row.iiitCode} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 text-ink-muted">{index + 1}</td>
              <th scope="row" className="px-4 py-2.5 text-left font-semibold text-ink">{row.iiitName}</th>
              <td className="px-3 py-2.5 text-center tabular-nums">{row.gold}</td>
              <td className="px-3 py-2.5 text-center tabular-nums">{row.silver}</td>
              <td className="px-3 py-2.5 text-center tabular-nums">{row.bronze}</td>
              <td className="px-4 py-2.5 text-center font-semibold tabular-nums">{row.gold + row.silver + row.bronze}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The public board. Polls /api/live every 10 seconds while the tab is
 * visible, and straight away when it becomes visible again.
 */
export default function LiveBoard({ sports, iiits, initialFilters }) {
  const [filters, setFilters] = useState(initialFilters);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");
  const [lastOk, setLastOk] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const requestId = useRef(0);

  const load = useCallback(async (current) => {
    const id = ++requestId.current;
    const query = new URLSearchParams(Object.entries(current).filter(([, value]) => value)).toString();
    try {
      const response = await fetch(`/api/live${query ? `?${query}` : ""}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to load live results");
      if (id !== requestId.current) return; // a newer filter's answer wins
      setBoard(body.data);
      setError("");
      setLastOk(Date.now());
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof TypeError ? "Reconnecting…" : err.message);
    }
  }, []);

  useEffect(() => {
    // load() only sets state after its request finishes.
    load(filters); // eslint-disable-line react-hooks/set-state-in-effect
    let timer = null;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => load(filters), POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        load(filters);
        start();
      } else {
        clearInterval(timer);
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [filters, load]);

  // Keeps "updated 20 s ago" honest between polls.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const setFilter = (key, value) => {
    const next = { ...values, [key]: value };
    setFilters(next);
    const params = new URLSearchParams(Object.entries(next).filter(([, item]) => item));
    const url = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", url);
  };

  const values = filters;
  const filtered = values.sport || values.gender || values.iiit;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {board?.hasSample && (
        <div role="note" className="mb-6 rounded-card border border-amber-300 bg-gold-wash px-4 py-3 text-sm text-ink">
          <strong className="font-semibold">Sample data.</strong> These matches show how the board will look. The official schedule is coming soon.
        </div>
      )}

      <form className="card mb-8 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-5" onSubmit={(event) => event.preventDefault()} aria-label="Filter results">
        <div>
          <label htmlFor="live-sport" className="mb-1.5 block text-sm font-semibold text-ink">Sport</label>
          <select id="live-sport" className={control} value={values.sport} onChange={(event) => setFilter("sport", event.target.value)}>
            <option value="">All sports</option>
            {sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="live-gender" className="mb-1.5 block text-sm font-semibold text-ink">Category</label>
          <select id="live-gender" className={control} value={values.gender} onChange={(event) => setFilter("gender", event.target.value)}>
            {GENDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="live-iiit" className="mb-1.5 block text-sm font-semibold text-ink">Follow an IIIT</label>
          <select id="live-iiit" className={control} value={values.iiit} onChange={(event) => setFilter("iiit", event.target.value)}>
            <option value="">All IIITs</option>
            {iiits.map((iiit) => <option key={iiit.code} value={iiit.code}>{iiit.name}</option>)}
          </select>
        </div>
      </form>

      <p className="meta mb-6 flex flex-wrap items-center gap-x-3 gap-y-1" role="status" aria-live="polite">
        {error ? (
          <span className="font-semibold text-red-700">{error}</span>
        ) : lastOk ? (
          <span className="inline-flex items-center gap-1.5 text-brand-primary"><span className="live-dot" aria-hidden="true" /> Updating automatically</span>
        ) : (
          <span>Loading live results…</span>
        )}
        {lastOk && <span>Last updated {agoLabel(new Date(lastOk).toISOString(), now)}</span>}
        {filtered && (
          <button type="button" className="font-semibold text-brand-primary underline underline-offset-2" onClick={() => {
            setFilters({ sport: "", gender: "", iiit: "" });
            window.history.replaceState(null, "", window.location.pathname);
          }}>Clear filters</button>
        )}
      </p>

      {board && (
        <>
          <Section id="live-now" title="Live now" count={board.live.length} empty="No match is in progress right now.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {board.live.map((match) => <MatchCard key={match.id} match={match} now={now} />)}
            </div>
          </Section>

          <Section id="up-next" title="Up next" count={board.upcoming.length} empty={filtered ? "Nothing scheduled for this filter." : "The schedule will appear here."}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {board.upcoming.map((match) => <MatchCard key={match.id} match={match} now={now} />)}
            </div>
          </Section>

          <Section id="results" title="Results" count={board.results.length} empty="Finished matches will appear here.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {board.results.map((match) => <MatchCard key={match.id} match={match} now={now} />)}
            </div>
          </Section>

          <Section id="medals" title="Medal tally" count={board.medals.length} empty="Medals are counted from finals and 3rd-place matches once they finish.">
            <MedalTable medals={board.medals} />
            <p className="meta mt-2">From completed finals and 3rd-place matches. Championship points will be added once the Sports Board confirms the rules.</p>
          </Section>
        </>
      )}
    </div>
  );
}
