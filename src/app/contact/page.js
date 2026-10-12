import PageHeader from '@/components/PageHeader';
import { eventInfo } from '@/data/info';
import Link from 'next/link';

export default function Contact() {
  return (
    <div style={{ background: '#faf6ee', minHeight: '100vh' }}>
      {/* Page header */}
      <PageHeader title="Contact Us" label="Connect" badgeLabel="With Us" description="Reach the organising team for event enquiries, travel support, registration assistance, and sponsorship opportunities." />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Quote */}
        <p className="text-lg font-medium text-center mb-14" style={{ color: '#444' }}>
          &ldquo;Got questions? We&apos;ve got answers &mdash; reach out and let&apos;s connect.&rdquo;
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Email */}
          <div className="rounded-2xl p-8 border" style={{ background: '#fff', borderColor: 'rgba(27,94,32,0.15)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-5" style={{ background: '#0a2112' }}>
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: '#c9972f' }}>Email</div>
            <h3 className="font-bold text-base mb-3" style={{ color: '#0a2112' }}>Drop us a message</h3>
            <a href="mailto:sports@iiitdm.ac.in"
              className="text-sm font-bold transition-colors hover:underline"
              style={{ color: '#1b5e20' }}
              aria-label="Email the Inter-IIIT Sports Meet organising team">
              sports@iiitdm.ac.in
            </a>
          </div>

          {/* Address */}
          <div className="rounded-2xl p-8 border" style={{ background: '#fff', borderColor: 'rgba(27,94,32,0.15)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-5" style={{ background: '#0a2112' }}>
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: '#c9972f' }}>Venue</div>
            <h3 className="font-bold text-base mb-3" style={{ color: '#0a2112' }}>Host Institute</h3>
            <p className="text-sm font-semibold" style={{ color: '#333' }}>
              {eventInfo.host}<br />
              <span style={{ color: '#777', fontWeight: 400 }}>Kancheepuram, Tamil Nadu</span>
            </p>
            <Link href="/location" className="inline-flex items-center gap-1 text-xs font-bold mt-3 transition-colors hover:underline" style={{ color: '#1b5e20' }}>
              View Travel Guide &amp; Map &rarr;
            </Link>
          </div>

          {/* Dates */}
          <div className="rounded-2xl p-8 border" style={{ background: '#fff', borderColor: 'rgba(27,94,32,0.15)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-5" style={{ background: '#0a2112' }}>
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: '#c9972f' }}>Dates</div>
            <h3 className="font-bold text-base mb-3" style={{ color: '#0a2112' }}>Event Schedule</h3>
            <p className="text-sm font-bold" style={{ color: '#1b5e20' }}>
              19 – 23 December 2026
            </p>
            <p className="text-xs mt-1" style={{ color: '#777' }}>5 Days · 15+ Sports</p>
          </div>
        </div>

        {/* Sponsor CTA */}
          <div className="dark-surface mt-12 rounded-2xl p-10 text-center" style={{ background: '#0a2112' }}>
          <h3 className="font-black text-xl text-white mb-2">Interested in Sponsoring?</h3>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Join us in powering the biggest inter-collegiate sports event among IIITs.
          </p>
          <a href="mailto:sports@iiitdm.ac.in"
            className="yellow-button inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: '#f5c518', color: '#0a2112' }}
            aria-label="Email the Inter-IIIT Sports Meet organising team about sponsorship">
            sports@iiitdm.ac.in
          </a>
        </div>
      </div>
    </div>
  );
}
