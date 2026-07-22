import React, { useMemo } from 'react';

// Staggered sine-wave curtain flanking the hero — a port of the wave field on
// the live /portfolio page. Many horizontal sine paths stacked vertically, each
// with a slightly larger negative animation-delay so the stack reads as one
// travelling phase-shifted ripple. The paths scroll outward (left stack to the
// left, right stack to the right) and the container is masked at both edges so
// they fade into the page instead of ending abruptly.

const WIDTH = 300;
const HEIGHT = 420;
const NUM_WAVES = 50;      // ~48 visible rows
const AMPLITUDE = 12;
const SPACING = 12;
const CYCLE = 100;         // one full sine cycle, in viewBox units
const PATH_WIDTH = WIDTH * 2;
const DURATION = 3;        // seconds, must match the CSS animation-duration
const PHASE_DEG = 12;      // per-row phase offset that creates the stagger

function wavePath(i) {
  const startY = HEIGHT / 2 + (i - (NUM_WAVES - 1) / 2) * SPACING;
  let d = `M 0 ${startY}`;
  for (let x = 0; x < PATH_WIDTH; x += CYCLE) {
    d += ` q ${CYCLE / 4} ${-AMPLITUDE} ${CYCLE / 2} 0`;
    d += ` t ${CYCLE / 2} 0`;
  }
  return d;
}

export default function SineWave({ side = 'left' }) {
  const rows = useMemo(
    () =>
      Array.from({ length: NUM_WAVES - 2 }, (_, n) => {
        const i = n + 1;
        return { d: wavePath(i), delay: `-${(i * PHASE_DEG / 360) * DURATION}s` };
      }),
    []
  );

  return (
    <div className={`sine-wave-container sine-wave--${side}`} aria-hidden="true">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        {rows.map((r, i) => (
          <path key={i} d={r.d} style={{ animationDelay: r.delay }} />
        ))}
      </svg>
    </div>
  );
}
