'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { eventInfo } from '@/data/info';
import { iiits } from '@/data/iiits';
import { sports } from '@/data/sports';

const eventStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'SportsEvent',
  name: '9th All India Inter-IIIT Sports Meet 2026',
  description: 'The 9th All India Inter-IIIT Sports Meet hosted by IIITDM Kancheepuram.',
  startDate: '2026-12-19',
  endDate: '2026-12-23',
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  location: {
    '@type': 'Place',
    name: 'IIITDM Kancheepuram',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kancheepuram',
      addressRegion: 'Tamil Nadu',
      addressCountry: 'IN',
    },
  },
  organizer: {
    '@type': 'Organization',
    name: 'IIITDM Kancheepuram',
  },
  image: '/assets/brand/inter-iiit-logo.png',
};

const homeGallery = [
  { src: '/assets/campus/sports-team.webp', alt: 'IIITDM athletes with their championship trophies' },
  { src: '/assets/gallery/gallery-02.jpg', alt: 'Students celebrating together' },
  { src: '/assets/gallery/gallery-03.jpg', alt: 'Team sports in action' },
  { src: '/assets/gallery/gallery-04.jpg', alt: 'Relay competition' },
  { src: '/assets/gallery/gallery-05.jpg', alt: 'Inter-IIIT opening ceremony' },
  { src: '/assets/gallery/gallery-06.jpg', alt: 'Championship atmosphere' },
];

