import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

// Decorative anime.js ambient motif that flanks the About card (one on the
// left, one on the right). Pure gold line/shape work in the site's accent
// colour, driven entirely by anime.js seamless loops:
//   - concentric rings + hexagon rotate slowly (opposite ways per side),
//   - guide lines flow via an animated stroke dash,
//   - dots pulse (scale + opacity) on an alternating loop.
// All loops are seamless (360° rotation, dash offset a whole multiple of the
// dash period, alternating pulses) so there is no jump at the loop boundary.
const DOTS = [
  [34, 210], [80, 244], [126, 198], [52, 306],
  [110, 336], [80, 392], [34, 372], [126, 300],
];

export default function AboutFlourish({ side = 'left' }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const anims = [
      animate(root.querySelectorAll('.flr-ring'), {
        rotate: side === 'left' ? 360 : -360,
        duration: 26000,
        loop: true,
        ease: 'linear',
      }),
      animate(root.querySelectorAll('.flr-hex'), {
        rotate: side === 'left' ? -360 : 360,
        duration: 34000,
        loop: true,
        ease: 'linear',
      }),
      animate(root.querySelectorAll('.flr-line'), {
        // 160 is a whole multiple of the 16px dash period → seamless flow.
        strokeDashoffset: [0, side === 'left' ? -160 : 160],
        duration: 4200,
        delay: stagger(500),
        loop: true,
        ease: 'linear',
      }),
      animate(root.querySelectorAll('.flr-dot'), {
        scale: [0.55, 1.35],
        opacity: [0.2, 0.9],
        duration: 1900,
        delay: stagger(220),
        loop: true,
        alternate: true,
        ease: 'inOutSine',
      }),
    ];

    return () => anims.forEach((a) => a && a.revert && a.revert());
  }, [side]);

  return (
    <div className={`about-flourish about-flourish--${side}`} ref={ref} aria-hidden="true">
      <svg viewBox="0 0 160 440" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="flr-ring">
          <circle className="flr-ring-shape" cx="80" cy="98" r="58" strokeDasharray="4 9" />
          <circle className="flr-ring-shape" cx="80" cy="98" r="40" />
        </g>
        <path
          className="flr-hex"
          d="M80 68 L106 83 L106 113 L80 128 L54 113 L54 83 Z"
        />

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
