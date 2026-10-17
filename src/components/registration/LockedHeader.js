"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Header for the payment and locked registration screens.
 */
export default function LockedHeader({ iiitName }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    router.push("/login");
  };

  return (
    <header className="bg-brand-dark text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="shrink-0 rounded text-sm font-semibold text-brand-highlight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-highlight">
            <span aria-hidden="true">←</span> Home
          </Link>
          <div className="min-w-0 border-l border-white/20 pl-4">
            <span className="hidden font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#e6c46a] sm:block">9th All India Inter-IIIT Sports Meet</span>
            <span className="block truncate font-display text-xl font-bold uppercase leading-tight tracking-wide text-white">{iiitName}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="btn btn-on-dark btn-sm shrink-0"
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </header>
  );
}
