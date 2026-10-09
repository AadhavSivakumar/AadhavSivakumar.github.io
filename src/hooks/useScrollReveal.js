import { useEffect, useRef } from 'react';

// Fade/rise (and optional scale) reveal, triggered the first time the element
// scrolls into view. It is the browser's own Web Animations API (el.animate):
// anime.js drove it until Oct 9, when the owner had anime.js taken out; the
// numbers are the same (outQuint, the same distances and durations), and an
// opacity/transform animation like this runs on the compositor.
//
// During the entrance the element's CSS transitions are suppressed inline
// (transition: none) so a CSS transform-transition — e.g. a card's hover lift
// — can't fight it; on completion the animation is removed and the inline
// transition cleared, so CSS (and a card's motion tilt, which writes the
// inline transform) take the element back over.
//
// delay is accepted in SECONDS to match the old motion call sites.
const OUT_QUINT = 'cubic-bezier(0.22, 1, 0.36, 1)';

export default function useScrollReveal({
  y = 28,
  scale = null,
  delay = 0,
  duration = 700,
  amount = 0.2,
  onComplete,
} = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // Respect reduced-motion: show immediately, animate nothing.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof el.animate !== 'function') {
      onComplete && onComplete(el);
      return undefined;
    }

    el.style.opacity = '0';
    let anim = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        el.style.transition = 'none';
        const from = [y ? `translateY(${y}px)` : '', scale != null ? `scale(${scale})` : ''].join(' ').trim() || 'none';
        anim = el.animate(
          [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
          { duration, delay: delay * 1000, easing: OUT_QUINT, fill: 'backwards' }
        );
        el.style.opacity = '';      // the animation holds it at 0 through the delay
        anim.onfinish = () => {
          // Hand the element back to CSS (hover/tap transitions resume).
          el.style.transition = '';
          anim = null;
          onComplete && onComplete(el);
        };
      },
      { threshold: amount }
    );
    observer.observe(el);
    return () => { observer.disconnect(); if (anim) anim.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
