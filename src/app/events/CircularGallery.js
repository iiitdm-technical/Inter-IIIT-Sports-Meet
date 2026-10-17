'use client';

import { useState, useEffect, useRef } from 'react';

// Canvas text can't use CSS variables, so read the family next/font defined
// for the site's display face and fall back to a condensed system font.
function getDisplayFontFamily() {
  if (typeof window === 'undefined') return "'Arial Narrow', sans-serif";
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-barlow-condensed').trim();
  return family || "'Barlow Condensed', 'Arial Narrow', sans-serif";
}

/**
 * Text scrambler hook
 * Cycles random glyphs and resolves characters left-to-right over duration ms
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
 * CircularGallery
 *
 * A canvas-rendered infinite horizontal gallery with cylindrical projection,
 * active center card scaling (1.18x), prominent border outline, and an
 * animated Top Title display with inline word-scramble effect. Card labels
 * use the site's display font (Barlow Condensed).
 */
export default function CircularGallery({
  items = [],
  bend = 3,
  textColor = '#ffffff',
  borderRadius = 0.05,
  scrollEase = 0.1,
  fontSize = 26,
  fontWeight = 700,
  scrollSpeed = 2,
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

    // Scroll state
    let scrollX = 0;
    let targetScrollX = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let touchStartX = 0;
    let touchStartScroll = 0;
    let clickStartX = 0;
    let clickStartY = 0;
    let animId = null;
    let running = true;
    let wheelSnapTimer = null;

    // Image preloading
    const loadedImages = new Array(items.length).fill(null);
    items.forEach((item, i) => {
      const img = new window.Image();
      img.onload = () => {
        loadedImages[i] = img;
      };
      img.src = item.image;
    });

    // The display font is self-hosted by next/font; make sure the weight the
    // canvas draws with is loaded. The draw loop picks it up once ready.
    const fontFamily = getDisplayFontFamily();
    document.fonts?.load(`${fontWeight} ${fontSize}px ${fontFamily}`).catch(() => {});

    // HiDPI-aware resize
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = container.offsetWidth;
      const H = canvas.offsetHeight || 360;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(container);

    // Rounded rect path helper
    const clipRoundedRect = (x, y, w, h, r) => {
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

    let latestDrawList = [];

    const draw = () => {
      const W = container.offsetWidth;
      const H = canvas.offsetHeight || 360;
      ctx.clearRect(0, 0, W, H);

      const CARD_W = Math.min(320, Math.max(170, W * 0.22));
      const CARD_H = CARD_W * 0.65;
      const GAP = Math.round(CARD_W * 0.1);
      const STEP = CARD_W + GAP;
      const TOTAL = items.length * STEP;

      // Provide shift controls to parent buttons
      shiftStepRef.current = (dir) => {
        targetScrollX += dir * STEP;
        const nearest = Math.round(targetScrollX / STEP);
        targetScrollX = nearest * STEP;
      };

      const clampedBend = Math.max(0.01, bend);
      const cylinderR = TOTAL / (2 * Math.PI * clampedBend * 0.55);

      const baseFontSize = fontSize;

      // Build draw list with depth for proper z-ordering
      const drawList = items.map((item, i) => {
        const rawX = i * STEP;
        let relX = ((rawX - scrollX) % TOTAL + TOTAL) % TOTAL;
        if (relX > TOTAL / 2) relX -= TOTAL;

        const screenCX = W / 2 + relX;
        const angle = relX / cylinderR;
        const cosA = Math.cos(angle);
        const scale = Math.max(0, cosA);
        const yOffset = (1 - cosA) * H * 0.14;

        return { i, item, screenCX, scale, cosA, relX, yOffset };
      });

      // Track active center card index
      let closestIdx = 0;
      let minAbsRelX = Infinity;
      for (const d of drawList) {
        const absX = Math.abs(d.relX);
        if (absX < minAbsRelX) {
          minAbsRelX = absX;
          closestIdx = d.i;
        }
      }

      if (closestIdx !== lastActiveIdxRef.current) {
        lastActiveIdxRef.current = closestIdx;
        setActiveIdx(closestIdx);
        onActiveChange?.(closestIdx);
      }

      // Sort back-to-front
      drawList.sort((a, b) => a.cosA - b.cosA);
      latestDrawList = drawList;

      for (const { i, item, screenCX, scale, relX, yOffset } of drawList) {
        if (scale <= 0.04) continue;

        // Smooth proximity to center: 0 = far, 1 = dead center
        const normDist = Math.min(1, Math.abs(relX) / (STEP * 0.9));
        const centerFactor = Math.max(0, 1 - normDist);
        const easeCenter = centerFactor * centerFactor * (3 - 2 * centerFactor);

        // Center Scaling: Smoothly scales up to 1.18x (in range 1.15 to 1.2)
        const scaleMultiplier = 1 + 0.18 * easeCenter;
        const finalScale = scale * scaleMultiplier;

        const img = loadedImages[i];
        const dW = CARD_W * finalScale;
        const dH = CARD_H * finalScale;
        const dX = screenCX - dW / 2;
        const dY = (H - dH) / 2 + yOffset - easeCenter * 6;
        const radius = borderRadius * Math.min(dW, dH);

        // Middle Card Border & Glow for centered active card
        if (easeCenter > 0.06) {
          ctx.save();
          ctx.globalAlpha = easeCenter;

          // Outer shadow
          ctx.shadowColor = 'rgba(28, 46, 36, 0.45)';
          ctx.shadowBlur = 18 * easeCenter;
          ctx.shadowOffsetY = 4 * easeCenter;

          // Prominent outline with padding (2px solid #1C2E24)
          const pad = 4 * easeCenter;
          const bX = dX - pad;
          const bY = dY - pad;
          const bW = dW + pad * 2;
          const bH = dH + pad * 2;
          const bRadius = radius + pad * 0.8;

          ctx.strokeStyle = '#1C2E24';
          ctx.lineWidth = 2.5;
          clipRoundedRect(bX, bY, bW, bH, bRadius);
          ctx.stroke();

          // Clean gold hairline accent
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = 'rgba(245, 197, 24, 0.8)';
          ctx.lineWidth = 1;
          clipRoundedRect(dX, dY, dW, dH, radius);
          ctx.stroke();

          ctx.restore();
        }

        // Draw card image
        ctx.save();
        clipRoundedRect(dX, dY, dW, dH, radius);
        ctx.clip();

        if (img && img.complete && img.naturalWidth > 0) {
          // Fill the card without stretching the original photograph.
          const imageRatio = img.naturalWidth / img.naturalHeight;
          const cardRatio = dW / dH;
          const sourceWidth = imageRatio > cardRatio ? img.naturalHeight * cardRatio : img.naturalWidth;
          const sourceHeight = imageRatio > cardRatio ? img.naturalHeight : img.naturalWidth / cardRatio;
          ctx.drawImage(
            img,
            (img.naturalWidth - sourceWidth) / 2,
            (img.naturalHeight - sourceHeight) / 2,
            sourceWidth,
            sourceHeight,
            dX, dY, dW, dH
          );
        } else {
          // Placeholder gradient
          const pg = ctx.createLinearGradient(dX, dY, dX, dY + dH);
          pg.addColorStop(0, '#1C2E24');
          pg.addColorStop(1, '#0b1610');
          ctx.fillStyle = pg;
          ctx.fillRect(dX, dY, dW, dH);
        }

        // Bottom gradient overlay for readability
        const scrim = ctx.createLinearGradient(dX, dY + dH * 0.58, dX, dY + dH);
        scrim.addColorStop(0, 'rgba(0,0,0,0)');
        scrim.addColorStop(1, 'rgba(10,25,18,0.86)');
        ctx.fillStyle = scrim;
        ctx.fillRect(dX, dY, dW, dH);

        ctx.restore();

        // Card sport title (fades as focus transfers up to Top Title Display)
        if (finalScale > 0.28) {
          const baseAlpha = Math.min(1, (finalScale - 0.28) / 0.22);
          const cardLabelAlpha = baseAlpha;
          const scaledSize = Math.max(9, Math.round(baseFontSize * finalScale * 0.82));

          ctx.save();
          ctx.globalAlpha = cardLabelAlpha;
          ctx.font = `${fontWeight} ${scaledSize}px ${fontFamily}`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = 'rgba(0,0,0,0.95)';
          ctx.shadowBlur = 8 * finalScale;
          ctx.fillText(item.text.toUpperCase(), screenCX, dY + dH - 20 * finalScale);
          ctx.restore();
        }
      }
    };

    const snapToNearest = () => {
      const W = container.offsetWidth;
      const CARD_W = Math.min(320, Math.max(170, W * 0.22));
      const STEP = CARD_W + Math.round(CARD_W * 0.1);
      const nearest = Math.round(targetScrollX / STEP);
      targetScrollX = nearest * STEP;
    };

    const animate = () => {
      if (!running) return;
      scrollX += (targetScrollX - scrollX) * Math.min(1, scrollEase);
      draw();
      animId = requestAnimationFrame(animate);
    };
    animate();

    // Wheel
    const onWheel = (e) => {
      e.preventDefault();
      targetScrollX += (e.deltaX + e.deltaY) * scrollSpeed * 0.75;
      clearTimeout(wheelSnapTimer);
      wheelSnapTimer = setTimeout(snapToNearest, 200);
    };

    // Mouse drag & click-to-center
    const onMouseDown = (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartScroll = targetScrollX;
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      targetScrollX = dragStartScroll - (e.clientX - dragStartX) * scrollSpeed;
    };

    const onMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      canvas.style.cursor = 'grab';

      // Check if this was a click rather than a drag
      const moved = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
      if (moved < 6) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Search front-to-back in latestDrawList
        for (let idx = latestDrawList.length - 1; idx >= 0; idx--) {
          const item = latestDrawList[idx];
          const W = container.offsetWidth;
          const CARD_W = Math.min(320, Math.max(170, W * 0.22));
          const CARD_H = CARD_W * 0.65;
          const normDist = Math.min(1, Math.abs(item.relX) / (CARD_W * 1.1));
          const easeCenter = Math.max(0, 1 - normDist);
          const finalScale = item.scale * (1 + 0.18 * easeCenter);
          const dW = CARD_W * finalScale;
          const dH = CARD_H * finalScale;
          const dX = item.screenCX - dW / 2;
          const dY = (canvas.offsetHeight - dH) / 2 + item.yOffset;

          if (clickX >= dX && clickX <= dX + dW && clickY >= dY && clickY <= dY + dH) {
            const isCenterCard =
              Math.abs(item.relX) < CARD_W * 0.45 || item.i === lastActiveIdxRef.current;
            if (isCenterCard) {
              if (setZoomedItemRef.current) {
                setZoomedItemRef.current(item.item);
              } else {
                setZoomedItem(item.item);
              }
            } else {
              targetScrollX += item.relX;
              snapToNearest();
            }
            break;
          }
        }
      } else {
        snapToNearest();
      }
    };

    // Touch events
    const onTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartScroll = targetScrollX;
      clickStartX = e.touches[0].clientX;
      clickStartY = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      targetScrollX = touchStartScroll - (e.touches[0].clientX - touchStartX) * scrollSpeed;
    };

    const onTouchEnd = (e) => {
      const touch = e.changedTouches && e.changedTouches[0];
      if (touch) {
        const moved = Math.hypot(touch.clientX - clickStartX, touch.clientY - clickStartY);
        if (moved < 8) {
          const rect = canvas.getBoundingClientRect();
          const clickX = touch.clientX - rect.left;
          const clickY = touch.clientY - rect.top;

          for (let idx = latestDrawList.length - 1; idx >= 0; idx--) {
            const item = latestDrawList[idx];
            const W = container.offsetWidth;
            const CARD_W = Math.min(320, Math.max(170, W * 0.22));
            const CARD_H = CARD_W * 0.65;
            const finalScale = item.scale * 1.15;
            const dW = CARD_W * finalScale;
            const dH = CARD_H * finalScale;
            const dX = item.screenCX - dW / 2;
            const dY = (canvas.offsetHeight - dH) / 2 + item.yOffset;

            if (clickX >= dX && clickX <= dX + dW && clickY >= dY && clickY <= dY + dH) {
              const isCenterCard =
                Math.abs(item.relX) < CARD_W * 0.45 || item.i === lastActiveIdxRef.current;
              if (isCenterCard) {
                if (setZoomedItemRef.current) {
                  setZoomedItemRef.current(item.item);
                } else {
                  setZoomedItem(item.item);
                }
              } else {
                targetScrollX += item.relX;
                snapToNearest();
              }
              break;
            }
          }
        } else {
          snapToNearest();
        }
      } else {
        snapToNearest();
      }
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      clearTimeout(wheelSnapTimer);
      ro?.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [items, bend, textColor, borderRadius, scrollEase, fontSize, fontWeight, scrollSpeed, onActiveChange]);

  const handlePrev = () => {
    shiftStepRef.current?.(-1);
  };

  const handleNext = () => {
    shiftStepRef.current?.(1);
  };

  return (
    <div
      ref={containerRef}
      className="w-full relative select-none flex flex-col items-center"
      style={{
        transition: 'transform 0.4s ease, border 0.3s ease',
      }}
    >
      {/* Top Title Display Area */}
      <div className="w-full flex flex-col items-center justify-center pt-1 pb-4 text-center">
        {/* Eyebrow / Counter */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="h-px w-8 bg-brand-accent" aria-hidden="true" />
          <span className="eyebrow">
            Event {String(activeIdx + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
          <span className="h-px w-8 bg-brand-accent" aria-hidden="true" />
        </div>

        {/* Word Shuffle Title with smooth position shift upward */}
        <div className="relative overflow-hidden min-h-[46px] flex items-center justify-center px-4">
          <h2
            key={activeIdx}
            className="heading-display text-4xl sm:text-5xl md:text-6xl text-ink"
            style={{
              animation: 'sportTitleShift 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {scrambledTitle}
          </h2>
        </div>

        {/* Triple accent indicator */}
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-1 w-1.5 rounded-full bg-brand-primary" />
          <div className="h-1 w-12 rounded-full bg-brand-highlight" />
          <div className="h-1 w-1.5 rounded-full bg-brand-primary" />
        </div>
      </div>

      {/* Carousel Canvas & Navigation Controls */}
      <div className="relative w-full" style={{ height: '360px' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

        {/* Left Arrow Button */}
        <button
          onClick={handlePrev}
          type="button"
          aria-label="Previous sport"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-brand-dark/90 hover:bg-brand-primary text-white flex items-center justify-center shadow-lift transition-colors duration-200 z-20 border border-brand-highlight/60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
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
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-brand-dark/90 hover:bg-brand-primary text-white flex items-center justify-center shadow-lift transition-colors duration-200 z-20 border border-brand-highlight/60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Exploration hint */}
      <p className="meta mt-3 select-none text-center px-4">
        Click center card to zoom · drag or click sides to rotate
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
            className="relative max-w-xl w-full bg-brand-dark border border-brand-highlight/70 rounded-card overflow-hidden shadow-lift transition-transform duration-300"
            style={{
              animation: 'lightboxZoom 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the card itself
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setZoomedItem(null)}
              aria-label="Close zoomed view"
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/25 transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-highlight"
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
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent" />
            </div>

            {/* Content info */}
            <div className="p-6 pt-2 bg-brand-dark">
              <span className="eyebrow text-brand-highlight">
                All India Inter-IIIT Sports Meet 2026
              </span>
              <h3 className="heading-display text-4xl sm:text-5xl mt-1 text-white">
                {zoomedItem.text}
              </h3>
              <p className="mt-3 text-sm text-white/80 leading-relaxed">
                Official competitive event of the 9th All India Inter-IIIT Sports Meet at IIITDM Kancheepuram. Click outside or press Esc to return.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
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
