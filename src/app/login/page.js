"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed. Please check your credentials.");
      router.push(data.user?.role === "admin" ? "/admin" : "/register");
    } catch (err) {
      setError(err.message || "An unexpected error occurred during login.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[#cbd2c4] bg-white px-4 py-3.5 text-[15px] text-[#0a2112] placeholder:text-[#768075] outline-none transition-colors focus:border-[#1b5e20] focus:ring-4 focus:ring-[#1b5e20]/10";

  return (
    <main className="min-h-[calc(100dvh-68px)] bg-[#faf6ee]">
      <div className="mx-auto grid min-h-[calc(100dvh-68px)] max-w-[1600px] lg:grid-cols-[minmax(0,46%)_minmax(0,54%)]">
        <section className="relative hidden min-h-[700px] overflow-hidden bg-[#102b1b] p-10 text-white lg:flex lg:flex-col xl:p-16" aria-label="About the sports meet">
          <div className="pointer-events-none absolute -right-28 -top-24 h-[390px] w-[390px] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-6 top-8 h-[390px] w-[390px] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-44 w-full bg-gradient-to-t from-[#244b2b]/60 to-transparent" />
          <div className="relative flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <Image src="/assets/brand/inter-iiit-logo.png" alt="All India Inter-IIIT Sports Meet" fill sizes="64px" className="object-contain" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#eacb81]">9th edition · 2026</span>
          </div>
          <div className="relative my-auto py-20">
            <div className="mb-7 h-1 w-14 bg-[#e6b948]" />
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-[#eacb81]">One nation. One sporting spirit.</p>
            <h2 className="max-w-xl text-[clamp(2.8rem,4.3vw,5rem)] font-black leading-[1.04] tracking-[-0.045em]">
              All India<br />Inter-IIIT<br />Sports Meet<span className="text-[#e6b948]">.</span>
            </h2>
            <p className="mt-7 max-w-md text-base leading-relaxed text-[#d1ded3]">
              Represent your institute. Bring your team together. Be part of five days of sport and community in Kancheepuram.
            </p>
          </div>
          <div className="relative grid grid-cols-2 gap-6 border-t border-white/20 pt-7 text-sm">
            <div><span className="block text-xs uppercase tracking-[0.14em] text-[#aebfb0]">When</span><strong className="mt-1 block font-semibold text-white">19–23 December 2026</strong></div>
            <div><span className="block text-xs uppercase tracking-[0.14em] text-[#aebfb0]">Where</span><strong className="mt-1 block font-semibold text-white">IIITDM Kancheepuram</strong></div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10 sm:py-16 lg:px-16" aria-labelledby="login-heading">
          <div className="w-full max-w-[430px]">
            <div className="mb-9">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d6dfd0] bg-[#eff4e9] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#245b2d]">
                <LockKeyhole size={13} aria-hidden="true" /> Registration portal
              </div>
              <h1 id="login-heading" className="text-[clamp(2.25rem,4vw,3.2rem)] font-black leading-tight tracking-[-0.04em] text-[#0a2112]">Welcome back.</h1>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#546055]">Sign in to manage your institute’s contingent or review registrations.</p>
            </div>
            {error && <div role="alert" className="mb-6 rounded-xl border border-[#e8b7ae] bg-[#fff0ed] px-4 py-3 text-sm font-medium leading-relaxed text-[#8b2a21]">{error}</div>}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login-username" className="mb-2 block text-sm font-bold text-[#17351f]">IIIT code or admin email</label>
                <input id="login-username" type="text" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} placeholder="Enter your IIIT code or admin email" />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm font-bold text-[#17351f]">Password</label>
                <div className="relative">
                  <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass + " pr-14"} placeholder="Enter your password" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#426348] hover:bg-[#eff4e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b5e20]" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#16562c] px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#0e4321] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b5e20] disabled:cursor-wait disabled:opacity-60">
                {loading ? "Signing in…" : <>Sign in <ArrowRight size={18} aria-hidden="true" /></>}
              </button>
            </form>
            <div className="mt-8 border-t border-[#dce2d5] pt-6">
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#245b2d] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1b5e20]"><ArrowLeft size={16} aria-hidden="true" /> Return to home</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
