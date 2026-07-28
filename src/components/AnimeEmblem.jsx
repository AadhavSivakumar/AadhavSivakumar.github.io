import React, { useEffect, useMemo, useRef } from 'react';
import { animate, stagger } from 'animejs';

// A faithful remake of the circular "gauge" emblem that anime.js runs on its
// own homepage (animejs.com): a segmented neon outer ring, a dense ring of
// radial tick marks, concentric dial rings, a central lens/diamond built from
// stacked horizontal lines, a diagonal dotted "scan" line, and a few peach
// spiral arcs — all animated with staggered ripples (the anime.js signature).
//
// Built in SVG and driven by anime.js v4 `animate` + `stagger`, mirroring how
// anime.js itself composes these demos (stagger over a generated grid of
// elements). Rotating layers spin about the emblem centre; ticks and diamond
// lines pulse on staggered delays; the scan dots travel; the arcs draw.

const VB = 520;
const C = 260; // centre
const TAU = Math.PI * 2;
const rad = d => (d * Math.PI) / 180;
const pol = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];

// Neon segment colours, clockwise from the top (green→red at 12 o'clock like
// the original), cycling a full spectrum.
const RING_COLORS = ['#FF4B4B', '#FF8A3D', '#F5C93B', '#7BE04F', '#35D6A4', '#37C4E8', '#4B7BFF', '#8CE04F'];

