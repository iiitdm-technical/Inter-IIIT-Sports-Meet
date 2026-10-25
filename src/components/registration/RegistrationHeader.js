"use client";

import Link from "next/link";
import { GLOBAL_RULES } from "@/lib/sports/config";

export default function RegistrationHeader({ iiitName, uniqueStudentsCount, lastSaved, hasUnsyncedChanges, saveFailed, onLogout, isLoggingOut }) {
  const limit = GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT;
  const isOverLimit = uniqueStudentsCount > limit;
  const savedTime = lastSaved?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fill = Math.min(100, (uniqueStudentsCount / limit) * 100);

  return (
    <header className="sticky top-0 z-40 bg-brand-dark text-white shadow-[0_8px_24px_-16px_rgb(10_33_18/0.6)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/" className="shrink-0 rounded text-sm font-semibold text-brand-highlight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-highlight">
            <span aria-hidden="true">←</span> Home
          </Link>
          <div className="flex min-w-0 flex-col border-l border-white/20 pl-3 sm:pl-4">
            <span className="hidden font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#e6c46a] sm:block">Contingent registration</span>
            <h1 className="max-w-[34vw] truncate font-display text-lg font-bold uppercase leading-tight tracking-wide text-white sm:max-w-[220px] sm:text-xl md:max-w-sm"><span className="sr-only">Contingent registration for </span>{iiitName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {saveFailed ? (
              <span className="rounded-full bg-amber-400/20 px-2 py-1 font-bold text-amber-200">Not saved</span>
            ) : savedTime ? (
              <>
                <svg className="h-3.5 w-3.5 text-[#9fd6a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/80"><span className="sm:hidden">Saved</span><span className="hidden sm:inline">Saved at {savedTime}</span></span>
              </>
            ) : hasUnsyncedChanges ? (
              <span className="text-white/75">Saving…</span>
            ) : (
              <span className="text-white/75">Saves automatically</span>
            )}
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75"><span className="sm:hidden">Students</span><span className="hidden sm:inline">Unique students</span></span>
            <div className="flex items-baseline gap-1">
              <span className={`stat-number text-2xl ${isOverLimit ? 'text-red-300' : 'text-brand-highlight'}`}>
                {uniqueStudentsCount}
              </span>
              <span className="font-display text-sm font-semibold text-white/70">/ {limit}</span>
            </div>
            <span className="mt-1 hidden h-1 w-24 overflow-hidden rounded-full bg-white/15 sm:block" aria-hidden="true">
              <span className={`block h-full rounded-full ${isOverLimit ? 'bg-red-400' : 'bg-brand-highlight'}`} style={{ width: `${fill}%` }} />
            </span>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Logging out" : "Log out"}
              className="btn btn-on-dark btn-sm px-2.5 sm:px-3.5"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline" aria-hidden="true">{isLoggingOut ? "Logging out…" : "Log out"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
