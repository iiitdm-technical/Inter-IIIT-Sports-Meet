'use client';

import { useState, useEffect, useRef } from 'react';

const CINZEL_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Cinzel+Decorative:wght@700;900&display=swap';

/**
 * Text scrambler hook
 */
function useTextScramble(targetText, duration = 450) {
  const [displayText, setDisplayText] = useState(targetText || '');

  useEffect(() => {
    if (!targetText) return;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const target = targetText.toUpperCase();
    const len = target.length;
    const startTime = performance.now();
    let animId;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const settledCount = Math.floor(progress * len);

      let result = '';
      for (let i = 0; i < len; i++) {
        if (target[i] === ' ' || target[i] === '-' || target[i] === '&') {
          result += target[i];
        } else if (i < settledCount) {
          result += target[i];
        } else {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
      }
      setDisplayText(result);

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        setDisplayText(target);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [targetText, duration]);

  return displayText;
}

/**
 * DomeGallery
 *
 * A canvas-rendered 3-D cylindrical dome gallery with active center card scaling (1.18x),
 * prominent border outline (#1C2E24), Cinzel typography, and an animated
 * Top Title display with inline word-scramble effect.
 */
export default function DomeGallery({
  items = [],
  fit = 0.8,
  minRadius = 600,
  maxVerticalRotationDeg = 0,
  segments = 24,
  dragDampening = 2,
  grayscale = false,
  fontUrl = CINZEL_FONT_URL,
  onActiveChange,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoomedItem, setZoomedItem] = useState(null);
  const zoomedItemRef = useRef(null);
  const setZoomedItemRef = useRef(setZoomedItem);
  const lastActiveIdxRef = useRef(0);
  const shiftStepRef = useRef(null);

  useEffect(() => {
    zoomedItemRef.current = zoomedItem;
    setZoomedItemRef.current = setZoomedItem;
  }, [zoomedItem]);

  const activeItem = items[activeIdx] || items[0] || { text: '' };
  const scrambledTitle = useTextScramble(activeItem.text || '', 480);

  // Close zoomed view on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setZoomedItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || items.length === 0) return;

    const ctx = canvas.getContext('2d');

    /* ── State ────────────────────────────────────────────────────────────── */
    let rotY = 0;
    let targetRotY = 0;
    let rotX = 0;
    let targetRotX = 0;
    let velY = 0;
    let isDragging = false;
    let lastMX = 0;
    let lastVelY = 0;
    let clickStartX = 0;
    let clickStartY = 0;
    let animId = null;
    let running = true;
    let wheelSnapTimer = null;

    /* ── Image loading ────────────────────────────────────────────────────── */
    const imgs = new Array(items.length).fill(null);
    items.forEach((item, i) => {
      const img = new window.Image();
      img.onload = () => {
        imgs[i] = img;
      };
      img.src = item.image;
    });

    /* ── Font loading ─────────────────────────────────────────────────────── */
    const activeFontUrl = fontUrl || CINZEL_FONT_URL;
    if (activeFontUrl && !document.querySelector(`link[href="${activeFontUrl}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = activeFontUrl;
      document.head.appendChild(link);
    }

    /* ── HiDPI-aware resize ───────────────────────────────────────────────── */
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = container.offsetWidth;
      const H = canvas.offsetHeight || 380;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(container);

    /* ── Rounded-rect path ────────────────────────────────────────────────── */
    const rrPath = (x, y, w, h, r) => {
      const sr = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + sr, y);
      ctx.lineTo(x + w - sr, y);
      ctx.arcTo(x + w, y, x + w, y + sr, sr);
      ctx.lineTo(x + w, y + h - sr);
      ctx.arcTo(x + w, y + h, x + w - sr, y + h, sr);
      ctx.lineTo(x + sr, y + h);
      ctx.arcTo(x, y + h, x, y + h - sr, sr);
      ctx.lineTo(x, y + sr);
      ctx.arcTo(x, y, x + sr, y, sr);
      ctx.closePath();
    };

    let latestProjected = [];

    /* ── Draw frame ───────────────────────────────────────────────────────── */
    const draw = () => {
      const W = container.offsetWidth;
      const H = canvas.offsetHeight || 380;
      ctx.clearRect(0, 0, W, H);

      const radius = Math.max(minRadius, W * 0.5);
      const focal = Math.max(W, H) * 1.0;
      const angleStep = (Math.PI * 2) / segments;

      // Provide step shift for navigation buttons
      shiftStepRef.current = (dir) => {
        targetRotY += dir * angleStep;
      };

      // Build projections
      const projected = [];
      for (let s = 0; s < segments; s++) {
        const angle = angleStep * s + rotY;

        // 3-D position on cylinder surface
        const x3 = radius * Math.sin(angle);
        const z3 = radius * Math.cos(angle);
        const y3 = -radius * Math.sin(rotX) * 0.25;

        // Perspective depth
        const depth = z3 + radius;
        if (depth < radius * 0.15) continue;

        const depthFactor = focal / (focal + (2 * radius - depth) * 0.6);
        const screenX = W / 2 + x3 * depthFactor;
        const screenY = H / 2 + y3 * depthFactor;

        // Card size in screen space
        const rawSlotW = ((2 * Math.PI * radius) / segments) * fit * depthFactor;
        const rawSlotH = rawSlotW * 0.67;

        // Normalized depth (0 = back, 1 = front center)
        const nd = depth / (2 * radius);
        const alpha = Math.max(0, Math.min(1, nd * 2 - 0.3));

        // Grayscale
        const gsPct = grayscale ? Math.max(0, Math.min(100, Math.round((1 - nd * 1.6) * 100))) : 0;

        const itemIdx = s % items.length;

        projected.push({
          s,
          itemIdx,
          screenX,
          screenY,
          slotW: rawSlotW,
          slotH: rawSlotH,
          depth,
          nd,
          alpha,
          gsPct,
        });
      }

      // Track frontmost active card
      let frontItemIdx = 0;
      let maxDepth = -Infinity;
      for (const p of projected) {
        if (p.depth > maxDepth) {
          maxDepth = p.depth;
          frontItemIdx = p.itemIdx;
        }
      }

      if (frontItemIdx !== lastActiveIdxRef.current) {
        lastActiveIdxRef.current = frontItemIdx;
        setActiveIdx(frontItemIdx);
        onActiveChange?.(frontItemIdx);
      }

      // Sort back-to-front
      projected.sort((a, b) => a.depth - b.depth);
      latestProjected = projected;

      for (const p of projected) {
        if (p.alpha < 0.03 || p.slotW < 4) continue;

        // Center Scaling: Smoothly scales up to 1.18x as card approaches frontmost position
        const centerT = Math.max(0, Math.min(1, (p.nd - 0.78) / 0.22));
        const easeCenter = centerT * centerT * (3 - 2 * centerT);
        const scaleMultiplier = 1 + 0.18 * easeCenter;

        const curW = p.slotW * scaleMultiplier;
        const curH = p.slotH * scaleMultiplier;
        const dX = p.screenX - curW / 2;
        const dY = p.screenY - curH / 2 - easeCenter * 6;
        const cr = Math.max(4, 0.06 * Math.min(curW, curH));

        // Prominent border outline for middle/front card (2px solid #1C2E24)
        if (easeCenter > 0.08) {
          ctx.save();
          ctx.globalAlpha = p.alpha * easeCenter;

          const pad = 4 * easeCenter;
          const bX = dX - pad;
          const bY = dY - pad;
          const bW = curW + pad * 2;
          const bH = curH + pad * 2;
          const bRadius = cr + pad * 0.8;

          ctx.shadowColor = 'rgba(28, 46, 36, 0.45)';
          ctx.shadowBlur = 18 * easeCenter;
          ctx.shadowOffsetY = 4 * easeCenter;

          ctx.strokeStyle = '#1C2E24';
          ctx.lineWidth = 2.5;
          rrPath(bX, bY, bW, bH, bRadius);
          ctx.stroke();

          // Gold inner hairline accent
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = 'rgba(245, 197, 24, 0.8)';
          ctx.lineWidth = 1;
          rrPath(dX, dY, curW, curH, cr);
          ctx.stroke();

          ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;

        /* Card clip */
        rrPath(dX, dY, curW, curH, cr);
        ctx.clip();

        /* Image or placeholder */
        const img = imgs[p.itemIdx];
        if (img && img.complete && img.naturalWidth > 0) {
          if (p.gsPct > 0) ctx.filter = `grayscale(${p.gsPct}%)`;
          ctx.drawImage(img, dX, dY, curW, curH);
          ctx.filter = 'none';
        } else {
          const pg = ctx.createLinearGradient(dX, dY, dX, dY + curH);
          pg.addColorStop(0, '#1C2E24');
          pg.addColorStop(1, '#0b1610');
          ctx.fillStyle = pg;
          ctx.fillRect(dX, dY, curW, curH);
        }

        /* Bottom scrim */
        const scrim = ctx.createLinearGradient(dX, dY + curH * 0.45, dX, dY + curH);
        scrim.addColorStop(0, 'rgba(0,0,0,0)');
        scrim.addColorStop(1, 'rgba(10,25,18,0.92)');
        ctx.fillStyle = scrim;
        ctx.fillRect(dX, dY, curW, curH);

        ctx.restore();

        /* Gold accent bar */
        if (p.nd > 0.52) {
          const barAlpha = Math.min(1, (p.nd - 0.52) / 0.3);
          ctx.save();
          ctx.globalAlpha = p.alpha * barAlpha * 0.9;
          ctx.fillStyle = '#f5c518';
          ctx.fillRect(dX + curW * 0.08, dY + curH - 3 * p.nd, curW * 0.3, 2 * p.nd);
          ctx.restore();
        }

        /* Text label in Cinzel font */
        if (p.nd > 0.55 && curW > 60) {
          const tAlpha = Math.min(1, (p.nd - 0.55) / 0.3);
          // Label on card softens as focus moves to Top Title Display
          const cardLabelAlpha = p.alpha * tAlpha * Math.max(0.18, 1 - easeCenter * 0.82);
          const fs = Math.max(8, Math.round(curW * 0.088));
          ctx.save();
          ctx.globalAlpha = cardLabelAlpha;
          ctx.font = `bold ${fs}px 'Cinzel Decorative', 'Cinzel', serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = 'rgba(0,0,0,0.95)';
          ctx.shadowBlur = 7;
          ctx.fillText(items[p.itemIdx].text.toUpperCase(), p.screenX, dY + curH - 8);
          ctx.restore();
        }
      }
    };

    /* ── Animation loop ───────────────────────────────────────────────────── */
    const snapToNearestAngle = () => {
      const angleStep = (Math.PI * 2) / segments;
      const nearestSegment = Math.round(targetRotY / angleStep);
      targetRotY = nearestSegment * angleStep;
    };

    const animate = () => {
      if (!running) return;

      if (!isDragging) {
        velY *= 1 - Math.min(0.99, dragDampening * 0.04);
        targetRotY += velY;
      }

      rotY += (targetRotY - rotY) * 0.13;
      rotX += (targetRotX - rotX) * 0.13;

      draw();
      animId = requestAnimationFrame(animate);
    };
    animate();

    /* ── Mouse input ──────────────────────────────────────────────────────── */
    const onMouseDown = (e) => {
      isDragging = true;
      lastMX = e.clientX;
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      velY = 0;
      lastVelY = 0;
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMX;
      const delta = dx * 0.004;
      targetRotY += delta;
      lastVelY = delta;
      lastMX = e.clientX;
    };

    const onMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      velY = lastVelY;
      canvas.style.cursor = 'grab';

      const moved = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
      if (moved < 6) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        for (let idx = latestProjected.length - 1; idx >= 0; idx--) {
          const p = latestProjected[idx];
          const curW = p.slotW * 1.15;
          const curH = p.slotH * 1.15;
          const dX = p.screenX - curW / 2;
          const dY = p.screenY - curH / 2;

          if (clickX >= dX && clickX <= dX + curW && clickY >= dY && clickY <= dY + curH) {
            const isFrontCard = p.itemIdx === lastActiveIdxRef.current || p.nd > 0.88;
            if (isFrontCard) {
              if (setZoomedItemRef.current) {
                setZoomedItemRef.current(items[p.itemIdx]);
              } else {
                setZoomedItem(items[p.itemIdx]);
              }
            } else {
              const angleStep = (Math.PI * 2) / segments;
              const targetAngle = -p.s * angleStep;
              targetRotY = targetAngle;
            }
            break;
          }
        }
      } else {
        snapToNearestAngle();
      }
    };

    /* ── Wheel input ──────────────────────────────────────────────────────── */
    const onWheel = (e) => {
      e.preventDefault();
      targetRotY += (e.deltaX + e.deltaY) * 0.002;
      clearTimeout(wheelSnapTimer);
      wheelSnapTimer = setTimeout(snapToNearestAngle, 220);
    };

    /* ── Touch input ──────────────────────────────────────────────────────── */
    let touchLastX = 0;
    const onTouchStart = (e) => {
      isDragging = true;
      touchLastX = e.touches[0].clientX;
      clickStartX = e.touches[0].clientX;
      clickStartY = e.touches[0].clientY;
      velY = 0;
      lastVelY = 0;
    };

    const onTouchMove = (e) => {
      const dx = e.touches[0].clientX - touchLastX;
      const delta = dx * 0.004;
      targetRotY += delta;
      lastVelY = delta;
      touchLastX = e.touches[0].clientX;
    };

    const onTouchEnd = (e) => {
      isDragging = false;
      velY = lastVelY;

      const touch = e.changedTouches && e.changedTouches[0];
      if (touch) {
        const moved = Math.hypot(touch.clientX - clickStartX, touch.clientY - clickStartY);
        if (moved < 8) {
          const rect = canvas.getBoundingClientRect();
          const clickX = touch.clientX - rect.left;
          const clickY = touch.clientY - rect.top;

          for (let idx = latestProjected.length - 1; idx >= 0; idx--) {
            const p = latestProjected[idx];
            const curW = p.slotW * 1.15;
            const curH = p.slotH * 1.15;
            const dX = p.screenX - curW / 2;
            const dY = p.screenY - curH / 2;

            if (clickX >= dX && clickX <= dX + curW && clickY >= dY && clickY <= dY + curH) {
              const isFrontCard = p.itemIdx === lastActiveIdxRef.current || p.nd > 0.88;
              if (isFrontCard) {
                if (setZoomedItemRef.current) {
                  setZoomedItemRef.current(items[p.itemIdx]);
                } else {
                  setZoomedItem(items[p.itemIdx]);
                }
              } else {
                const angleStep = (Math.PI * 2) / segments;
                const targetAngle = -p.s * angleStep;
                targetRotY = targetAngle;
              }
              break;
            }
          }
        } else {
          snapToNearestAngle();
        }
      } else {
        snapToNearestAngle();
      }
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      clearTimeout(wheelSnapTimer);
      ro?.disconnect();
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [
    items,
    fit,
    minRadius,
    maxVerticalRotationDeg,
    segments,
    dragDampening,
    grayscale,
    fontUrl,
    onActiveChange,
  ]);

  const handlePrev = () => {
    shiftStepRef.current?.(1);
  };

  const handleNext = () => {
    shiftStepRef.current?.(-1);
  };

  return (
    <div
      ref={containerRef}
      className="w-full relative select-none flex flex-col items-center"
      style={{
        transition: 'transform 0.4s ease, border 0.3s ease',
      }}
    >
      {/* Google Fonts Link */}
      <link rel="stylesheet" href={fontUrl || CINZEL_FONT_URL} />

      {/* Top Title Display Area */}
      <div className="w-full flex flex-col items-center justify-center pt-1 pb-4 text-center">
        {/* Eyebrow / Counter */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="h-px w-6 bg-[#1C2E24]/30" />
          <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#1C2E24]/75">
            EVENT {String(activeIdx + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
          <span className="h-px w-6 bg-[#1C2E24]/30" />
        </div>

        {/* Word Shuffle Title with smooth position shift upward */}
        <div className="relative overflow-hidden min-h-[46px] flex items-center justify-center px-4">
          <h2
            key={activeIdx}
            className="text-2xl sm:text-3xl md:text-4xl font-black tracking-wider uppercase text-[#1C2E24]"
            style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              animation: 'sportTitleShift 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              textShadow: '0 2px 10px rgba(28, 46, 36, 0.12)',
            }}
          >
            {scrambledTitle}
          </h2>
        </div>

        {/* Accent indicator */}
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-1 w-1.5 rounded-full bg-[#1C2E24]" />
          <div className="h-0.5 w-12 rounded-full bg-[#f5c518]" />
          <div className="h-1 w-1.5 rounded-full bg-[#1C2E24]" />
        </div>
      </div>

      {/* Dome Canvas & Navigation Controls */}
      <div className="relative w-full" style={{ height: '380px' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

        {/* Left Arrow Button */}
        <button
          onClick={handlePrev}
          type="button"
          aria-label="Previous sport"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1C2E24]/85 hover:bg-[#1C2E24] text-[#F4F5EB] flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 z-20 backdrop-blur-sm border border-[#f5c518]/50 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Right Arrow Button */}
        <button
          onClick={handleNext}
          type="button"
          aria-label="Next sport"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1C2E24]/85 hover:bg-[#1C2E24] text-[#F4F5EB] flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 z-20 backdrop-blur-sm border border-[#f5c518]/50 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Exploration hint */}
      <p
        style={{
          marginTop: '12px',
          color: '#1C2E24',
          opacity: 0.6,
          fontSize: '11px',
          fontFamily: "'Cinzel', serif",
          letterSpacing: '0.18em',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}
      >
        Click center card to zoom · drag to rotate events
      </p>

      {/* Interactive Center-Card Zoomed / Lightbox View */}
      {zoomedItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/80 backdrop-blur-md transition-opacity duration-300"
          style={{ animation: 'lightboxFade 0.25s ease-out' }}
          onClick={() => setZoomedItem(null)} // Dismiss / shrink on outside click
        >
          <div
            className="relative max-w-xl w-full bg-[#1C2E24] border-2 border-[#f5c518] rounded-2xl overflow-hidden shadow-2xl transition-transform duration-300"
            style={{
              animation: 'lightboxZoom 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on card itself
          >
            {/* Close button */}
            <button
              onClick={() => setZoomedItem(null)}
              aria-label="Close zoomed view"
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-[#F4F5EB] flex items-center justify-center border border-white/20 transition-all duration-200 hover:scale-110 cursor-pointer shadow-lg"
            >
              ✕
            </button>

            {/* High-res card image */}
            <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-black/40">
              <img
                src={zoomedItem.image}
                alt={zoomedItem.text}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C2E24] via-transparent to-transparent" />
            </div>

            {/* Content info */}
            <div className="p-6 pt-2 bg-[#1C2E24]">
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#f5c518] uppercase">
                All India Inter-IIIT Sports Meet 2026
              </span>
              <h3
                className="text-2xl sm:text-3xl font-black uppercase tracking-wide mt-1"
                style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", color: '#ffffff', opacity: 1 }}
              >
                {zoomedItem.text}
              </h3>
              <p className="mt-3 text-xs sm:text-sm text-white/75 leading-relaxed font-light">
                Official competitive event of the 9th All India Inter-IIIT Sports Meet at IIITDM Kancheepuram. Click outside or press Esc to return.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animation for title shift & lightbox */}
      <style jsx>{`
        @keyframes sportTitleShift {
          0% {
            transform: translateY(16px) scale(0.96);
            opacity: 0.1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes lightboxFade {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes lightboxZoom {
          0% {
            transform: scale(0.85);
            opacity: 0.5;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
