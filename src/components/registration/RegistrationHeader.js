"use client";

import Link from "next/link";
import { GLOBAL_RULES } from "@/lib/sports/config";

export default function RegistrationHeader({ iiitName, uniqueStudentsCount, lastSaved, saveFailed, onLogout, isLoggingOut }) {
  const isOverLimit = uniqueStudentsCount > GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT;
  const savedTime = lastSaved?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="shrink-0 rounded text-xs font-bold text-[#1b5e20] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">
            <span aria-hidden="true">←</span> Home
          </Link>
          <div className="flex flex-col min-w-0 border-l border-gray-200 pl-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#8a6514]">Contingent Registration</span>
            <h1 className="font-bold text-[#0a2112] truncate text-sm sm:text-base max-w-[38vw] sm:max-w-[200px] md:max-w-sm"><span className="sr-only">Contingent registration for </span>{iiitName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {saveFailed ? (
              <span className="text-amber-700 font-bold">Not saved</span>
            ) : savedTime ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-500"><span className="sm:hidden">Saved</span><span className="hidden sm:inline">Saved to cloud at {savedTime}</span></span>
              </>
            ) : (
              <span className="text-gray-600">Saving…</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500"><span className="sm:hidden">Students</span><span className="hidden sm:inline">Unique Students</span></span>
              <div className="flex items-baseline gap-1">
                <span className={`font-black text-lg ${isOverLimit ? 'text-red-600' : 'text-[#1b5e20]'}`}>
                  {uniqueStudentsCount}
                </span>
                <span className="text-xs font-bold text-gray-500">/ {GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT}</span>
              </div>
            </div>

            {/* Small progress circle indicator */}
            <div className="relative w-10 h-10 hidden sm:flex items-center justify-center" aria-hidden="true">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-100" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className={isOverLimit ? "stroke-red-500" : "stroke-[#1b5e20]"}
                  strokeWidth="4"
                  strokeDasharray="100"
                  strokeDashoffset={Math.max(0, 100 - (uniqueStudentsCount / GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT) * 100)}
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut}
                aria-label={isLoggingOut ? "Logging out" : "Log out"}
                className="ml-1 sm:ml-2 text-xs font-bold text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 border border-gray-200 rounded-lg px-2.5 py-2 hover:border-red-200 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline" aria-hidden="true">{isLoggingOut ? "Logging out…" : "Log out"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