function HomeGalleryScroller() {
  const scrollerRef = useRef(null);

  const scrollByAmount = (direction) => {
    scrollerRef.current?.scrollBy({
      left: direction * Math.min(scrollerRef.current.clientWidth * 0.72, 560),
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary"
        role="region"
        aria-label="Event gallery photos"
        tabIndex={0}
      >
        {homeGallery.map((photo, index) => (
          <figure
            key={photo.src}
            className={`group relative h-60 shrink-0 snap-start overflow-hidden rounded-card bg-ivory-dark ${
              index === 0 ? 'w-[78vw] sm:w-[48vw] md:w-[40vw]' : 'w-[70vw] sm:w-[34vw] md:w-[27vw]'
            }`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes={index === 0 ? '(max-width: 640px) 78vw, (max-width: 768px) 48vw, 40vw' : '(max-width: 640px) 70vw, (max-width: 768px) 34vw, 27vw'}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" aria-hidden="true" />
            <figcaption className="absolute bottom-3 left-4 font-display text-sm font-bold uppercase tracking-[0.1em] text-white">
              <span className="text-brand-highlight">{String(index + 1).padStart(2, '0')}</span> · Meet moments
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="meta">Swipe or drag to explore the meet</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-primary/30 bg-paper text-brand-primary transition-colors hover:bg-brand-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            aria-label="Previous gallery photos"
          >
            &larr;
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-primary/30 bg-paper text-brand-primary transition-colors hover:bg-brand-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            aria-label="Next gallery photos"
          >
            &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Landing Page Component (Home)
 * 
 * Purpose:
 * Flagship entry point for the 9th All India Inter-IIIT Sports Meet 2026.
 * Features a high-impact hero, quick logistics information cards, host institute
 * spotlight, and navigation to all pages.
 */
export default function Home() {
  const { hostInstitute } = eventInfo;

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
      { threshold: 0.14, rootMargin: '0px 0px -25px 0px' }
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
    <div className="bg-ivory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventStructuredData) }}
      />
      {/* ─── 1. HERO ───────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden bg-[linear-gradient(135deg,#f5c518_0%,#fcd958_28%,#faf6ee_62%,#faf6ee_100%)] md:min-h-[88vh] md:flex md:items-center">

        {/* Photo panel: natural campus image with a dark fade for the logo */}
        <div className="absolute right-0 top-0 hidden h-full w-[46%] md:block [clip-path:polygon(14%_0,100%_0,100%_100%,0_100%)]">
          <Image src="/assets/campus/sports-complex.webp" alt="" fill priority sizes="46vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-l from-brand-dark/80 via-brand-dark/55 to-brand-dark/20" aria-hidden="true" />
          <div className="absolute inset-0 flex items-center justify-center pl-[10%]">
            <div className="relative h-56 w-56 transition-transform duration-500 hover:scale-[1.03]">
              <Image src="/assets/brand/inter-iiit-logo.png" alt="All India Inter-IIIT Sports Meet logo" fill sizes="224px" className="object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]" />
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,#fbc02d_0%,transparent_70%)] opacity-30" aria-hidden="true" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16 md:py-24 lg:px-8">
          <div className="max-w-xl">
            <p className="animate-fadeUp mb-5 flex items-center gap-3 font-display text-sm font-bold uppercase tracking-[0.16em] text-ink">
              <span className="inline-block h-0.5 w-8 rounded-full bg-ink" aria-hidden="true" />
              9th Edition · {eventInfo.host}
            </p>

            <h1 className="animate-fadeUp animation-delay-100 heading-display text-ink text-[clamp(3.6rem,10vw,7.25rem)]">
              <span className="block text-[0.42em] tracking-[0.06em] leading-none mb-2">All India </span>
              <span className="block">Inter-IIIT </span>
              <span className="block text-brand-primary">Sports Meet</span>
            </h1>

            <div className="animate-fadeUp animation-delay-200 mt-6 mb-9 flex items-stretch gap-4">
              <span className="w-1 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />
              <div>
                <p className="stat-number text-[2rem] text-brand-primary">19 – 23 December 2026</p>
                <p className="mt-1.5 text-sm font-medium text-ink-soft">{eventInfo.host}, Chennai</p>
              </div>
            </div>

            <div className="animate-fadeUp animation-delay-300 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-primary group px-6">
                Register roster
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">&rarr;</span>
              </Link>
              <Link href="/events" className="btn btn-outline bg-paper/60 px-6">
                View events
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile logo watermark */}
        <div className="pointer-events-none absolute bottom-16 right-5 h-24 w-24 opacity-25 md:hidden" aria-hidden="true">
          <Image src="/assets/brand/inter-iiit-logo.png" alt="" fill sizes="96px" className="object-contain" />
        </div>

        {/* Ticker (decorative; repeats the facts above) */}
        <div aria-hidden="true" className="absolute bottom-0 z-20 w-full overflow-hidden border-t border-white/5 bg-brand-dark py-2.5">
          <div className="flex whitespace-nowrap" style={{ animation: 'marquee 32s linear infinite' }}>
            {[...Array(8)].map((_, i) => (
              <span key={i} className="mx-8 flex items-center gap-5 font-display text-sm font-bold uppercase tracking-[0.14em] text-brand-highlight">
                {eventInfo.dates}
                <span className="text-brand-highlight/40">◆</span>
                {eventInfo.host}
                <span className="text-brand-highlight/40">◆</span>
                9th All India Inter-IIIT Sports Meet
                <span className="text-brand-highlight/40">◆</span>
                {iiits.length} Participating Institutes
                <span className="text-brand-highlight/40">◆</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 2. QUICK FACTS ────────────────────────────────────────────── */}
      <section className="px-4 pt-10 pb-12 sm:px-6 lg:px-8">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: 'Tournament dates', value: '19 – 23 Dec 2026', note: 'Five championship days of track, court and field competition.' },
            { label: 'Host campus', value: 'IIITDM Kancheepuram', note: '51-acre green campus on Vandalur–Kelambakkam Road, Chennai.' },
            { label: 'National scale', value: `${iiits.length} IIITs`, note: 'Over 2,000 student-athletes and staff delegations.' },
            { label: 'Disciplines', value: `${sports.length} sports`, note: 'Athletics, aquatics, racquet, team and strength events.' },
          ].map((fact) => (
            <div key={fact.label} className="card card-accent px-4 pt-5 pb-4 sm:px-5 sm:pt-6 sm:pb-5">
              <dt className="eyebrow">{fact.label}</dt>
              <dd className="mt-2 font-display text-[1.375rem] font-bold uppercase leading-none text-ink sm:text-[1.75rem]">{fact.value}</dd>
              <dd className="meta mt-2 text-xs sm:mt-2.5 sm:text-[0.8125rem]">{fact.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ─── 3. STATS BAND ─────────────────────────────────────────────── */}
      <section className="bg-brand-primary py-12 sm:py-14">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 md:grid-cols-4 md:divide-x md:divide-white/15">
          {eventInfo.stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse items-center px-3 text-center sm:px-8">
              <dt className="mt-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-brand-highlight">{stat.label}</dt>
              <dd className="stat-number text-[clamp(2.75rem,6vw,4.25rem)] text-white">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ─── 4. ABOUT PREVIEW ──────────────────────────────────────────── */}
      <section className="section-pad">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 md:grid-cols-2 md:gap-16 lg:px-8">
          <div>
            <p className="eyebrow">About the meet</p>
            <h2 className="heading-section mt-3">
              A legacy of<br />
              <span className="text-brand-primary">sportsmanship</span>
            </h2>
            <span className="gold-rule" aria-hidden="true" />
            <p className="mt-6 text-base leading-relaxed text-ink-soft">{eventInfo.description}</p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              The meet is the flagship arena for student-athletes to demonstrate teamwork, athletic excellence, and sportsmanship.
            </p>
            <Link href="/about" className="group mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand-primary underline-offset-4 hover:underline">
              Read the full history
              <span className="inline-block transition-transform group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <div className="relative">
            <div className="absolute -bottom-4 -right-4 h-full w-full rounded-card bg-brand-highlight/30" aria-hidden="true" />
            <div className="relative h-[280px] w-full overflow-hidden rounded-card border border-line sm:h-[400px]">
              <Image src="/assets/campus/sports-team.webp" alt="IIITDM athletes with championship trophies" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. HOST INSTITUTE FEATURE ─────────────────────────────────── */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="card-ink relative mx-auto max-w-7xl overflow-hidden rounded-card">
          <div className="grid lg:grid-cols-[1.4fr_1fr]">
            <div className="p-8 sm:p-12">
              <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-brand-highlight">Host institute</p>
              <h3 className="heading-display mt-3 text-[clamp(2rem,4vw,3rem)] text-white">
                Welcome to {hostInstitute.shortName}
              </h3>
              <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-white/80">
                An Institute of National Importance under the Ministry of Education, Government of India. Set across a 51-acre green campus in Melakottaiyur, Chennai, the institute features an athletic stadium, indoor sports complex, competition swimming pool, and floodlit courts ready to host visiting delegations.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {['51-acre eco campus', 'Comprehensive sports arenas', '21 km from Chennai airport'].map((item) => (
                  <li key={item} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90">{item}</li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/location" className="btn btn-accent">
                  Campus &amp; travel guide <span aria-hidden="true">&rarr;</span>
                </Link>
                <Link href="/about" className="btn btn-on-dark">About the host</Link>
              </div>
            </div>
            <div className="relative hidden min-h-[320px] lg:block">
              <Image src="/assets/campus/indoor-court.webp" alt="" fill sizes="40vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-dark via-brand-dark/20 to-transparent" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. PARTICIPATING IIITs ────────────────────────────────────── */}
      <section className="section-pad border-y border-line bg-ivory-warm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">{iiits.length} institutes</p>
              <h2 className="heading-section mt-3">Participating IIITs</h2>
            </div>
            <p className="meta max-w-sm sm:text-right">Every government-funded IIIT competes for the overall championship trophy.</p>
          </div>
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-4 md:grid-cols-5">
            {iiits.map((iiit) => (
              <li key={iiit.name} className="card card-interactive flex flex-col items-center px-2 py-4 text-center sm:px-4 sm:py-5">
                <div className="relative mb-3 h-12 w-12 sm:h-16 sm:w-16">
                  <Image src={iiit.logo} alt="" fill sizes="64px" className="object-contain" />
                </div>
                <span className="text-xs font-semibold leading-snug text-ink-soft sm:text-[0.8125rem]">{iiit.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── 7. STUDENTS' & EMPLOYEES' MEET ────────────────────────────── */}
      <section className="grid md:grid-cols-2">
        {[
          { image: '/assets/gallery/gallery-02.jpg', tag: 'Students', title: <>Students&apos;<br />Sports Meet</>, text: `2,000+ student-athletes from ${iiits.length} IIITs competing across ${sports.length} sports over 5 championship days.` },
          { image: '/assets/gallery/gallery-03.jpg', tag: 'Faculty & staff', title: <>Employees&apos;<br />Sports Meet</>, text: 'Faculty and staff from IIITs unite in friendly competition, camaraderie, and community health.' },
        ].map((block) => (
          <article key={block.tag} className="group relative flex min-h-[400px] items-end overflow-hidden bg-brand-dark">
            <Image src={block.image} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" aria-hidden="true" />
            <div className="relative z-10 p-8 md:p-12">
              <span className="chip chip-ink">{block.tag}</span>
              <h2 className="heading-display mt-4 text-[clamp(2.25rem,4vw,3.25rem)] text-white">{block.title}</h2>
              <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-white/85">{block.text}</p>
            </div>
          </article>
        ))}
      </section>

      {/* ─── 8. GALLERY PREVIEW ────────────────────────────────────────── */}
      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Glimpses</p>
              <h2 className="heading-section mt-3">Gallery</h2>
            </div>
            <Link href="/gallery" className="btn btn-outline btn-sm hidden sm:inline-flex">
              View all photos <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <HomeGalleryScroller />
          <Link href="/gallery" className="btn btn-outline mt-6 w-full sm:hidden">
            View all photos <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>

      {/* ─── 9. PARTNERS & SUPPORTERS ──────────────────────────────────── */}
      <section className="border-t border-line bg-ivory-dark py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="eyebrow">Partners &amp; sponsors</p>
            <h2 className="heading-section mt-3 text-[clamp(1.85rem,3vw,2.5rem)]">Our supporters</h2>
          </div>
          {/* TODO: confirm the 2026 supporters with the organisers and give each logo its sponsor's name as alt text. */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((num) => (
              <li key={num} className="relative h-20 rounded-card border border-line bg-paper">
                <Image src={`/assets/sponsors/sponsor-0${num}.png`} alt="" fill sizes="(max-width: 640px) 45vw, 180px" className="object-contain p-4" />
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-ink-soft">Interested in supporting the 9th All India Inter-IIIT Sports Meet?</p>
            <a href="mailto:sports@iiitdm.ac.in" className="btn btn-primary">
              Contact us · sports@iiitdm.ac.in
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
