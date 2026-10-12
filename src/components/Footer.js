import Link from 'next/link';
import Image from 'next/image';
import { eventInfo } from '@/data/info';

export default function Footer() {
  return (
    <footer className="dark-surface" style={{ background: '#0a2112', borderTop: '3px solid #c9972f' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 relative rounded-full p-1  border-amber-500/70 bg-white/5">
                <Image src="/assets/brand/inter-iiit-logo.png" alt="Logo" fill className="object-contain p-1" />
              </div>
              <div>
                <div className="font-black text-base text-white tracking-wide">ALL INDIA INTER-IIIT</div>
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#c9972f' }}>Sports Meet 2026</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Celebrating unity, sportsmanship and excellence across 20+ Indian Institutes of Information Technology.
            </p>
            <div className="mt-5 text-sm font-semibold" style={{ color: '#f5c518' }}>
              {eventInfo.dates}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-5" style={{ color: '#c9972f' }}>Navigation</h3>
            <ul className="space-y-2.5">
              {[
                { href: '/about', label: 'About the Meet' },
                { href: '/events', label: 'All Events' },
                { href: '/location', label: 'Venue & Location' },
                { href: '/team', label: 'Core Team' },
                { href: '/gallery', label: 'Gallery' },
                { href: '/contact', label: 'Contact' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm transition-colors hover:text-white"
                    style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + CTA */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-5" style={{ color: '#c9972f' }}>Contact</h3>
            <div className="space-y-3 mb-6">
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span className="block font-semibold text-white mb-0.5">{eventInfo.host}</span>
                Kancheepuram, Tamil Nadu
              </div>
              <a href="mailto:sports@iiitdm.ac.in" className="text-sm transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.5)' }}
                aria-label="Email the All India Inter-IIIT Sports Meet organising team">
                sports@iiitdm.ac.in
              </a>
            </div>
            <Link href="/register"
                className="yellow-button inline-flex px-5 py-2.5 rounded-full text-sm font-black transition-all hover:-translate-y-0.5"
              style={{ background: '#f5c518', color: '#0a2112' }}>
              Register Now
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            © 2026 All India Inter-IIIT Sports Meet. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Hosted by {eventInfo.host}
          </p>
        </div>
      </div>
    </footer>
  );
}
