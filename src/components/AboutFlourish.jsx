import React, { useEffect, useRef } from 'react';
import { animate, createTimeline, stagger, svg } from 'animejs';

// Decorative anime.js motif flanking the About section — one per side. Two
// layers of motion:
//   1. Seamless ambient loops (always running): concentric rings rotate
//      (opposite ways per side), the guide lines flow via an animated dash,
//      and the dots pulse.
//   2. Scroll-reactive: as the About section scrolls through the viewport the
//      whole motif travels downward to follow the screen, and its central
//      shape morphs (hexagon -> triangle -> diamond) via anime.js
//      `svg.morphTo`, scrubbed by scroll position with `timeline.seek` — the
//      same scroll-scrub pattern used by ScrollProgress.
const DOTS = [
  [34, 210], [80, 244], [126, 198], [52, 306],
  [110, 336], [80, 392], [34, 372], [126, 300],
];

const FLOURISH_H = 440; // must match .about-flourish height in App.css
const MORPH_DUR = 200;  // virtual timeline length the scroll ratio maps onto

// Central morph shapes, all centered on (80, 98) within the 160x440 viewBox.
const HEX = 'M80 68 L106 83 L106 113 L80 128 L54 113 L54 83 Z';
const TRI = 'M80 64 L108 116 L52 116 Z';
const DIA = 'M80 64 L114 98 L80 132 L46 98 Z';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function AboutFlourish({ side = 'left' }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Ambient seamless loops (skipped when the user prefers reduced motion).
    const loops = reduce ? [] : [
      animate(root.querySelectorAll('.flr-ring'), {
        rotate: side === 'left' ? 360 : -360,
        duration: 26000, loop: true, ease: 'linear',
      }),
      animate(root.querySelectorAll('.flr-line'), {
        // 160 is a whole multiple of the 16px dash period -> seamless flow.
        strokeDashoffset: [0, side === 'left' ? -160 : 160],
        duration: 4200, delay: stagger(500), loop: true, ease: 'linear',
      }),
      animate(root.querySelectorAll('.flr-dot'), {
        scale: [0.55, 1.35], opacity: [0.2, 0.9],
        duration: 1900, delay: stagger(220), loop: true, alternate: true, ease: 'inOutSine',
      }),
    ];

    const section = root.closest('#about');

    // 2. Scroll-scrubbed shape morph: hexagon -> triangle -> diamond.
    const morphEl = root.querySelector('.flr-morph');
    const triEl = root.querySelector('.flr-target-tri');
    const diaEl = root.querySelector('.flr-target-dia');
    let morphTl = null;
    if (!reduce && morphEl && triEl && diaEl) {
      morphTl = createTimeline({ autoplay: false, defaults: { ease: 'inOutQuad' } });
      morphTl
        .add(morphEl, { d: svg.morphTo(triEl), duration: MORPH_DUR / 2 })
        .add(morphEl, { d: svg.morphTo(diaEl), duration: MORPH_DUR / 2 });
    }

    // Follow-the-screen-down travel + morph scrub. The motif tries to stay
    // centered in the viewport (so it follows you down through the section),
    // bounded to the section box; the same 0..1 progress drives the morph.
    // Kept synchronous — a single rect read + transform write + morph seek per
    // side is cheap, and it stays responsive even when rAF is throttled.
    const onScroll = () => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - FLOURISH_H, 1);
      const tyRaw = (window.innerHeight - FLOURISH_H) / 2 - rect.top;
      const ty = clamp(tyRaw, 0, travel);
      const p = clamp(tyRaw / travel, 0, 1);
      root.style.transform = `translateY(${ty}px)`;
      if (morphTl) morphTl.seek(p * MORPH_DUR);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      loops.forEach((a) => a && a.revert && a.revert());
      if (morphTl && morphTl.revert) morphTl.revert();
    };
  }, [side]);

  return (
    <div className={`about-flourish about-flourish--${side}`} ref={ref} aria-hidden="true">
      <svg viewBox="0 0 160 440" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="flr-ring">
          <circle className="flr-ring-shape" cx="80" cy="98" r="58" strokeDasharray="4 9" />
          <circle className="flr-ring-shape" cx="80" cy="98" r="40" />
        </g>

        {/* Central shape that morphs as the section scrolls. */}
        <path className="flr-morph flr-hex" d={HEX} />
        {/* Hidden morph targets — rendered (not display:none) so anime.js can
            sample their geometry via getPointAtLength. */}
        <path className="flr-target flr-target-tri" d={TRI} />
        <path className="flr-target flr-target-dia" d={DIA} />

        <line className="flr-line" x1="34" y1="150" x2="34" y2="432" />
        <line className="flr-line" x1="80" y1="176" x2="80" y2="432" />
        <line className="flr-line" x1="126" y1="150" x2="126" y2="432" />

        {DOTS.map(([cx, cy], i) => (
          <circle key={i} className="flr-dot" cx={cx} cy={cy} r="3.4" />
        ))}
      </svg>
    </div>
  );
}
