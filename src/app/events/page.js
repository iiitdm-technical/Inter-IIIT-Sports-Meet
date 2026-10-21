'use client';

import PageHeader from '@/components/PageHeader';

import useReveal from '@/components/useReveal';
import CircularGallery from './CircularGallery';
import { sports } from '@/data/sports';
import { getAllSportsList } from '@/lib/sports/config';
import Link from 'next/link';

const galleryItems = sports.map((sport) => ({
  image: sport.image,
  text: sport.name,
}));


const CATEGORY_LABELS = { M: 'Men', F: 'Women', mixed: 'Combined' };
const TYPE_LABELS = {
  team: 'Team sport',
  combined_team: 'Mixed team',
  event_based: 'Multi-event',
  weight_category_based: 'Weight classes',
};

function describeLimits(sport, gender) {
  if (sport.type === 'team' || sport.type === 'combined_team') {
    return { value: sport.teamLimits?.[gender], unit: 'players per squad' };
  }
  const events = sport.events?.[gender] || [];
  const noun = sport.type === 'weight_category_based' ? 'categories' : 'events';
  const perEvent = Math.max(...events.filter((e) => !e.isRelay).map((e) => e.maxParticipants));
  const reserves = Math.max(0, ...events.filter((e) => !e.isRelay).map((e) => e.maxReserves || 0));
  return {
    value: events.length,
    unit: `${noun} · ${perEvent} per IIIT${reserves ? ` + ${reserves} reserve` : ''}`,
  };
}

function EventSummary() {
  const catalogue = getAllSportsList();
  return (
    <section aria-labelledby="event-summary-title" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
      <div className="grid gap-6 border-t border-line pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-end">
        <div>
          <p className="eyebrow">At a glance</p>
          <h2 id="event-summary-title" className="heading-section mt-3">
            Entry limits per institute
          </h2>
        </div>
        <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">
          Each student may enter at most two sports other than athletics and aquatics, plus up to three individual events each in athletics and aquatics (relays excluded). The rulebook is the final authority.
        </p>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {catalogue.map((sport) => (
          <li key={sport.id} className="card card-interactive flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="heading-card">{sport.name}</h3>
              <span className="chip chip-gold shrink-0">{TYPE_LABELS[sport.type] || 'Sport'}</span>
            </div>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {sport.genders.map((gender) => {
                const limit = describeLimits(sport, gender);
                return (
                  <div key={gender} className="flex items-center gap-4 py-3">
                    <dt className="w-20 shrink-0">
                      <span className={`chip ${gender === 'F' ? 'chip-gold' : ''}`}>{CATEGORY_LABELS[gender]}</span>
                    </dt>
                    <dd className="flex items-baseline gap-2 text-ink">
                      <span className="stat-number text-3xl text-brand-primary">{limit.value}</span>
                      <span className="meta">{limit.unit}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
            {sport.events && (
              <details className="group mt-3 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-control py-1 font-semibold text-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
                  {sport.type === 'weight_category_based' ? 'Weight categories' : 'Event list'}
                  <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                {sport.genders.map((gender) => (
                  <p key={gender} className="mt-2 leading-relaxed text-ink-soft">
                    <span className="font-semibold text-ink">{CATEGORY_LABELS[gender]}: </span>
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
  useReveal();

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="Sporting Events" badge={sports.length} badgeLabel="Events" description={`${sports.length} competitive events testing speed, skill, strength, and strategy.`} />

      <div className="relative">
        {/* Circular Gallery Section */}
        <div className="mx-auto py-12 sm:py-16 md:py-20 px-4">
          <CircularGallery
            items={galleryItems}
            bend={3}
            textColor="#ffffff"
            borderRadius={0.05}
            scrollEase={0.12}
            fontSize={26}
            fontWeight={700}
            scrollSpeed={1.5}
          />
        </div>

        <EventSummary />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20">
          <section data-reveal aria-labelledby="rulebook-title" className="card-ink relative overflow-hidden rounded-card px-6 py-10 sm:px-10 md:px-14">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-brand-highlight/15" aria-hidden="true" />
            <div className="pointer-events-none absolute left-0 top-0 h-1.5 w-28 bg-brand-highlight" aria-hidden="true" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="eyebrow text-brand-highlight">Rule book</p>
                <h2 id="rulebook-title" className="heading-section mt-3 text-white">
                  Read the full rulebook
                </h2>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-white/80">
                  Competition rules, eligibility, event regulations and participation limits for every sport.
                </p>
              </div>
              <Link
                href="/assets/docs/rulebook.pdf"
                target="_blank"
                rel="noreferrer"
                className="btn btn-accent shrink-0 px-7"
              >
                View rule book (PDF)
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
