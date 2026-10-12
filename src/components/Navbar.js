'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { eventInfo } from '@/data/info';

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
    <nav className="dark-surface sticky top-0 z-50 w-full" style={{ background: 'rgba(10,33,18,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[60px] sm:h-[68px]">

          {/* Logo + Brand */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 relative rounded-full p-1 border-amber-400/70 flex items-center justify-center group-hover:bg-white/10 group-hover:border-amber-300 transition-colors">
              <Image src="/assets/brand/inter-iiit-logo.png" alt="All India Inter-IIIT Sports Meet logo" fill className="object-contain p-1" />
            </div>
            <div className="block leading-tight">
              <div className="text-white font-black text-sm sm:text-base tracking-wide">ALL INDIA INTER-IIIT</div>
              <div className="text-amber-400 font-semibold text-[8px] sm:text-[10px] tracking-[0.14em] sm:tracking-[0.18em] uppercase opacity-90">Sports Meet 2026</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3.5 py-2 text-[13px] font-semibold tracking-wide rounded-md transition-all duration-200 ${
                    active
                      ? 'text-amber-400'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-amber-400" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* CTA + mobile toggle */}
          <div className="flex items-center gap-3">
            <Link
              href="/register"
                className="yellow-button hidden lg:inline-flex items-center px-5 py-2 text-[13px] font-bold text-brand-dark bg-brand-highlight hover:bg-amber-300 rounded-full transition-colors shadow-sm"
            >
              Register
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden -mr-2 p-3 text-gray-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-navigation" className="lg:hidden max-h-[calc(100dvh-60px)] overflow-y-auto bg-brand-dark border-t border-white/5 px-4 py-4 space-y-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-3.5 rounded-lg text-sm font-semibold transition-colors ${
                pathname === href
                  ? 'bg-brand-primary/40 text-amber-400'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/register"
            onClick={() => setMobileOpen(false)}
            className="yellow-button block mt-3 px-4 py-3 text-center text-sm font-bold text-brand-dark bg-brand-highlight hover:bg-amber-300 rounded-full transition-colors"
          >
            Register Now
          </Link>
        </div>
      )}
    </nav>
  );
}
