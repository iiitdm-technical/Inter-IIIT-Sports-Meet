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
    <header className="bg-[#0a2112] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="shrink-0 text-xs font-bold text-[#f5c518] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c518]">
            <span aria-hidden="true">←</span> Home
          </Link>
          <div className="min-w-0 border-l border-white/20 pl-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#e6c46a] block">9th All India Inter-IIIT Sports Meet</span>
            <span className="font-bold text-white text-lg truncate block">{iiitName}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="shrink-0 text-sm font-bold hover:text-[#f5c518] transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c518]"
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </header>
  );
}
