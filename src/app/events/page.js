'use client';

import PageHeader from '@/components/PageHeader';

import { useState, useEffect } from 'react';
import CircularGallery from './CircularGallery';
import { sports } from '@/data/sports';
import Image from 'next/image';
import Link from 'next/link';

function SportCard({ sport, idx }) {
  const [spotlight, setSpotlight] = useState({ x: 0, y: 0, active: false });

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSpotlight({
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
      active: true,
    });
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      const rect = e.currentTarget.getBoundingClientRect();
      setSpotlight({
        x: Math.round(e.touches[0].clientX - rect.left),
        y: Math.round(e.touches[0].clientY - rect.top),
        active: true,
      });
    }
  };

  const handleLeave = () => {
    setSpotlight((prev) => ({ ...prev, active: false }));
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={handleLeave}
      onTouchEnd={handleLeave}
      className="group relative overflow-hidden rounded-xl cursor-pointer border border-transparent hover:border-[#f5c518] hover:ring-2 hover:ring-[#f5c518] hover:shadow-[0_0_25px_rgba(245,197,24,0.5)] transition-all duration-300 ease-out hover:scale-[1.06] transition-transform active:scale-95 shadow-lg"
      style={{ height: '220px' }}
    >
      {/* Natural image with smooth scale-up on card hover */}
      <Image
        src={sport.image}
        alt={sport.name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
      />

      {/* Increased bottom dark gradient overlay contrast beneath text */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 40%, transparent 100%)',
        }}
      />

      {/* Dynamic cursor/touch radial spotlight overlay with light, subtle glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-10"
        style={{
          opacity: spotlight.active ? 1 : 0,
          background: `radial-gradient(circle at ${spotlight.x}px ${spotlight.y}px, rgba(245, 197, 24, 0.12), transparent 70%)`,
        }}
      />

      {/* Bottom label with glassmorphism blur and expanding gold line */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-20 transition-all duration-300 group-hover:backdrop-blur-[2px]">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px] pointer-events-none" />
        <div className="relative z-10">
          <h3
            className="font-bold text-white text-base tracking-tight leading-tight uppercase"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.8)',
            }}
          >
            {sport.name}
          </h3>
          <div
            className="mt-1.5 h-0.5 w-6 rounded-full transition-all duration-300 ease-out group-hover:w-16"
            style={{ background: '#72751dff' }}
          />
        </div>
      </div>
    </div>
  );
}

const galleryItems = sports.map((sport) => ({
  image: sport.image,
  text: sport.name,
}));

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
        <div data-reveal className="reveal rulebook-panel rounded-[28px] border p-6 sm:p-8 md:p-10 shadow-sm"
          style={{ background: 'linear-gradient(135deg, rgba(245,197,24,0.12), rgba(255,255,255,0.9)), #fff', borderColor: 'rgba(27,94,32,0.14)' }}>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <span className="text-[10px] font-black tracking-[0.25em] uppercase" style={{ color: '#c9972f' }}>
                Rule Book
              </span>
              <h2 className="mt-3 font-black text-2xl sm:text-3xl" style={{ color: '#0a2112' }}>
                Competition rules, eligibility criteria, event regulations, and participation guidelines will be published here.
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
