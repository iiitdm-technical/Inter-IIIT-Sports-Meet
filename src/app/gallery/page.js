import PageHeader from '@/components/PageHeader';
import Image from 'next/image';
import { gallery } from '@/data/gallery';

// Editorial mosaic for six photos: a 2×2 feature, a stacked pair beside it and
// a row of three, so no image is left on its own row.
const TILE_LAYOUT = [
  'col-span-2 row-span-2 md:col-span-2 md:row-span-2',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-2 md:col-span-1 row-span-1',
];

const TILE_SIZES = [
  '(max-width: 768px) calc(100vw - 32px), 66vw',
  '(max-width: 768px) 50vw, 33vw',
  '(max-width: 768px) 50vw, 33vw',
  '(max-width: 768px) 50vw, 33vw',
  '(max-width: 768px) 50vw, 33vw',
  '(max-width: 768px) calc(100vw - 32px), 33vw',
];

export default function Gallery() {
  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="Gallery" label="Relive" badgeLabel="The Moments" description="Glimpses of the competition, celebrations, and sportsmanship that bring our institutes together." />

      <section aria-labelledby="gallery-title" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Photo gallery</p>
            <h2 id="gallery-title" className="heading-section mt-3">Moments from the meet</h2>
          </div>
          <p className="meta">{gallery.length} photographs</p>
        </div>

        <ul className="grid auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[190px] md:grid-cols-3 md:auto-rows-[210px] md:gap-4">
          {gallery.map((img, idx) => (
            <li
              key={img}
              className={`group relative overflow-hidden rounded-card bg-ivory-dark ${TILE_LAYOUT[idx] || 'col-span-1 row-span-1'}`}
            >
              <Image
                src={img}
                alt={idx === 0 ? 'IIITDM athletes with their championship trophies' : `Inter-IIIT Sports Meet moment ${idx + 1}`}
                fill
                sizes={TILE_SIZES[idx] || '(max-width: 768px) 50vw, 33vw'}
                className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-brand-dark/45 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
              {idx === 0 && (
                <span className="chip chip-ink absolute bottom-4 left-4">Champions</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
