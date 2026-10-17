import PageHeader from '@/components/PageHeader';
import { eventInfo } from '@/data/info';
import { sports } from '@/data/sports';
import Link from 'next/link';

export default function Contact() {
  return (
    <div style={{ background: '#faf6ee', minHeight: '100vh' }}>
      {/* Page header */}
      <PageHeader title="Contact Us" label="Connect" badgeLabel="With Us" description="Reach the organising team for event enquiries, travel support, registration assistance, and sponsorship opportunities." />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Email */}
          <div className="rounded-2xl p-8 border" style={{ background: '#fff', borderColor: 'rgba(27,94,32,0.15)' }}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: '#86601a' }}>Email</div>
            <h2 className="font-bold text-base mb-3" style={{ color: '#0a2112' }}>Drop us a message</h2>
            <a href="mailto:sports@iiitdm.ac.in"
              className="text-sm font-bold transition-colors hover:underline"
              style={{ color: '#1b5e20' }}>
              sports@iiitdm.ac.in
            </a>
          </div>

          {/* Address */}
          <div className="rounded-2xl p-8 border" style={{ background: '#fff', borderColor: 'rgba(27,94,32,0.15)' }}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: '#86601a' }}>Venue</div>
            <h2 className="font-bold text-base mb-3" style={{ color: '#0a2112' }}>Host Institute</h2>
            <p className="text-sm font-semibold" style={{ color: '#333' }}>
              {eventInfo.host}<br />
              <span style={{ color: '#5f5f5f', fontWeight: 400 }}>Kancheepuram, Tamil Nadu</span>
            </p>
            <Link href="/location" className="inline-flex items-center gap-1 text-xs font-bold mt-3 transition-colors hover:underline" style={{ color: '#1b5e20' }}>
              View Travel Guide &amp; Map &rarr;
            </Link>
          </div>

          {/* Dates */}
          <div className="rounded-2xl p-8 border" style={{ background: '#fff', borderColor: 'rgba(27,94,32,0.15)' }}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: '#86601a' }}>Dates</div>
            <h2 className="font-bold text-base mb-3" style={{ color: '#0a2112' }}>Event Schedule</h2>
            <p className="text-sm font-bold" style={{ color: '#1b5e20' }}>
              19 – 23 December 2026
            </p>
            <p className="text-xs mt-1" style={{ color: '#5f5f5f' }}>5 Days · {sports.length} Sports</p>
          </div>
        </div>

        {/* Sponsor CTA */}
          <div className="dark-surface mt-12 rounded-2xl p-10 text-center" style={{ background: '#0a2112' }}>
          <h2 className="font-black text-xl text-white mb-2">Interested in Sponsoring?</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.78)' }}>
            Join us in powering the biggest inter-collegiate sports event among IIITs.
          </p>
          <a href="mailto:sports@iiitdm.ac.in"
            className="yellow-button inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: '#f5c518', color: '#0a2112' }}>
            sports@iiitdm.ac.in
          </a>
        </div>
      </div>
    </div>
  );
}
