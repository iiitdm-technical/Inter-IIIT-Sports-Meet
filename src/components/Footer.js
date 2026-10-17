import Link from 'next/link';
import Image from 'next/image';
import { eventInfo } from '@/data/info';
import { iiits } from '@/data/iiits';

const footerLinks = [
  { href: '/about', label: 'About the Meet' },
  { href: '/events', label: 'All Events' },
  { href: '/location', label: 'Venue & Location' },
  { href: '/team', label: 'Core Team' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/contact', label: 'Contact' },
];

export default function Footer() {
  return (
    <footer className="border-t-[3px] border-brand-accent bg-brand-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-full bg-white/[0.06] ring-1 ring-brand-highlight/30">
                <Image src="/assets/brand/inter-iiit-logo.png" alt="All India Inter-IIIT Sports Meet logo" fill sizes="48px" className="object-contain p-1" />
              </div>
              <div className="leading-none">
                <div className="font-display text-xl font-bold uppercase tracking-[0.04em]">All India Inter-IIIT</div>
                <div className="mt-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-highlight">Sports Meet 2026</div>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/75">
              Celebrating unity, sportsmanship and excellence across {iiits.length} Indian Institutes of Information Technology.
            </p>
            <p className="mt-5 font-display text-lg font-bold uppercase tracking-[0.04em] text-brand-highlight">
              {eventInfo.dates}
            </p>
          </div>

          {/* Quick links */}
          <div className="md:col-span-3">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.16em] text-brand-highlight">Navigation</h2>
            <ul className="space-y-2.5">
              {footerLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} prefetch={href === '/team' ? false : undefined} className="text-sm text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + CTA */}
          <div className="md:col-span-3">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.16em] text-brand-highlight">Contact</h2>
            <address className="mb-6 space-y-3 not-italic">
              <p className="text-sm text-white/75">
                <span className="mb-0.5 block font-semibold text-white">{eventInfo.host}</span>
                Kancheepuram, Tamil Nadu
              </p>
              <a href="mailto:sports@iiitdm.ac.in" className="block text-sm text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline">
                sports@iiitdm.ac.in
              </a>
            </address>
            <Link href="/register" className="btn btn-accent btn-sm px-5">
              Register now
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-xs text-white/65">© 2026 All India Inter-IIIT Sports Meet. All rights reserved.</p>
          <p className="text-xs text-white/65">Hosted by {eventInfo.host}</p>
        </div>
      </div>
    </footer>
  );
}
