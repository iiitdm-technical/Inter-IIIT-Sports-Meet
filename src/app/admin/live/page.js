"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MatchPanel from "@/components/live/admin/MatchPanel";
import ScheduleForm from "@/components/live/admin/ScheduleForm";
import CoordinatorsPanel from "@/components/live/admin/CoordinatorsPanel";
import { fieldControl, fieldLabel, liveApi } from "@/components/live/admin/api";
import { genderLabel } from "@/lib/live/format";

const VIEWS = [
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Finished" },
  { id: "all", label: "All" },
];

function inView(match, view) {
  if (view === "live") return match.status === "live";
  if (view === "upcoming") return match.status === "scheduled" || match.status === "postponed";
  if (view === "completed") return match.status === "completed";
  return true;
}

/**
 * Live results management. Coordinators see and score only their sports;
 * the Sports SAC also schedules matches, manages coordinators and sample data.
 */
export default function LiveAdminPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("matches");
  const [view, setView] = useState(null);
  const [sportFilter, setSportFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    const result = await liveApi("/api/admin/live/matches");
    if (result.status === 401 || result.status === 403) {
      router.push("/login");
      return;
    }
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setLoadError("");
    setData(result.data);
    setView((current) => current || (result.data.matches.some((m) => m.status === "live") ? "live" : "upcoming"));
  }, [router]);

  // load() only sets state after its request finishes.
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  // Picks up changes made on other devices while this screen is open.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const onChanged = useCallback((updated, removedId) => {
    setData((current) => {
      if (!current) return current;
      const matches = removedId
        ? current.matches.filter((m) => m.id !== removedId)
        : current.matches.map((m) => (m.id === updated.id ? updated : m));
      return { ...current, matches };
    });
  }, []);

  const onConflict = useCallback(() => { load(); }, [load]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Signing out locally still sends the user to the login page.
    }
    router.push("/login");
  };

  const sample = async (method) => {
    const message = method === "POST"
      ? "Replace the sample matches with a fresh set timed around now? Real matches are not touched."
      : "Remove every sample match from the board? Real matches are not touched.";
    if (!window.confirm(message)) return;
    setBusy(true);
    const result = await liveApi("/api/admin/live/sample", { method });
    setBusy(false);
    if (!result.ok) return setLoadError(result.error);
    setNotice(method === "POST" ? `${result.data.added} sample matches added` : `${result.data.removed} sample matches removed`);
    load();
  };

  const sportsInScope = useMemo(() => {
    if (!data) return [];
    if (data.isSuper) return data.sports;
    const ids = new Set(data.scope.map((item) => item.sportId));
    return data.sports.filter((sport) => ids.has(sport.id));
  }, [data]);

  const visible = useMemo(() => {
    if (!data || !view) return [];
    const list = data.matches.filter((m) => inView(m, view) && (!sportFilter || m.sportId === sportFilter));
    return view === "completed" ? list.slice().reverse() : list;
  }, [data, view, sportFilter]);

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((item) => [item.id, data ? data.matches.filter((m) => inView(m, item.id) && (!sportFilter || m.sportId === sportFilter)).length : 0])), [data, sportFilter]);
  const hasSample = data?.matches.some((m) => m.isSample);

  const tabs = data?.isSuper
    ? [{ id: "matches", label: "Matches" }, { id: "schedule", label: "Schedule a match" }, { id: "coordinators", label: "Coordinators" }]
    : [];

  return (
    <div className="min-h-screen bg-ivory pb-16">
      <header className="bg-brand-dark text-white">
        <div className="mx-auto flex min-h-[72px] max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/live" className="shrink-0 rounded text-sm font-semibold text-brand-highlight underline-offset-4 hover:underline">
              <span aria-hidden="true">←</span> Public board
            </Link>
            <div className="min-w-0 border-l border-white/20 pl-3">
              <span className="block font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#e6c46a]" aria-hidden="true">
                {data?.isSuper ? "Sports SAC" : "Coordinator"}
              </span>
              <h1 className="truncate font-display text-xl font-bold uppercase leading-tight tracking-wide text-white">Live Results</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {data?.isSuper && <Link href="/admin" className="btn btn-on-dark btn-sm">Registrations</Link>}
            <button type="button" onClick={signOut} disabled={signingOut} className="btn btn-on-dark btn-sm whitespace-nowrap">
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {data && (
          <p className="meta mb-4">
            Signed in as <strong className="font-semibold text-ink">{data.user.displayName || data.user.username}</strong>
            {!data.isSuper && data.scope.length > 0 && (
              <> · You can update {data.scope.map((item) => `${data.sports.find((s) => s.id === item.sportId)?.name || item.sportId}${item.gender !== "all" ? ` (${genderLabel(item.gender)})` : ""}`).join(", ")}</>
            )}
          </p>
        )}

        {loadError && <div role="alert" className="mb-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{loadError}</div>}
        <div role="status" aria-live="polite" className={notice ? "mb-4 rounded-card border border-green-200 bg-green-wash px-4 py-3 text-sm font-semibold text-brand-primary" : "sr-only"}>{notice}</div>

        {!data && !loadError && <p className="meta">Loading…</p>}

        {data && tabs.length > 0 && (
          <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Live results sections">
            {tabs.map((item) => (
              <button
                key={item.id} type="button" role="tab" aria-selected={tab === item.id}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === item.id ? "border-brand-primary text-brand-primary" : "border-transparent text-ink-muted hover:text-ink"}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {data && tab === "matches" && (
          <>
            {data.isSuper && (
              <div className="card-tint mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card p-3 text-sm">
                <p className="text-ink-soft">
                  {hasSample ? "Sample matches are on the public board, with a “sample data” banner." : "No sample matches on the board."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => sample("POST")}>{hasSample ? "Refresh sample matches" : "Add sample matches"}</button>
                  {hasSample && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => sample("DELETE")}>Clear sample matches</button>}
                </div>
              </div>
            )}

            {!data.isSuper && data.scope.length === 0 ? (
              <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">No sports are assigned to you yet. Ask the Sports SAC to add them.</p>
            ) : (
              <>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show matches">
                    {VIEWS.map((item) => (
                      <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)}
                        className={`rounded-full px-3.5 py-2 text-sm font-semibold ${view === item.id ? "bg-brand-primary text-white" : "bg-white text-ink ring-1 ring-line"}`}>
                        {item.label} <span className="tabular-nums opacity-80">{counts[item.id]}</span>
                      </button>
                    ))}
                  </div>
                  {sportsInScope.length > 1 && (
                    <div className="sm:w-56">
                      <label htmlFor="admin-live-sport" className={fieldLabel}>Sport</label>
                      <select id="admin-live-sport" className={fieldControl} value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}>
                        <option value="">All my sports</option>
                        {sportsInScope.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {visible.length === 0 ? (
                  <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">
                    {view === "live" ? "No match is live. Start one from Upcoming." : "No matches here."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {visible.map((match) => (
                      <MatchPanel
                        key={match.id} match={match} isSuper={data.isSuper}
                        sports={data.sports} iiits={data.iiits} rounds={data.rounds} pools={data.pools}
                        onChanged={onChanged} onConflict={onConflict} onNotice={setNotice}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {data?.isSuper && tab === "schedule" && (
          <section className="card p-4 sm:p-5" aria-labelledby="schedule-title">
            <h2 id="schedule-title" className="heading-card mb-4">Schedule a match</h2>
            <ScheduleForm
              sports={data.sports} iiits={data.iiits} rounds={data.rounds} pools={data.pools}
              onSaved={() => { setNotice("Match added to the schedule"); load(); }}
            />
          </section>
        )}

        {data?.isSuper && tab === "coordinators" && <CoordinatorsPanel sports={data.sports} onNotice={setNotice} />}
      </main>
    </div>
  );
}
