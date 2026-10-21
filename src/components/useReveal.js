'use client';

import { useEffect } from 'react';

/**
 * Hides below-the-fold `[data-reveal]` blocks only after mount, animates them
 * in on scroll, and reveals everything after a short fallback delay so content
 * is never left invisible. Does nothing for reduced-motion users.
 */
export default function useReveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!items.length || !('IntersectionObserver' in window)) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const show = (element) => element.classList.add('is-visible');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          show(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach((item) => {
      if (item.getBoundingClientRect().top < window.innerHeight) return;
      item.classList.add('reveal');
      observer.observe(item);
    });
    const fallback = window.setTimeout(() => items.forEach(show), 2500);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);
}
