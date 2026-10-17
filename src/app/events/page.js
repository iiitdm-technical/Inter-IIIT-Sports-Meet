'use client';

import PageHeader from '@/components/PageHeader';

import { useEffect } from 'react';
import CircularGallery from './CircularGallery';
import { sports } from '@/data/sports';
import { getAllSportsList } from '@/lib/sports/config';
import Link from 'next/link';

const galleryItems = sports.map((sport) => ({
  image: sport.image,
  text: sport.name,
}));


const CATEGORY_LABELS = { M: 'Men', F: 'Women', mixed: 'Combined' };

function describeLimits(sport, gender) {
  if (sport.type === 'team' || sport.type === 'combined_team') {
    return `Squad of up to ${sport.teamLimits?.[gender]}`;
  }
  const events = sport.events?.[gender] || [];
  const noun = sport.type === 'weight_category_based' ? 'weight categories' : 'events';
  const perEvent = Math.max(...events.filter((e) => !e.isRelay).map((e) => e.maxParticipants));
  const reserves = Math.max(0, ...events.filter((e) => !e.isRelay).map((e) => e.maxReserves || 0));
  return `${events.length} ${noun} · up to ${perEvent} per IIIT${reserves ? ` + ${reserves} reserve` : ''}`;
}

function EventSummary() {
  const catalogue = getAllSportsList();
  return (
    <section aria-labelledby="event-summary-title" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6">
      <span className="text-[10px] font-black tracking-[0.25em] uppercase" style={{ color: '#86601a' }}>At a glance</span>
      <h2 id="event-summary-title" className="mt-2 font-black text-2xl sm:text-3xl" style={{ color: '#0a2112' }}>
        Entry limits per institute
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-700">
        Each student may enter at most two sports other than athletics and aquatics, plus up to three individual events each in athletics and aquatics (relays excluded). The rulebook is the final authority.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {catalogue.map((sport) => (
          <li key={sport.id} className="rounded-2xl border bg-white p-4" style={{ borderColor: 'rgba(27,94,32,0.14)' }}>
            <h3 className="font-bold text-base" style={{ color: '#0a2112' }}>{sport.name}</h3>
            <dl className="mt-2 space-y-1 text-sm">
              {sport.genders.map((gender) => (
                <div key={gender} className="flex gap-2">
                  <dt className="w-20 shrink-0 font-semibold text-gray-600">{CATEGORY_LABELS[gender]}</dt>
                  <dd className="text-gray-800">{describeLimits(sport, gender)}</dd>
                </div>
              ))}
            </dl>
            {sport.events && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-semibold" style={{ color: '#1b5e20' }}>
                  {sport.type === 'weight_category_based' ? 'Weight categories' : 'Event list'}
                </summary>
                {sport.genders.map((gender) => (
                  <p key={gender} className="mt-2 text-gray-700">
                    <span className="font-semibold">{CATEGORY_LABELS[gender]}: </span>
                    {(sport.events[gender] || []).map((event) => event.name).join(', ')}
                  </p>
                ))}
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Events() {
  useEffect(() => {
    const revealItems = document.querySelectorAll('[data-reveal]');

    if (!revealItems.length) return undefined;

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
      { threshold: 0.16 }
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
    <div style={{ background: '#F4F5EB', minHeight: '100vh', perspective: '1200px' }}>
      <PageHeader title="Sporting Events" badge={sports.length} badgeLabel="Events" description={`${sports.length} competitive events testing speed, skill, strength, and strategy.`} />

      {/* Events content */}
      <div
        style={{ willChange: 'transform', position: 'relative', zIndex: 2 }}
      >
        {/* Circular Gallery Section */}
        <div className="max-w-30xl mx-auto py-12 sm:py-20 md:py-28 px-4">
          <div className="w-full">
            <CircularGallery
              items={galleryItems}
              bend={3}
              textColor="#ffffff"
              borderRadius={0.05}
              scrollEase={0.12}
              fontUrl="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=swap"
              font="800 24px 'Montserrat', sans-serif"
              scrollSpeed={1.5}
            />
          </div>
        </div>
      <EventSummary />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
        <div data-reveal className="reveal rulebook-panel rounded-[28px] border p-6 sm:p-8 md:p-10 shadow-sm"
          style={{ background: 'linear-gradient(135deg, rgba(245,197,24,0.12), rgba(255,255,255,0.9)), #fff', borderColor: 'rgba(27,94,32,0.14)' }}>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <span className="text-[10px] font-black tracking-[0.25em] uppercase" style={{ color: '#86601a' }}>
                Rule Book
              </span>
              <h2 className="mt-3 font-black text-2xl sm:text-3xl" style={{ color: '#0a2112' }}>
                Read the full rulebook: competition rules, eligibility, event regulations and participation limits.
              </h2>
            </div>
            <Link
              href="/assets/docs/rulebook.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm font-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: '#0a2112', color: '#f5c518', letterSpacing: '0.04em' }}
            >
              View Rule Book
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
