'use client';

import PageHeader from '@/components/PageHeader';

import useReveal from '@/components/useReveal';
import Image from 'next/image';
import Link from 'next/link';
import { eventInfo } from '@/data/info';
import { iiits } from '@/data/iiits';
import { sports } from '@/data/sports';

/**
 * About Page Component
 *
 * Editorial overview of the 9th All India Inter-IIIT Sports Meet 2026 and its host,
 * IIITDM Kancheepuram: history, host institute, sports infrastructure and hospitality.
 */
export default function About() {
  const { hostInstitute, sportsFacilities, stats } = eventInfo;
  useReveal();

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="About the Meet" label="Discover" badgeLabel="Our Story" description={`The flagship national sports gathering uniting ${iiits.length} Indian Institutes of Information Technology, hosted at IIITDM Kancheepuram.`} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

        {/* ─── History & tradition ─────────────────────────────────────── */}
        <section data-reveal aria-labelledby="legacy-title" className="grid items-center gap-12 md:grid-cols-2 lg:gap-16">
          <div>
            <span className="chip">National sports tradition</span>
            <h2 id="legacy-title" className="heading-section mt-4">
              A legacy of <span className="text-brand-primary">sportsmanship</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-ink-soft">
              The All India Inter-IIIT Sports Meet is the premier quadrennial athletic tournament established to foster camaraderie, healthy competition, and national integration among autonomous IIITs established across India.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              This 9th edition brings together over 2,000 student-athletes and staff contingents competing across track, court, indoor, and aquatics disciplines. The event is a celebration of athletic discipline, endurance, and inter-institutional solidarity.
            </p>
          </div>

          {/* Natural photography, offset for an editorial feel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative h-64 overflow-hidden rounded-card sm:h-80">
              <Image src="/assets/campus/indoor-court.webp" alt="Basketball at the indoor sports complex" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition-transform duration-500 motion-safe:hover:scale-105" />
            </div>
            <div className="relative mt-8 h-64 overflow-hidden rounded-card sm:h-80">
              <Image src="/assets/campus/sports-team.webp" alt="IIITDM athletes with championship trophies" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition-transform duration-500 motion-safe:hover:scale-105" />
              <div className="absolute bottom-0 left-0 h-1.5 w-16 bg-brand-highlight" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* ─── Key numbers: editorial stat band ─────────────────────────── */}
        <section aria-label="The meet in numbers" className="mt-16 border-y border-line py-8 sm:mt-20">
          <dl className="grid grid-cols-2 gap-y-8 lg:grid-cols-4">
            {stats.map((stat, idx) => (
              <div key={stat.label} className={`flex flex-col px-2 sm:px-6 ${idx % 2 === 1 ? 'border-l border-line' : ''} ${idx === 2 ? 'lg:border-l lg:border-line' : ''}`}>
                <dt className="meta order-2 mt-2 font-semibold uppercase tracking-[0.12em]">{stat.label}</dt>
                <dd className="stat-number order-1 text-5xl text-brand-primary sm:text-6xl">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ─── Host institute spotlight ─────────────────────────────────── */}
        <section data-reveal aria-labelledby="host-title" className="mt-20 grid items-start gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="eyebrow flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" aria-hidden="true" />
              Host institute
            </p>
            <h2 id="host-title" className="mt-3 font-display text-3xl font-bold uppercase leading-[1.02] text-ink sm:text-4xl">
              {hostInstitute.name}
            </h2>
            <p className="mt-4 inline-flex rounded-control bg-green-wash px-3 py-1.5 text-sm font-semibold text-brand-primary">
              {hostInstitute.status} &bull; Estd. {hostInstitute.established}
            </p>
            <p className="mt-5 text-base leading-relaxed text-ink-soft">
              {hostInstitute.description}
            </p>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
              Situated on a <strong className="text-ink">51-acre campus</strong> along the Vandalur-Kelambakkam Road in Chennai, the institute boasts dedicated outdoor athletic grounds and modern indoor sports facilities, providing visiting delegations with a competition-ready environment.
            </p>
          </div>

          <aside className="card card-tint card-accent p-6" aria-labelledby="snapshot-title">
            <h3 id="snapshot-title" className="eyebrow">Campus snapshot</h3>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-ink">Campus area</dt>
                <dd className="mt-0.5 text-ink-soft">51 acres in Melakottaiyur, Chennai</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Governance</dt>
                <dd className="mt-0.5 text-ink-soft">Autonomous institute under the Ministry of Education, GoI</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Event host role</dt>
                <dd className="mt-0.5 text-ink-soft">9th All India edition organiser</dd>
              </div>
            </dl>
            <Link href="/location" className="mt-6 inline-flex items-center gap-1.5 border-t border-ink/10 pt-4 text-sm font-bold text-brand-primary underline-offset-4 hover:underline">
              Explore campus map &amp; directions <span aria-hidden="true">&rarr;</span>
            </Link>
          </aside>
        </section>

        {/* ─── Sports infrastructure ─────────────────────────────────────── */}
        <section data-reveal aria-labelledby="facilities-title" className="mt-24">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Campus facilities</p>
              <h2 id="facilities-title" className="heading-section mt-3">Sports infrastructure</h2>
            </div>
            <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
              IIITDM Kancheepuram maintains dedicated venues engineered to host high-intensity university-level competitions.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sportsFacilities.map((facility, idx) => (
              <article
                key={facility.name}
                className={`card card-interactive group flex flex-col overflow-hidden ${idx === 0 ? 'lg:col-span-2 lg:flex-row' : ''}`}
              >
                <div className={`relative w-full overflow-hidden bg-ivory-dark ${idx === 0 ? 'aspect-[16/9] lg:aspect-auto lg:min-h-[17rem] lg:w-3/5' : 'aspect-[16/9]'}`}>
                  <Image
                    src={facility.image}
                    alt={facility.name}
                    fill
                    sizes={idx === 0 ? '(max-width: 768px) calc(100vw - 32px), (max-width: 1024px) 50vw, 40vw' : '(max-width: 768px) calc(100vw - 32px), (max-width: 1024px) 50vw, 33vw'}
                    className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
                    style={{ objectPosition: facility.name === 'Swimming Pool' ? 'center 75%' : 'center' }}
                  />
                </div>
                <div className={`flex flex-1 flex-col p-6 ${idx === 0 ? 'lg:justify-center lg:p-8' : ''}`}>
                  <p className="meta font-semibold uppercase tracking-[0.12em]">Venue {String(idx + 1).padStart(2, '0')}</p>
                  <h3 className={`mt-2 ${idx === 0 ? 'font-display text-3xl font-bold uppercase leading-none text-ink' : 'heading-card'}`}>
                    {facility.name}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">
                    {facility.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Students & employees ─────────────────────────────────────── */}
        <section data-reveal aria-labelledby="traditions-title" className="card-ink mt-24 grid overflow-hidden rounded-card md:grid-cols-2">
          <div className="flex flex-col justify-center p-8 sm:p-12 md:p-14">
            <p className="eyebrow text-brand-highlight">Inclusive participation</p>
            <h2 id="traditions-title" className="heading-section mt-3 text-white">
              Beyond the field: two great traditions
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/85">
              The All India Inter-IIIT Sports Meet celebrates athletics across the entire community through two distinct meets: the <strong className="text-white">Students&apos; Sports Meet</strong> and the <strong className="text-white">Employees&apos; Sports Meet</strong>.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/75">
              While student-athletes contend for inter-collegiate championship glory, faculty and staff from participating IIITs compete in friendly matches that reinforce collegial bonds and institution-wide fitness.
            </p>
          </div>
          <div className="relative min-h-[280px] md:min-h-0">
            <Image src="/assets/campus/badminton.webp" alt="Badminton at IIITDM Kancheepuram" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-brand-dark to-transparent md:block" aria-hidden="true" />
          </div>
        </section>

        {/* ─── Hospitality ──────────────────────────────────────────────── */}
        <section data-reveal aria-labelledby="hospitality-title" className="card card-tint card-accent mt-10 p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-end">
            <div>
              <p className="eyebrow">Logistics &amp; hospitality</p>
              <h2 id="hospitality-title" className="mt-3 font-display text-3xl font-bold uppercase leading-none text-ink">
                Contingent accommodation &amp; care
              </h2>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                Visiting teams from {iiits.length} IIITs are accommodated in on-campus student hostels with dedicated dining arrangements serving regional dietary preferences. A 24/7 campus health center, first-aid teams, and local transport assistance marshals ensure a secure and organized tournament experience.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/location" className="btn btn-primary">
                Travel &amp; location guide <span aria-hidden="true">&rarr;</span>
              </Link>
              <Link href="/events" className="btn btn-outline">
                View all {sports.length} sports
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
