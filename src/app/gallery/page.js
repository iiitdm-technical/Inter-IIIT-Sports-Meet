import PageHeader from '@/components/PageHeader';
import Image from 'next/image';
import { gallery } from '@/data/gallery';
import Link from 'next/link';

export default function Gallery() {
  const featured = gallery[0];
  const rest = gallery.slice(1);

  return (
    <div style={{ background: '#faf6ee', minHeight: '100vh' }}>
      {/* Page header */}
      <PageHeader title="Gallery" label="Relive" badgeLabel="The Moments" description="Glimpses of the competition, celebrations, and sportsmanship that bring our institutes together." />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Featured image */}
        <div className="relative w-full overflow-hidden rounded-2xl mb-4 group h-[260px] sm:h-[420px]">
          <Image
            src={featured}
            alt="Gallery featured"
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,33,18,0.5) 0%, transparent 50%)' }} />
        </div>

        {/* Remaining grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {rest.map((img, idx) => (
            <div key={idx}
              className={`relative overflow-hidden rounded-xl group h-[140px] sm:h-[200px] ${idx === 0 ? 'md:col-span-2' : ''}`}>
              <Image
                src={img}
                alt={`Gallery image ${idx + 2}`}
                fill
                sizes={idx === 0 ? '(max-width: 768px) 50vw, 40vw' : '(max-width: 768px) 50vw, 20vw'}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'rgba(10,33,18,0.3)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
