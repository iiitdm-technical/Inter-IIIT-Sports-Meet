'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { eventInfo } from '@/data/info';

/**
 * About Page Component
 * 
 * Purpose:
 * Editorial overview of the 9th All India Inter-IIIT Sports Meet 2026 and its host,
 * IIITDM Kancheepuram. Contains verified facts on the meet's history, host institute
 * background, sports infrastructure, and campus hospitality.
 * 
 * Design Standards:
 * - Built on the warm ivory (#faf6ee) primary surface to reduce heavy green dominance
 * - Forest green (#0a2112) and gold (#c9972f / #f5c518) accents for athletic prestige
 * - Natural photographic presentation without green overlays
 * - Fully responsive across mobile, tablet, and desktop breakpoints
 */
export default function About() {
  const { hostInstitute, sportsFacilities, stats } = eventInfo;

  useEffect(() => {
    const revealItems = document.querySelectorAll('[data-reveal]');

    if (!revealItems.length) return;

    const activate = (element) => {
      element.classList.add('is-visible');
      element.dataset.visible = 'true';
    };

    if (!('IntersectionObserver' in window)) {
      revealItems.forEach((item) => activate(item));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealItems.forEach((item) => {
      if (item.getBoundingClientRect().top < window.innerHeight + 120) {
        activate(item);
        return;
      }
      observer.observe(item);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ background: '#faf6ee', minHeight: '100vh' }}>
      {/* ─── 1. PAGE HEADER ──────────────────────────────────────────────── */}
      <section className="green-page-header py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <span className="page-eyebrow text-xs font-black tracking-[0.25em] uppercase">
            Our Legacy &amp; Host Institute
          </span>
          <h1 className="mt-3 font-black" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', color: '#0a2112' }}>
            About the Meet
          </h1>
          <div className="page-rule mt-3 w-12 h-1 rounded-full" />
          <p className="mt-4 text-base sm:text-lg max-w-2xl leading-relaxed" style={{ color: 'rgba(10,33,18,0.78)' }}>
            The flagship national sports gathering uniting 20+ Indian Institutes of Information Technology, hosted at IIITDM Kancheepuram.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* ─── 2. HISTORY & THE INTER-IIIT TRADITION ──────────────────────── */}
        <div data-reveal className="reveal grid md:grid-cols-2 gap-12 lg:gap-16 items-center mb-20">
          <div>
            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4"
              style={{ background: 'rgba(27,94,32,0.1)', color: '#1b5e20' }}>
              National Sports Tradition
            </div>
            <h2 className="font-black text-3xl sm:text-4xl mb-6 leading-tight" style={{ color: '#0a2112' }}>
              A Legacy of <span style={{ color: '#1b5e20' }}>Sportsmanship</span>
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: '#3a3a3a' }}>
              The All India Inter-IIIT Sports Meet is the premier quadrennial athletic tournament established to foster camaraderie, healthy competition, and national integration among autonomous IIITs established across India.
            </p>
            <p className="text-base leading-relaxed mb-6" style={{ color: '#3a3a3a' }}>
              This 9th edition brings together over 2,000 student-athletes and staff contingents competing across track, court, indoor, and aquatics disciplines. The event is a celebration of athletic discipline, endurance, and inter-institutional solidarity.
            </p>

            {/* Quick KPI Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {stats.map((stat, idx) => (
                <div key={idx} className="count-up rounded-xl p-4 border" style={{ background: '#fff', borderColor: 'rgba(27,94,32,0.15)' }}>
                  <div className="font-black text-2xl" style={{ color: '#1b5e20' }}>{stat.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider mt-1 text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Editorial Photography (Natural, no green filter) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="info-card relative h-64 sm:h-80 rounded-2xl overflow-hidden shadow-md">
              <Image src="/assets/campus/indoor-court.webp" alt="Basketball at the indoor sports complex" fill className="object-cover transition-transform duration-500 hover:scale-105" />
            </div>
            <div className="info-card relative h-64 sm:h-80 rounded-2xl overflow-hidden shadow-md mt-6">
              <Image src="/assets/campus/sports-team.webp" alt="IIITDM athletes with championship trophies" fill className="object-cover transition-transform duration-500 hover:scale-105" />
            </div>
          </div>
        </div>

        {/* ─── 3. HOST INSTITUTE SPOTLIGHT: IIITDM KANCHEEPURAM ────────────── */}
        <div data-reveal className="reveal rounded-3xl p-8 sm:p-12 lg:p-14 mb-20 border"
          style={{ background: '#fff', borderColor: 'rgba(201,151,47,0.25)' }}>
          <div className="grid lg:grid-cols-3 gap-10 items-start">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#1b5e20' }} />
                <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: '#c9972f' }}>
                  Host Institute
                </span>
              </div>
              <h2 className="font-black text-2xl sm:text-3xl mb-4" style={{ color: '#0a2112' }}>
                {hostInstitute.name}
              </h2>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold mb-5"
                style={{ background: 'rgba(10,33,18,0.06)', color: '#0a2112' }}>
                <span>{hostInstitute.status} &bull; Estd. {hostInstitute.established}</span>
              </div>
              <p className="text-base leading-relaxed mb-4" style={{ color: '#3a3a3a' }}>
                {hostInstitute.description}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#555' }}>
                Situated on a <strong>51-acre campus</strong> along the Vandalur-Kelambakkam Road in Chennai, the institute boasts dedicated outdoor athletic grounds and modern indoor sports facilities, providing visiting delegations with a competition-ready environment.
              </p>
            </div>

            {/* Quick Fact Box */}
            <div className="info-card rounded-2xl p-6 border flex flex-col justify-between"
              style={{ background: '#faf6ee', borderColor: 'rgba(27,94,32,0.12)' }}>
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider mb-4" style={{ color: '#0a2112' }}>
                  Campus Snapshot
                </h3>
                <ul className="space-y-3 text-xs" style={{ color: '#444' }}>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-800 font-bold">&bull;</span>
                    <span><strong>Campus Area:</strong> 51 Acres in Melakottaiyur, Chennai</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-800 font-bold">&bull;</span>
                    <span><strong>Governance:</strong> Autonomous Institute under Ministry of Education, GoI</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-800 font-bold">&bull;</span>
                    <span><strong>Event Host Role:</strong> 9th All India Edition Organizer</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                <Link
                  href="/location"
                  className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors hover:underline"
                  style={{ color: '#1b5e20' }}
                >
                  <span>Explore Campus Map &amp; Directions</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 4. SPORTS INFRASTRUCTURE BREAKDOWN ─────────────────────────── */}
        <div data-reveal className="reveal mb-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: '#c9972f' }}>
              Campus Facilities
            </span>
            <h2 className="mt-2 font-black text-3xl sm:text-4xl" style={{ color: '#0a2112' }}>
              Sports Infrastructure
            </h2>
            <p className="mt-3 text-sm" style={{ color: '#555' }}>
              IIITDM Kancheepuram maintains dedicated venues engineered to host high-intensity university-level competitions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sportsFacilities.map((facility, idx) => (
              <article
                key={facility.name}
                className="facility-card group overflow-hidden rounded-2xl border flex flex-col"
                style={{ background: '#fff', borderColor: 'rgba(27,94,32,0.12)' }}
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-100">
                  <Image
                    src={facility.image}
                    alt={facility.name}
                    fill
                    sizes="(max-width: 768px) calc(100vw - 32px), (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
                    style={{ objectPosition: facility.name === 'Swimming Pool' ? 'center 75%' : 'center' }}
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-bold text-lg leading-snug mb-3" style={{ color: '#0a2112' }}>
                    {facility.name}
                  </h3>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: '#555' }}>
                    {facility.desc}
                  </p>
                  <div className="mt-5 pt-4 border-t text-xs font-semibold" style={{ borderColor: 'rgba(27,94,32,0.08)', color: '#1b5e20' }}>
                    IIITDM Kancheepuram
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* ─── 5. THE DUAL TRADITION: STUDENTS & EMPLOYEES ────────────────── */}
        <div data-reveal className="dark-surface reveal rounded-3xl overflow-hidden mb-20" style={{ background: '#0a2112' }}>
          <div className="grid md:grid-cols-2">
            <div className="p-10 md:p-14 text-white flex flex-col justify-center">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: '#f5c518' }}>
                Inclusive Participation
              </span>
              <h2 className="mt-3 font-black text-3xl sm:text-4xl mb-5 leading-tight">
                Beyond the Field: <br />Two Great Traditions
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-white/75 mb-6">
                The Inter-IIIT Sports Meet celebrates athletics across the entire community through two distinct meets: the <strong>Students&apos; Sports Meet</strong> and the <strong>Employees&apos; Sports Meet</strong>.
              </p>
              <p className="text-sm leading-relaxed text-white/60">
                While student-athletes contend for inter-collegiate championship glory, faculty and staff from participating IIITs compete in friendly matches that reinforce collegial bonds and institution-wide fitness.
              </p>
            </div>

            <div className="relative min-h-[300px] md:min-h-0">
              <Image src="/assets/campus/badminton.webp" alt="Badminton at IIITDM Kancheepuram" fill className="object-cover opacity-60" />
            </div>
          </div>
        </div>

        {/* ─── 6. CONTINGENT HOSPITALITY & CAMPUS LIFE ────────────────────── */}
        <div data-reveal className="reveal rounded-2xl p-8 sm:p-10 border" style={{ background: '#f3ead8', borderColor: 'rgba(27,94,32,0.15)' }}>
          <div className="max-w-3xl">
            <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: '#c9972f' }}>
              Logistics &amp; Hospitality
            </span>
            <h3 className="mt-2 font-black text-2xl" style={{ color: '#0a2112' }}>
              Contingent Accommodation &amp; Care
            </h3>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: '#444' }}>
              Visiting teams from 20+ IIITs are accommodated in on-campus student hostels with dedicated dining arrangements serving regional dietary preferences. A 24/7 campus health center, first-aid teams, and local transport assistance marshals ensure a secure and organized tournament experience.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/location"
                className="dark-surface px-6 py-2.5 rounded-full text-xs font-bold transition-all hover:-translate-y-0.5 shadow-sm"
                style={{ background: '#1b5e20', color: '#fff' }}
              >
                View Travel &amp; Location Guide &rarr;
              </Link>
              <Link
                href="/events"
                className="px-6 py-2.5 rounded-full text-xs font-bold border transition-all hover:bg-white"
                style={{ borderColor: '#1b5e20', color: '#1b5e20' }}
              >
                View 15+ Sports Disciplines
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
