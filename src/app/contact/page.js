import PageHeader from '@/components/PageHeader';
import { eventInfo } from '@/data/info';
import { sports } from '@/data/sports';
import Link from 'next/link';

const SPORTS_EMAIL = 'sports@iiitdm.ac.in';

const enquiryTopics = ['Event enquiries', 'Registration help', 'Travel support', 'Sponsorship'];

export default function Contact() {
  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="Contact Us" label="Connect" badgeLabel="With Us" description="Reach the organising team for event enquiries, travel support, registration assistance, and sponsorship opportunities." />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* Primary contact: email the Sports Cell */}
          <section className="card card-accent p-6 sm:p-10" aria-labelledby="contact-email-title">
            <p className="eyebrow">Sports Cell · IIITDM Kancheepuram</p>
            <h2 id="contact-email-title" className="heading-section mt-3">Write to the organisers</h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-soft">
              One inbox handles every question about the meet. Include your institute name so the right coordinator can reply.
            </p>

            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Topics handled">
              {enquiryTopics.map((topic) => (
                <li key={topic} className="chip">{topic}</li>
              ))}
            </ul>

            <div className="mt-8 border-t border-line pt-6">
              <p className="meta">Email</p>
              <a
                href={`mailto:${SPORTS_EMAIL}`}
                className="mt-1 inline-block break-all font-display text-3xl font-bold text-brand-primary underline decoration-brand-primary/30 decoration-2 underline-offset-4 transition-colors hover:decoration-brand-primary sm:text-4xl"
              >
                {SPORTS_EMAIL}
              </a>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`mailto:${SPORTS_EMAIL}`} className="btn btn-primary">Send an email</a>
                <Link href="/location" className="btn btn-outline">Travel guide &amp; map</Link>
              </div>
            </div>
          </section>

          {/* Venue and dates */}
          <div className="grid gap-6">
            <section className="card p-6 sm:p-8" aria-labelledby="contact-venue-title">
              <p className="eyebrow">Venue</p>
              <h2 id="contact-venue-title" className="heading-card mt-2 text-xl">{eventInfo.host}</h2>
              <address className="mt-2 text-sm not-italic leading-relaxed text-ink-soft">
                {eventInfo.location.address}
              </address>
              <a
                href={eventInfo.location.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-primary underline-offset-4 hover:underline"
              >
                Get directions <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens Google Maps in a new tab)</span>
              </a>
            </section>

            <section className="card card-tint p-6 sm:p-8" aria-labelledby="contact-dates-title">
              <p className="eyebrow">Dates</p>
              <h2 id="contact-dates-title" className="stat-number mt-2 text-4xl text-ink sm:text-5xl">
                19–23 Dec 2026
              </h2>
              <p className="meta mt-3">5 days · {sports.length} sports</p>
            </section>
          </div>
        </div>

        {/* Sponsorship feature */}
        <section className="card card-ink mt-6 overflow-hidden p-8 sm:p-12" aria-labelledby="contact-sponsor-title">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-4 top-10 h-56 w-56 rounded-full border border-brand-highlight/20" aria-hidden="true" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow text-brand-highlight">Partners &amp; sponsors</p>
              <h2 id="contact-sponsor-title" className="heading-section mt-4 text-white">Interested in sponsoring?</h2>
              <p className="mt-3 text-base leading-relaxed text-white/80">
                Join us in powering the biggest inter-collegiate sports event among IIITs.
              </p>
            </div>
            <a href={`mailto:${SPORTS_EMAIL}?subject=Sponsorship%20enquiry`} className="btn btn-accent shrink-0">
              Discuss sponsorship
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
