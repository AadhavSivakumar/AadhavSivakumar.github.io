import React, { useMemo } from 'react';

// Staggered sine-wave field — a port of the wave field on the live /portfolio
// hero. Many horizontal sine paths stacked vertically, each with a slightly
// larger negative animation-delay so the stack reads as one travelling,
// phase-shifted ripple.
//
//   variant="field" — full-width field painted behind the whole hero (matches
//     /portfolio). Uses a WIDE viewBox whose aspect matches the hero so
//     preserveAspectRatio="none" fills the width WITHOUT stretching the waves.
//   variant="edge"  — the older narrow side curtain (kept for reuse elsewhere).

const DURATION = 3;        // seconds, must match the CSS animation-duration
const PHASE_DEG = 12;      // per-row phase offset that creates the stagger

// Geometry per variant. The field mirrors /portfolio's 1000x350 viewBox (wide
// aspect => no horizontal stretch) with rounded, evenly-spaced gold waves.
const GEO = {
  edge:  { W: 300,  H: 420, ROWS: 50, AMP: 12, SPACING: 12, CYCLE: 100 },
  field: { W: 1000, H: 350, ROWS: 30, AMP: 13, SPACING: 14, CYCLE: 100 },
};

function wavePath(g, i) {
  const pathWidth = g.W * 2;                 // draw two viewBox-widths for a seamless scroll
  const startY = g.H / 2 + (i - (g.ROWS - 1) / 2) * g.SPACING;
  let d = `M 0 ${startY}`;
  for (let x = 0; x < pathWidth; x += g.CYCLE) {
    d += ` q ${g.CYCLE / 4} ${-g.AMP} ${g.CYCLE / 2} 0`;
    d += ` t ${g.CYCLE / 2} 0`;
  }
  return d;
}

export default function SineWave({ side = 'left', variant = 'edge' }) {
  const g = GEO[variant] || GEO.edge;
  const rows = useMemo(
    () =>
      Array.from({ length: g.ROWS - 2 }, (_, n) => {
        const i = n + 1;
        return { d: wavePath(g, i), delay: `-${(i * PHASE_DEG / 360) * DURATION}s` };
      }),
    [g]
  );

  if (variant === 'field') {
    return (
      <div className="hero-wavefield" aria-hidden="true">
        <svg viewBox={`0 0 ${g.W} ${g.H}`} preserveAspectRatio="none">
          {rows.map((r, i) => (
            <path key={i} d={r.d} style={{ animationDelay: r.delay }} />
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div className={`sine-wave-container sine-wave--${side}`} aria-hidden="true">
      <svg viewBox={`0 0 ${g.W} ${g.H}`} preserveAspectRatio="xMidYMid meet">
        {rows.map((r, i) => (
          <path key={i} d={r.d} style={{ animationDelay: r.delay }} />
        ))}
      </svg>
    </div>
  );
}
