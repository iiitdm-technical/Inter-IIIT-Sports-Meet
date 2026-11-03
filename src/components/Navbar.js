'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/events', label: 'Events' },
    { href: '/location', label: 'Location' },
    { href: '/team', label: 'Team' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-brand-dark/[0.97] backdrop-blur-md" aria-label="Main">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-[60px] items-center justify-between sm:h-[68px]">

          {/* Logo + wordmark */}
          <Link href="/" className="group flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-highlight">
            <div className="relative h-10 w-10 rounded-full bg-white/[0.06] ring-1 ring-brand-highlight/30 transition-colors group-hover:ring-brand-highlight/60 sm:h-11 sm:w-11">
              <Image src="/assets/brand/inter-iiit-logo.png" alt="All India Inter-IIIT Sports Meet logo" fill sizes="44px" className="object-contain p-1" />
            </div>
            <div className="leading-none">
              <div className="font-display text-[1.0625rem] font-bold uppercase tracking-[0.04em] text-white sm:text-[1.25rem]">All India Inter-IIIT</div>
              <div className="mt-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-highlight">Sports Meet 2026</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={href === '/team' ? false : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`relative rounded-md px-3.5 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-highlight ${
                    active ? 'text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {label}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-0.5 left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-brand-highlight transition-all duration-300 ${active ? 'w-5 opacity-100' : 'w-0 opacity-0'}`}
                  />
                </Link>
              );
            })}
          </div>

          {/* CTA + mobile toggle */}
          <div className="flex items-center gap-3">
            <Link href="/register" className="btn btn-accent btn-sm hidden px-5 lg:inline-flex">
              Register
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="-mr-2 rounded-md p-3 text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-highlight lg:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-navigation" className="max-h-[calc(100dvh-60px)] overflow-y-auto border-t border-white/5 bg-brand-dark px-4 pt-3 pb-5 lg:hidden">
          <ul className="divide-y divide-white/[0.06]">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    prefetch={href === '/team' ? false : undefined}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between px-2 py-3.5 font-display text-lg font-bold uppercase tracking-[0.06em] transition-colors ${
                      active ? 'text-brand-highlight' : 'text-white/85 hover:text-white'
                    }`}
                  >
                    {label}
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-highlight" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/register" onClick={() => setMobileOpen(false)} className="btn btn-accent mt-4 w-full">
            Register now
          </Link>
        </div>
      )}
    </nav>
  );
}
