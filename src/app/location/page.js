import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import Image from 'next/image';
import { eventInfo, contactNumbers } from '@/data/info';

/**
 * Location Page Component
 *
 * Purpose:
 * Provides visiting sports contingents, officials, and attendees with verified
 * geographical, travel, landmark, and campus facility information for IIITDM Kancheepuram.
 *
 * Features:
 * - Direct "Get Directions" action integrating with Google Maps navigation
 * - Travel cards for air, rail and road, each led by its distance
 * - Verified nearby regional landmarks with distance benchmarks
 * - Embedded Google Map with a direct link to the full app
 * - Campus sports facilities and contingent check-in instructions
 */

function TravelCard({ mode, distance, distanceLabel, title, subtitle, children, footnote }) {
  return (
    <article className="card card-interactive flex flex-col p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="eyebrow">{mode}</p>
          <p className="stat-number mt-2 text-5xl text-ink">{distance}</p>
          <p className="meta mt-1">{distanceLabel}</p>
        </div>
      </div>
      <h3 className="heading-card mt-5">{title}</h3>
      {subtitle && <p className="mt-1 text-sm font-semibold text-brand-primary">{subtitle}</p>}
      <div className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">{children}</div>
      <p className="mt-6 rounded-control bg-ivory px-4 py-3 text-xs font-semibold leading-relaxed text-ink-soft">
        {footnote}
      </p>
    </article>
  );
}

export default function Location() {
  const { location, hostInstitute, sportsFacilities } = eventInfo;
  const [nearestStation] = location.railway.stations;

  return (
    <div className="min-h-screen bg-ivory">
      {/* Gold header band with dark, high-contrast event information */}
      <PageHeader title="Location & How to Reach" label="Visit" badgeLabel="Our Campus" description={`The 9th All India Inter-IIIT Sports Meet is held at the ${hostInstitute.campusArea} of ${hostInstitute.name}, situated in Melakottaiyur, Chennai.`}>
        <div className="w-full">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={location.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Get Directions
            <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens Google Maps in a new tab)</span>
          </a>
          <span className="chip bg-white/60 text-ink">
            GPS {location.coordinates.latitude}, {location.coordinates.longitude}
          </span>
        </div>
        <p className="mt-4 max-w-2xl text-sm font-medium text-ink">{location.address}</p>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">

        {/* Travel cards */}
        <section className="mb-16" aria-labelledby="travel-title">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow">How to reach</p>
            <h2 id="travel-title" className="heading-section mt-2">Travel &amp; distance</h2>
            <p className="mt-3 text-base text-ink-soft">
              Connectivity options from major air, rail, and bus transit terminals in the Chennai metropolitan area.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <TravelCard
              mode="By air"
              distance={location.airport.distance}
              distanceLabel={`${location.airport.time} by road`}
              title={location.airport.name}
              subtitle="Via Vandalur-Kelambakkam Road"
              footnote="Recommended: Airport prepaid taxi, Ola, Uber, or Fast Track."
            >
              <p>{location.airport.details}</p>
            </TravelCard>

            <TravelCard
              mode="By train"
              distance={nearestStation.distance}
              distanceLabel={`to ${nearestStation.name}, the nearest hub`}
              title="Major railway terminals"
              footnote="Tambaram (TBM) is the closest and most frequent suburban connecting station."
            >
              <ul className="space-y-3">
                {location.railway.stations.map((stn) => (
                  <li key={stn.name}>
                    <span className="flex items-baseline justify-between gap-3 font-bold text-ink">
                      {stn.name}
                      <span className="chip shrink-0">{stn.distance}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{stn.details}</span>
                  </li>
                ))}
              </ul>
            </TravelCard>

            <TravelCard
              mode="By bus & road"
              distance={location.bus.distance}
              distanceLabel="to the interstate bus terminus"
              title={location.bus.hub}
              subtitle="Interstate terminus for south-bound buses"
              footnote='MTC Bus Stop: "Melakottaiyur / IIITDM Gate" located at the main entrance.'
            >
              <p>{location.bus.routes}</p>
            </TravelCard>
          </div>
        </section>

        {/* Map and campus facilities */}
        <section className="mb-16" aria-labelledby="map-title">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Interactive campus locator</p>
              <h2 id="map-title" className="heading-section mt-2">Campus map &amp; navigation</h2>
            </div>
            <a
              href={location.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm self-start sm:self-auto"
            >
              Open in Google Maps <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>

          <div className="card grid grid-cols-1 overflow-hidden lg:grid-cols-3">
            <div className="relative min-h-[380px] w-full bg-ivory-dark sm:min-h-[460px] lg:col-span-2">
              <iframe
                title="IIITDM Kancheepuram Google Map"
                src={location.mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: '380px' }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 h-full w-full"
              />
            </div>

            <div className="flex flex-col justify-between border-t border-line bg-ivory p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div>
                <p className="eyebrow">Campus layout</p>
                <h3 className="heading-card mt-2 text-xl">Sports facilities hub</h3>
                <p className="meta mt-2">
                  Outdoor and indoor facilities are located within the campus perimeter within walking distance of contingent hostels.
                </p>

                <ul className="mt-6 space-y-4">
                  {sportsFacilities.map((facility) => (
                    <li key={facility.name} className="flex items-start gap-3">
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-control">
                        <Image src={facility.image} alt={facility.name} fill sizes="80px" className="object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-ink">{facility.name}</p>
                        <p className="text-xs leading-relaxed text-ink-muted">{facility.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card card-accent mt-8 p-4 text-sm leading-relaxed text-ink-soft">
                <p className="font-bold text-brand-primary">Contingent reporting desk</p>
                <p className="mt-1">
                  Arriving IIIT delegations should report to the Sports Council Helpdesk in the Administrative Foyer for registration kits and hostel allocation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Nearby landmarks */}
        <section className="mb-16" aria-labelledby="landmarks-title">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow">Surrounding area</p>
            <h2 id="landmarks-title" className="heading-section mt-2">Nearby landmarks</h2>
            <p className="mt-3 text-base text-ink-soft">
              Key regional transit, education, and cultural landmarks surrounding the Melakottaiyur campus.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {location.landmarks.map((landmark) => (
              <li key={landmark.name} className="card card-tint flex flex-col p-5">
                <p className="stat-number text-3xl text-brand-primary">{landmark.distance}</p>
                <h3 className="heading-card mt-3 text-base">{landmark.name}</h3>
                <p className="meta mt-1">{landmark.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Travel coordination */}
        <section className="card card-ink overflow-hidden p-8 sm:p-10" aria-labelledby="travel-help-title">
          <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full border border-white/10" aria-hidden="true" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="eyebrow text-brand-highlight">Assistance for travelling teams</p>
              <h2 id="travel-help-title" className="heading-section mt-4 text-white">Need local travel coordination?</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
                Student volunteer transport marshals will coordinate assistance at Tambaram Railway Station and Kilambakkam Bus Terminus during peak arrival hours for the 9th All India Inter-IIIT Sports Meet.
              </p>
            </div>

            <div className="shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/contact" className="btn btn-accent">Contact Sports Cell</Link>
                <a href="mailto:sports@iiitdm.ac.in" className="btn btn-on-dark">sports@iiitdm.ac.in</a>
              </div>
              <p className="mt-5 text-sm font-semibold text-white">For arrival help, call:</p>
              <ul className="mt-2 space-y-1.5">
                {contactNumbers.filter((contact) => contact.travel).map((contact) => (
                  <li key={contact.tel} className="text-sm text-white/80">
                    {contact.role}{" "}
                    <a href={`tel:${contact.tel}`} className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">{contact.display}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
