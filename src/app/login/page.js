"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { SPORTS_CELL_EMAIL } from "@/lib/registration/labels";

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

  const inputClass = "w-full rounded-control border border-line bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-ink-muted outline-none transition-colors focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15";

  return (
    <div className="min-h-[calc(100dvh-68px)] bg-ivory">
      <div className="mx-auto grid min-h-[calc(100dvh-68px)] max-w-[1600px] lg:grid-cols-[minmax(0,46%)_minmax(0,54%)]">
        <section className="relative hidden min-h-[700px] overflow-hidden bg-brand-dark p-10 text-white lg:flex lg:flex-col xl:p-16" aria-label="About the sports meet">
          <div className="pointer-events-none absolute -right-28 -top-24 h-[390px] w-[390px] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-6 top-8 h-[390px] w-[390px] rounded-full border border-brand-highlight/20" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-44 w-full bg-gradient-to-t from-brand-primary/40 to-transparent" />
          <div className="relative flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <Image src="/assets/brand/inter-iiit-logo.png" alt="All India Inter-IIIT Sports Meet" fill sizes="64px" className="object-contain" />
            </div>
            <span className="font-display text-sm font-bold uppercase tracking-[0.16em] text-brand-highlight">9th edition · 2026</span>
          </div>
          <div className="relative my-auto py-20">
            <div className="mb-7 h-1 w-14 rounded-full bg-brand-highlight" />
            <p className="mb-5 font-display text-base font-bold uppercase tracking-[0.16em] text-brand-highlight">One nation. One sporting spirit.</p>
            <p className="heading-display max-w-xl text-[clamp(3.5rem,6vw,6.5rem)] text-white">
              All India<br />Inter-IIIT<br />Sports Meet<span className="text-brand-highlight">.</span>
            </p>
            <p className="mt-7 max-w-md text-base leading-relaxed text-white/80">
              Represent your institute. Bring your team together. Be part of five days of sport and community in Kancheepuram.
            </p>
          </div>
          <dl className="relative grid grid-cols-2 gap-6 border-t border-white/20 pt-7">
            <div>
              <dt className="font-display text-sm font-bold uppercase tracking-[0.14em] text-white/70">When</dt>
              <dd className="mt-1 font-display text-2xl font-bold text-white">19–23 December 2026</dd>
            </div>
            <div>
              <dt className="font-display text-sm font-bold uppercase tracking-[0.14em] text-white/70">Where</dt>
              <dd className="mt-1 font-display text-2xl font-bold text-white">IIITDM Kancheepuram</dd>
            </div>
          </dl>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10 sm:py-16 lg:px-16" aria-labelledby="login-heading">
          <div className="w-full max-w-[430px]">
            <div className="mb-8">
              <span className="chip">
                <LockKeyhole size={13} aria-hidden="true" /> Registration portal
              </span>
              <h1 id="login-heading" className="heading-display mt-5 text-[clamp(3rem,6vw,4.25rem)] text-ink">Sign in</h1>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">For IIIT sports coordinators registering their contingent, and for organizers.</p>
            </div>
            {error && <div role="alert" className="mb-6 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-relaxed text-red-800">{error}</div>}
            <form onSubmit={handleLogin} className="card space-y-5 p-5 sm:p-7">
              <div>
                <label htmlFor="login-username" className="mb-2 block text-sm font-bold text-ink">IIIT code or admin email</label>
                <input id="login-username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required aria-describedby="login-username-hint" value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} placeholder="e.g. iiit-kota" />
                <p id="login-username-hint" className="meta mt-2">Use the IIIT code sent with your password, such as <span className="font-mono">iiit-kota</span>. Organizers use their email.</p>
              </div>
              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm font-bold text-ink">Password</label>
                <div className="relative">
                  <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass + " pr-14"} placeholder="Enter your password" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-control text-brand-primary hover:bg-green-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:cursor-wait">
                {loading ? "Signing in…" : <>Sign in <ArrowRight size={18} aria-hidden="true" /></>}
              </button>
            </form>
            <p className="mt-6 text-sm text-ink-soft">
              Lost your password or code? Email the Sports Cell at{" "}
              <a href={`mailto:${SPORTS_CELL_EMAIL}`} className="font-bold text-brand-primary underline underline-offset-2">{SPORTS_CELL_EMAIL}</a>.
            </p>
            <div className="mt-6 border-t border-line pt-6">
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-brand-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary"><ArrowLeft size={16} aria-hidden="true" /> Return to home</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
