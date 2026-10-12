'use client';

import { useEffect, useRef } from 'react';

export default function PageHeader({ title, description, label = 'Explore', badge = '2026', badgeLabel = 'Sports Meet', children, headingTag: Heading = 'h1' }) {
  const headerRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);

  useEffect(() => {
    const header = headerRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let particles = [];
    let frame;
    let lastTime = 0;
    let progress = 0;
    const resize = () => {
      width = header.clientWidth;
      height = header.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: Math.min(60, Math.max(30, Math.floor(width / 22))) }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.8, speed: Math.random() * 0.4 + 0.25,
        vx: (Math.random() - 0.5) * 0.2, vy: 0.4, alpha: Math.random() * 0.25 + 0.15,
      }));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(header);
    resize();
    const draw = (time) => {
      const delta = lastTime ? Math.min((time - lastTime) / 16.67, 2) : 1;
      lastTime = time;
      const visible = header.getBoundingClientRect().bottom > 0;
      if (visible) {
        context.clearRect(0, 0, width, height);
        for (const particle of particles) {
          if (!motion.matches) {
            const pointer = pointerRef.current;
            const dx = pointer ? pointer.x - particle.x : 1000;
            const dy = pointer ? pointer.y - particle.y : 1000;
            const distance = Math.hypot(dx, dy);
            if (pointer && distance > 0 && distance < 110) {
              const force = (110 - distance) / 110 * 1.8;
              particle.vx -= dx / distance * force * delta;
              particle.vy -= dy / distance * force * delta;
            } else {
              particle.vx *= Math.pow(0.96, delta);
              particle.vy += (particle.speed - particle.vy) * 0.05 * delta;
            }
            particle.x = (particle.x + particle.vx * delta + width) % width;
            particle.y += particle.vy * delta;
            if (particle.y > height + 10) particle.y = -10;
            if (particle.y < -110) particle.y = height;
          }
          context.beginPath();
          context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
          context.fillStyle = `rgba(24, 91, 29, ${particle.alpha})`;
          context.fill();
        }
      }
      const target = motion.matches ? 0 : Math.min(Math.max(window.scrollY / (height * 0.85), 0), 1);
      progress += (target - progress) * 0.1;
      header.style.transform = `perspective(1200px) rotateX(${progress * 14}deg) scale(${1 - progress * 0.1}) translateZ(${-progress * 100}px)`;
      header.style.opacity = String(1 - progress * 0.62);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  return (
    <header ref={headerRef} className="page-header" onPointerMove={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      pointerRef.current = { x: (event.clientX - rect.left) * event.currentTarget.clientWidth / rect.width, y: (event.clientY - rect.top) * event.currentTarget.clientHeight / rect.height };
    }} onPointerLeave={() => { pointerRef.current = null; }} onPointerUp={() => { pointerRef.current = null; }}>
      <canvas ref={canvasRef} className="page-header__particles" aria-hidden="true" />
      <div className="page-header__content">
        <div className="page-header__badge" aria-hidden="true">
          <span className="page-header__tape" />
          <span>{label}</span><strong>{badge}</strong><span>{badgeLabel}</span>
        </div>
        <p className="page-header__eyebrow">9th All India Inter-IIIT Sports Meet · 2026</p>
        <Heading className="page-header__title">{title}</Heading>
        <div className="page-header__rule" />
        {description && <p className="page-header__description">{description}</p>}
        {children && <div className="page-header__actions">{children}</div>}
      </div>
    </header>
  );
}
