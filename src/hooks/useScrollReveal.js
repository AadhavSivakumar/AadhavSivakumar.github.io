import { useEffect, useRef } from 'react';
import { animate } from 'animejs';

// Fade/rise (and optional scale) reveal driven by anime.js, triggered the
// first time the element scrolls into view. Same trigger pattern as
// SectionTitle (IntersectionObserver) so scroll animations across the site
// share one engine.
//
// During the entrance the element's CSS transitions are suppressed inline
// (transition: none) so a CSS transform-transition — e.g. a card's hover lift
// — can't fight anime's per-frame writes; on completion the inline
// transform/opacity/transition are cleared so CSS takes the element back over
// (hover/tap states resume working).
//
// delay is accepted in SECONDS to match the old motion call sites.
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
    if (!el) return;

    // Respect reduced-motion: show immediately, animate nothing.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      onComplete && onComplete(el);
      return;
    }

    el.style.opacity = '0';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        el.style.transition = 'none';
        const props = {
          opacity: [0, 1],
          duration,
          delay: delay * 1000,
          ease: 'outQuint',
          onComplete: () => {
            // Hand the element back to CSS (hover/tap transitions resume).
            el.style.transform = '';
            el.style.opacity = '';
            el.style.transition = '';
            onComplete && onComplete(el);
          },
        };
        if (y) props.y = [y, 0];
        if (scale != null) props.scale = [scale, 1];
        animate(el, props);
      },
      { threshold: amount }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