function arcPath(r, a0, a1) {
  const [x0, y0] = pol(r, a0);
  const [x1, y1] = pol(r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export default function AnimeEmblem({ className = '' }) {
  const ref = useRef(null);

  const model = useMemo(() => {
    // Outer segmented colour ring.
    const segGap = 6;
    const segments = RING_COLORS.map((color, k) => ({
      color,
      d: arcPath(240, rad(-90 + k * 45 + segGap / 2), rad(-90 + (k + 1) * 45 - segGap / 2)),
    }));

    // Dense ring of radial tick marks (the gauge scale).
    const N_TICKS = 96;
    const ticks = Array.from({ length: N_TICKS }, (_, i) => {
      const a = (i / N_TICKS) * TAU - Math.PI / 2;
      const [x1, y1] = pol(208, a);
      const [x2, y2] = pol(221, a);
      return { x1, y1, x2, y2 };
    });

    // Central lens/diamond built from stacked horizontal lines whose width
    // follows a pointed-ended lens profile (widest at the centre line).
    const N_LINES = 46;
    const HH = 150;
    const MAXW = 156;
    const lines = [];
    for (let i = 0; i < N_LINES; i++) {
      const t = (i / (N_LINES - 1)) * 2 - 1;
      const w = MAXW * Math.pow(Math.max(0, 1 - t * t), 0.9);
      if (w < 4) continue;
      lines.push({ y: C + t * HH, w });
    }

    // Diagonal dotted "scan" line through the centre.
    const N_DOTS = 27;
    const da = rad(-24);
    const dir = [Math.cos(da), Math.sin(da)];
    const dots = Array.from({ length: N_DOTS }, (_, j) => {
      const s = (j / (N_DOTS - 1)) * 2 - 1;
      return { cx: C + s * 205 * dir[0], cy: C + s * 205 * dir[1], r: 2.6 + 1.6 * (1 - Math.abs(s)) };
    });

    // Peach spiral arcs in the lower-right quadrant.
    const arcs = [0, 1, 2].map(m => ({
      d: arcPath(158 + m * 12, rad(16 + m * 3), rad(70 - m * 2)),
    }));

    // Concentric dial rings.
    const rings = [150, 182, 197, 228];
    return { segments, ticks, lines, dots, arcs, rings };
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // leave the static composition

    const q = s => Array.from(root.querySelectorAll(s));
    const anims = [
      // Counter-rotating layers.
      animate(q('.emblem-ring'), { rotate: 360, duration: 72000, loop: true, ease: 'linear' }),
      animate(q('.emblem-ticks'), { rotate: -360, duration: 120000, loop: true, ease: 'linear' }),
      animate(q('.emblem-dial'), { rotate: 360, duration: 200000, loop: true, ease: 'linear' }),
      // Staggered ripples — the anime.js signature.
      animate(q('.emblem-tick'), {
        opacity: [0.3, 1], scaleY: [0.65, 1.3],
        delay: stagger(26, { from: 'first' }), duration: 1500, loop: true, alternate: true, ease: 'inOutSine',
      }),
      animate(q('.emblem-dline'), {
        scaleX: [0.8, 1], opacity: [0.45, 0.92],
        delay: stagger(22, { from: 'center' }), duration: 1700, loop: true, alternate: true, ease: 'inOutQuad',
      }),
      animate(q('.emblem-dot'), {
        opacity: [0.2, 1], scale: [0.55, 1.2],
        delay: stagger(42, { from: 'first' }), duration: 1300, loop: true, alternate: true, ease: 'inOutSine',
      }),
      animate(q('.emblem-arc'), {
        strokeDashoffset: [80, 0], opacity: [0.15, 0.7],
        delay: stagger(240), duration: 3200, loop: true, alternate: true, ease: 'inOutSine',
      }),
    ];

    // Pause while off-screen (the hero scrolls away).
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([e]) => anims.forEach(a => (e.isIntersecting ? a.play?.() : a.pause?.())),
        { threshold: 0.01 }
      );
      io.observe(root);
    }
    return () => {
      io && io.disconnect();
      anims.forEach(a => a && a.revert && a.revert());
    };
  }, []);

  return (
    <div className={`anime-emblem ${className}`} ref={ref} aria-hidden="true">
      <svg viewBox={`0 0 ${VB} ${VB}`}>
        <defs>
          <filter id="emblem-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="emblem-grid" width="15" height="15" patternUnits="userSpaceOnUse">
            <circle cx="1.4" cy="1.4" r="1.4" fill="var(--accent-color)" />
          </pattern>
          <radialGradient id="emblem-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
          </radialGradient>
        </defs>

        {/* faint dotted grid + dial rings */}
        <g className="emblem-dial emblem-rot">
          <circle className="emblem-gridfill" cx={C} cy={C} r="150" fill="url(#emblem-grid)" />
          {model.rings.map((r, i) => (
            <circle key={i} className="emblem-dialring" cx={C} cy={C} r={r} fill="none" />
          ))}
          {/* glossy highlight sweep, top-left */}
          <path className="emblem-gloss" d={arcPath(202, rad(196), rad(250))} fill="none" />
        </g>

        {/* central lens/diamond of stacked lines */}
        <g className="emblem-diamond">
          {model.lines.map((l, i) => (
            <rect
              key={i}
              className="emblem-dline"
              x={C - l.w / 2}
              y={l.y - 1.1}
              width={l.w}
              height="2.2"
            />
          ))}
        </g>

        {/* diagonal dotted scan line */}
        <g className="emblem-scan">
          {model.dots.map((d, i) => (
            <circle key={i} className="emblem-dot" cx={d.cx} cy={d.cy} r={d.r} />
          ))}
        </g>

        {/* peach spiral arcs */}
        <g className="emblem-arcs">
          {model.arcs.map((a, i) => (
            <path key={i} className="emblem-arc" d={a.d} fill="none" pathLength="80" strokeDasharray="80" />
          ))}
        </g>

        {/* radial tick ring */}
        <g className="emblem-ticks emblem-rot">
          {model.ticks.map((t, i) => (
            <line key={i} className="emblem-tick" x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
          ))}
        </g>

        {/* outer segmented neon ring */}
        <g className="emblem-ring emblem-rot" filter="url(#emblem-glow)">
          {model.segments.map((s, i) => (
            <path key={i} className="emblem-seg" d={s.d} fill="none" stroke={s.color} />
          ))}
        </g>

        <circle cx={C} cy={C} r={C} fill="url(#emblem-vignette)" pointerEvents="none" />
      </svg>
    </div>
  );
}
