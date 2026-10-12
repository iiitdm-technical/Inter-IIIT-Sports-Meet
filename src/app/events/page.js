'use client';

import { useState, useEffect, useRef } from 'react';
import SectionHeading from '@/components/SectionHeading';
import CircularGallery from './CircularGallery';
import InteractiveHeading from './InteractiveHeading';
import { sports } from '@/data/sports';
import Image from 'next/image';
import Link from 'next/link';

// Lightweight scroll-driven parallax hook
function useParallaxScroll(speed = 0.18) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return -offset * speed;
}

// Hook: drives a smooth 0→1 progress value as user scrolls through the header
function use3DScrollProgress(headerRef) {
  const progressRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const update = () => {
      const el = headerRef.current;
      if (!el) return;
      const headerH = el.offsetHeight;
      const raw = Math.min(Math.max(window.scrollY / (headerH * 0.8), 0), 1);
      progressRef.current = raw;
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        update();
        rafRef.current = null;
      });
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [headerRef]);

  return progressRef; // a ref so we can read it in rAF without re-renders
}

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

function ParallaxGrid() {
  const translateY = useParallaxScroll(200);
  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14"
      style={{
        transform: `translateY(${translateY}px)`,
        willChange: 'transform',
      }}
    >
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sports.map((sport, idx) => (
          <SportCard key={idx} sport={sport} idx={idx} />
        ))}
      </div>
    </div>
  );
}

const galleryItems = sports.map((sport) => ({
  image: sport.image,
  text: sport.name,
}));

export default function Events() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, isHovered: false });

  const handleHeaderMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      isHovered: true,
    };
  };

  const handleHeaderTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseRef.current = {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
        isHovered: true,
      };
    }
  };

  const handleHeaderLeave = () => {
    mouseRef.current = { x: -1000, y: -1000, isHovered: false };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;
    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    class Particle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : -10;
        this.radius = Math.random() * 1.5 + 0.8;
        this.baseVy = Math.random() * 0.4 + 0.25;
        this.vy = this.baseVy;
        this.vx = (Math.random() - 0.5) * 0.2;
        this.alpha = Math.random() * 0.25 + 0.15;
        const colorType = Math.random();
        if (colorType > 0.6) {
          this.color = '24, 91, 29'; // Green #185B1D
        } else if (colorType > 0.3) {
          this.color = '12, 60, 16'; // Darker green shade
        } else {
          this.color = '36, 120, 42'; // Mid green shade
        }
      }

      update(mouse) {
        // Slow downward float
        this.y += this.vy;
        this.x += this.vx;

        // Smooth cursor repulsion / dispersion
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repelRadius = 110;

        if (dist < repelRadius && mouse.isHovered) {
          const force = (repelRadius - dist) / repelRadius;
          const dirX = (dx / dist) * force * 1.8;
          const dirY = (dy / dist) * force * 1.8;
          this.vx -= dirX;
          this.vy -= dirY;
        } else {
          // Smooth return to normal downward drift
          this.vx *= 0.96;
          this.vy = this.vy * 0.95 + this.baseVy * 0.05;
        }

        // Screen boundary wrapping
        if (this.y > height + 10) this.reset();
        if (this.x < -10) this.x = width + 10;
        if (this.x > width + 10) this.x = -10;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
        ctx.fill();
      }
    }

    const count = Math.min(60, Math.max(30, Math.floor(width / 22)));
    const particles = Array.from({ length: count }, () => new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update(mouseRef.current);
        particles[i].draw();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

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

  // ── 3D Perspective Scroll ──────────────────────────────────────────────────
  const headerBannerRef = useRef(null);
  const contentSectionRef = useRef(null);
  const scrollRafRef = useRef(null);

  useEffect(() => {
    const lerp = (a, b, t) => a + (b - a) * t;
    let currentProgress = 0;

    const tick = () => {
      const header = headerBannerRef.current;
      const content = contentSectionRef.current;
      if (!header) { scrollRafRef.current = requestAnimationFrame(tick); return; }

      const headerH = header.offsetHeight;
      const rawProgress = Math.min(Math.max(window.scrollY / (headerH * 0.85), 0), 1);
      // Smooth lerp so the transform eases rather than snapping
      currentProgress = lerp(currentProgress, rawProgress, 0.1);
      const p = currentProgress;

      // Header: recede in 3D
      const rotateX = p * 14;          // 0 → 14deg tilt away
      const scale = 1 - p * 0.1;     // 1 → 0.9
      const translateZ = -p * 100;      // 0 → -100px push back
      const opacity = 1 - p * 0.62;   // 1 → 0.38

      header.style.transformOrigin = '50% 0%';
      header.style.transform =
        `perspective(1200px) rotateX(${rotateX}deg) scale(${scale}) translateZ(${translateZ}px)`;
      header.style.opacity = opacity;

      // Content: slide up over the receding header
      if (content) {
        const slideUp = p * 60;          // shift up by up to 60px
        content.style.transform = `translateY(-${slideUp}px)`;
      }

      scrollRafRef.current = requestAnimationFrame(tick);
    };

    scrollRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#F4F5EB', minHeight: '100vh', perspective: '1200px' }}>
      {/* Google Font Montserrat */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=swap"
      />

      {/* Page header banner with falling & repelling particles and crisp boundary */}
      <div
        ref={headerBannerRef}
        onMouseMove={handleHeaderMouseMove}
        onTouchMove={handleHeaderTouchMove}
        onMouseLeave={handleHeaderLeave}
        onTouchEnd={handleHeaderLeave}
        className="relative py-6 md:py-10 px-4 overflow-hidden border-b border-[#185B1D]/20"
        style={{
          background: '#F2D16D',
          willChange: 'transform, opacity',
          transformOrigin: '50% 0%',
          zIndex: 1,
        }}
      >
        {/* Falling & repelling header particles canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        <div className="relative max-w-10xl mx-auto z-20 px-4 sm:px-6 lg:px-8">

          <div className="block">
            <span className="text-xs font-bold tracking-widest uppercase text-[#0a2112]">
              9th Inter-IIIT Sports Meet · 2026
            </span>
          </div>

          {/* Interactive Heading with character hover & yellow cursor effect */}
          <div className="mt-4 max-w-4xl">
            <InteractiveHeading text="SPORTING  EVENTS" />
          </div>

          <div className="mt-4 w-14 h-1 rounded-full" style={{ background: '#185B1D' }} />

          <p className="mt-4 text-sm sm:text-base max-w-xl font-normal leading-relaxed" style={{ color: 'rgba(9, 61, 12, 0.97)' }}>
            {sports.length} competitive events testing speed, skill, strength, and strategy.
          </p>
        </div>
      </div>

      {/* Events content – slides up over the receding header */}
      <div
        ref={contentSectionRef}
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
