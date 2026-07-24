import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

// Page-wide decorative anime.js "blueprint" storyboards flanking the site — one
// per side, fixed to the viewport and scrubbed by total page-scroll progress.
// Each side is a sequence of gold line-art scenes that cross-dissolve into the
// next as you scroll the whole page:
//   RIGHT (robotics): electrical wire -> DC motor -> revolute joint ->
//     6-DOF robot arm -> bimanual robot with a head.
//   LEFT  (AI / ML):  neuron -> neural network -> CNN feature extraction ->
//     self-attention transformer -> RF-DETR detection transformer.
// A couple of anime.js ambient loops (spinning rotor, pulsing signals) keep the
// active scene alive.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Fully-connected layers (edges + open nodes) for the neural-network scenes.
function Net({ xs, layers }) {
  const edges = [];
  for (let l = 0; l < layers.length - 1; l++) {
    layers[l].forEach((y1, a) =>
      layers[l + 1].forEach((y2, b) =>
        edges.push(
          <line key={`e${l}-${a}-${b}`} x1={xs[l]} y1={y1} x2={xs[l + 1]} y2={y2} className="flr-thin" />
        )
      )
    );
  }
  return (
    <>
      {edges}
      {layers.map((col, l) =>
        col.map((y, i) => <circle key={`n${l}-${i}`} cx={xs[l]} cy={y} r="5" />)
      )}
    </>
  );
}

// Corner-bracket detection box (DETR-style output).
function DetBox({ x, y, w, h, c = 8 }) {
  return (
    <>
      <path d={`M${x} ${y + c} V${y} H${x + c}`} />
      <path d={`M${x + w - c} ${y} H${x + w} V${y + c}`} />
      <path d={`M${x + w} ${y + h - c} V${y + h} H${x + w - c}`} />
      <path d={`M${x + c} ${y + h} H${x} V${y + h - c}`} />
    </>
  );
}

// RIGHT — robotics evolution.
function RoboticsStages() {
  return (
    <>
      {/* 1 · electrical wire + plug */}
      <g className="flr-stage">
        <path d="M28 96 C 52 78 58 118 84 100 S 120 78 134 96" />
        <path d="M20 92 l8 2 M20 100 l8 -2" />
        <rect x="134" y="86" width="18" height="24" rx="3" className="flr-shade" />
        <line x1="152" y1="92" x2="162" y2="92" />
        <line x1="152" y1="104" x2="162" y2="104" />
        <path className="flr-fill flr-pulse" d="M96 118 l-7 14 l6 -1 l-4 14 l13 -19 l-6 1 z" />
      </g>

      {/* 2 · DC motor */}
      <g className="flr-stage">
        <circle cx="90" cy="104" r="34" className="flr-shade" />
        <g className="flr-spin">
          <line x1="90" y1="76" x2="90" y2="132" />
          <line x1="62" y1="104" x2="118" y2="104" />
        </g>
        <circle cx="90" cy="104" r="7" className="flr-node" />
        <line x1="124" y1="104" x2="152" y2="104" />
        <circle cx="154" cy="104" r="3" className="flr-node" />
        <line x1="76" y1="74" x2="76" y2="58" />
        <line x1="104" y1="74" x2="104" y2="58" />
        <path d="M66 138 h48 l6 12 h-60 z" className="flr-hatch" />
      </g>

      {/* 3 · revolute joint */}
      <g className="flr-stage">
        <rect x="82" y="112" width="16" height="66" rx="5" className="flr-shade" />
        <g transform="rotate(-38 90 112)">
          <rect x="82" y="50" width="16" height="64" rx="5" />
        </g>
        <circle cx="90" cy="112" r="13" />
        <circle cx="90" cy="112" r="3.5" className="flr-node" />
        <path d="M116 96 A 30 30 0 0 1 122 122" />
        <path className="flr-fill" d="M122 122 l-2 -9 l8 4 z" />
      </g>

      {/* 4 · 6-DOF arm with gripper */}
      <g className="flr-stage">
        <path d="M72 188 h36 l6 12 h-48 z" className="flr-hatch" />
        <polyline points="90,188 90,158 66,128 98,102 84,74" />
        <circle cx="90" cy="188" r="5.5" />
        <circle cx="90" cy="158" r="5" />
        <circle cx="66" cy="128" r="5" />
        <circle cx="98" cy="102" r="5" />
        <line x1="84" y1="74" x2="74" y2="62" />
        <line x1="84" y1="74" x2="94" y2="62" />
        <line x1="74" y1="62" x2="72" y2="55" />
        <line x1="94" y1="62" x2="96" y2="55" />
      </g>

      {/* 5 · bimanual robot with a head */}
      <g className="flr-stage">
        <circle cx="90" cy="46" r="15" className="flr-shade" />
        <line x1="82" y1="44" x2="98" y2="44" />
        <line x1="90" y1="61" x2="90" y2="72" />
        <rect x="72" y="72" width="36" height="50" rx="9" className="flr-shade" />
        <polyline points="72,82 52,96 58,120" />
        <line x1="58" y1="120" x2="51" y2="128" />
        <line x1="58" y1="120" x2="64" y2="130" />
        <polyline points="108,82 128,96 122,120" />
        <line x1="122" y1="120" x2="129" y2="128" />
        <line x1="122" y1="120" x2="116" y2="130" />
        <path d="M80 122 l-7 28 h34 l-7 -28" className="flr-hatch" />
        <line x1="69" y1="152" x2="111" y2="152" />
      </g>
    </>
  );
}

// LEFT — AI / ML evolution up to RF-DETR.
function AiStages() {
  return (
    <>
      {/* 1 · neuron / perceptron */}
      <g className="flr-stage">
        <line x1="40" y1="72" x2="76" y2="102" />
        <line x1="36" y1="104" x2="76" y2="104" />
        <line x1="40" y1="136" x2="76" y2="106" />
        <circle cx="38" cy="72" r="3.5" className="flr-node flr-pulse" />
        <circle cx="34" cy="104" r="3.5" className="flr-node flr-pulse" />
        <circle cx="38" cy="136" r="3.5" className="flr-node flr-pulse" />
        <circle cx="92" cy="104" r="17" className="flr-shade" />
        <path d="M84 111 q 5 -12 16 -12" />
        <line x1="109" y1="104" x2="146" y2="104" />
        <path className="flr-fill" d="M146 104 l-9 -3.5 v7 z" />
      </g>

      {/* 2 · multilayer neural network */}
      <g className="flr-stage">
        <Net xs={[46, 90, 134]} layers={[[68, 104, 140], [54, 88, 122, 156], [86, 122]]} />
      </g>

      {/* 3 · CNN feature extraction */}
      <g className="flr-stage">
        <rect x="26" y="80" width="48" height="48" rx="2" className="flr-shade" />
        <line x1="42" y1="80" x2="42" y2="128" />
        <line x1="58" y1="80" x2="58" y2="128" />
        <line x1="26" y1="96" x2="74" y2="96" />
        <line x1="26" y1="112" x2="74" y2="112" />
        <rect x="42" y="96" width="16" height="16" className="flr-fillsoft" />
        <line x1="80" y1="104" x2="100" y2="104" />
        <path className="flr-fill" d="M100 104 l-8 -3.5 v7 z" />
        <rect x="120" y="86" width="30" height="38" rx="2" />
        <rect x="114" y="92" width="30" height="38" rx="2" />
        <rect x="108" y="98" width="30" height="38" rx="2" />
      </g>

      {/* 4 · self-attention transformer */}
      <g className="flr-stage">
        <rect x="66" y="52" width="48" height="16" rx="3" className="flr-shade" />
        <rect x="70" y="46" width="48" height="16" rx="3" />
        {[0, 1, 2, 3, 4].map(i => (
          <rect key={i} x={36 + i * 22} y="150" width="16" height="16" rx="2" />
        ))}
        <path className="flr-thin" d="M44 150 C 60 112 100 112 110 150" />
        <path className="flr-thin" d="M66 150 C 82 118 122 118 132 150" />
        <path className="flr-thin" d="M44 150 C 72 120 118 120 132 150" />
        {[44, 66, 88, 110, 132].map((x, i) => (
          <line key={'l' + i} x1={x} y1="150" x2="90" y2="70" className="flr-thin" />
        ))}
        {[44, 66, 88, 110, 132].map((x, i) => (
          <circle key={'p' + i} cx={x} cy="176" r="2.6" className="flr-node flr-pulse" />
        ))}
      </g>

      {/* 5 · RF-DETR detection transformer */}
      <g className="flr-stage">
        <rect x="40" y="34" width="100" height="66" rx="3" className="flr-hatch" />
        <DetBox x={52} y={48} w={34} h={30} />
        <circle cx="69" cy="63" r="8" className="flr-thin" />
        <DetBox x={96} y={56} w={34} h={32} />
        <rect x="104" y="64" width="18" height="16" className="flr-thin" />
        <rect x="60" y="120" width="60" height="30" rx="3" className="flr-shade" />
        <line x1="60" y1="130" x2="120" y2="130" className="flr-thin" />
        <line x1="60" y1="140" x2="120" y2="140" className="flr-thin" />
        {[70, 90, 110].map((x, i) => (
          <circle key={i} cx={x} cy="170" r="4" className="flr-node flr-pulse" />
        ))}
        {[70, 90, 110].map((x, i) => (
          <line key={'q' + i} x1={x} y1="166" x2={x} y2="150" className="flr-thin" />
        ))}
        <line x1="74" y1="120" x2="69" y2="78" className="flr-thin" />
        <line x1="106" y1="120" x2="113" y2="88" className="flr-thin" />
      </g>
    </>
  );
}

export default function AboutFlourish({ side = 'left' }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const stages = Array.from(root.querySelectorAll('.flr-stage'));

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      // Show only the final scene, static — but hold a small yaw so the depth
      // planes still read as volume with no animation.
      stages.forEach((el, i) => { el.style.opacity = i === stages.length - 1 ? 1 : 0; });
      const orbit = root.querySelector('.flr-orbit');
      if (orbit) orbit.style.transform =
        `rotateX(6deg) rotateY(${side === 'left' ? -18 : 18}deg)`;
      return;
    }

    // Ambient anime.js motion inside the active scene.
    const loops = [
      animate(root.querySelectorAll('.flr-spin'), {
        rotate: side === 'left' ? -360 : 360,
        duration: 7000, loop: true, ease: 'linear',
      }),
      animate(root.querySelectorAll('.flr-pulse'), {
        opacity: [0.25, 1], scale: [0.7, 1.15],
        duration: 1500, delay: stagger(180), loop: true, alternate: true, ease: 'inOutSine',
      }),
    ];

    // Ambient 3D orbit + yaw-driven specular light, on our own rAF so the sheen
    // highlight tracks the LIVE yaw (light fixed in space; faces sweep through
    // it as the assembly tumbles). Wider swing + rotateZ + translateZ "breathing"
    // give a stronger volumetric read than the old anime orbit loop.
    const orbitEl = root.querySelector('.flr-orbit');
    const sheenEl = root.querySelector('.flr-sheen');
    const swingY = side === 'left' ? -1 : 1;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = (now - t0) / 1000;
      const oy = Math.sin(t / 3.1) * 26 * swingY;      // yaw  ±26 (was ±14)
      const ox = Math.cos(t / 4.3) * 9 - 2;            // pitch
      const oz = Math.sin(t / 5.0) * 3 * swingY;       // slight roll
      const tzB = 3 + Math.sin(t / 4.0) * 9;           // z "breathing"
      if (orbitEl) {
        orbitEl.style.transform =
          `translateZ(${tzB.toFixed(2)}px) rotateY(${oy.toFixed(2)}deg) ` +
          `rotateX(${ox.toFixed(2)}deg) rotateZ(${oz.toFixed(2)}deg)`;
      }
      if (sheenEl) {
        sheenEl.style.setProperty('--sx', `${(50 + oy * 1.7).toFixed(1)}%`);
        sheenEl.style.setProperty('--sheen-a',
          (0.5 + 0.4 * Math.cos(oy * Math.PI / 180)).toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Exploded-view assembly (right/robotics side): every part of a scene is
    // measured once, then flown in radially from outside the scene's centre as
    // that scene becomes active, and blown back apart as the next one takes
    // over. Parts that carry their own transform (pre-rotated groups) or an
    // anime.js loop (.flr-spin/.flr-pulse) are skipped so we never fight them.
    const partsOf = stage =>
      Array.from(stage.children)
        .filter(el =>
          !el.hasAttribute('transform') &&
          !el.classList.contains('flr-spin') &&
          !el.classList.contains('flr-pulse') &&
          !el.querySelector?.('.flr-spin, .flr-pulse')
        )
        .map((el, idx, all) => {
          let box;
          try { box = el.getBBox(); } catch { box = null; }
          const cx = box ? box.x + box.width / 2 : 90;
          const cy = box ? box.y + box.height / 2 : 110;
          const dx = cx - 90;
          const dy = cy - 110;
          const len = Math.hypot(dx, dy) || 1;
          // Radial blow-apart distance — large enough that the parts clearly
          // separate into a technical exploded view rather than just loosening.
          const push = 70 + 55 * (len / 90);
          // Outline length, so each part can also draw itself on as it seats.
          let draw = 0;
          try { draw = el.getTotalLength ? el.getTotalLength() : 0; } catch { draw = 0; }
          // Alternate parts explode toward vs. away from the viewer in depth,
          // and spin about the X/Y axes, so the blow-apart reads as a true 3D
          // exploded view rather than a flat scatter.
          const zDir = idx % 2 === 0 ? 1 : -1;

          // Persistent resting depth so the assembly has real thickness even
          // when fully seated (k=0). Solid bodies/hatch form the far plane;
          // linework & nodes float toward the viewer. Per-index spread fans the
          // parts across the gap so nothing sits co-planar.
          const isBody =
            el.classList.contains('flr-shade') ||
            el.classList.contains('flr-hatch') ||
            el.classList.contains('flr-fillsoft');
          const isThin = el.classList.contains('flr-thin');
          const spread = all.length > 1 ? (idx / (all.length - 1) - 0.5) : 0;
          const baseZ = (isBody ? -40 : 26) + spread * 40;   // ~ -60 (far) .. +46 (near)

          return {
            el, isThin,
            ox: (dx / len) * push,
            oy: (dy / len) * push,
            oz: zDir * (90 + (len % 40)),
            rx: (idx % 3 - 1) * 40,
            ry: (cx > 90 ? 1 : -1) * (35 + (len % 20)),
            rot: (cx > 90 ? 1 : -1) * (26 + (len % 14)),
            draw, baseZ,
            // Parts seat in sequence (outermost last), like an assembly diagram.
            lead: all.length > 1 ? (idx / (all.length - 1)) * 0.45 : 0,
          };
        });

    const explode = side === 'right';          // boolean, not a second measure pass
    const drawParts = stages.map(partsOf);
    drawParts.forEach(parts => parts.forEach(p => {
      if (p.draw > 0) p.el.style.strokeDasharray = `${p.draw}`;
    }));

    // Scroll-scrubbed storyboard: total page-scroll progress maps onto a stage
    // position; each scene crossfades into the next (with a small scale-in).
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      const pos = p * (stages.length - 1);
      stages.forEach((el, i) => {
        // Signed distance: negative = this scene is still ahead (waiting
        // below), positive = it has been handed off and is drifting away.
        const d = clamp(pos - i, -1, 1);
        const a = Math.abs(d);
        // Smoothstep the fade and hold the middle, so neighbouring scenes
        // overlap for longer and the handoff reads as one continuous
        // transformation rather than a hard swap.
        const t = clamp((1 - a) / 0.75, 0, 1);
        const o = t * t * (3 - 2 * t);
        // Each scene rises into place, then keeps travelling upward and
        // opening up as the next one takes over — so the motion flows through
        // the whole storyboard in one direction.
        const y = d * -30;
        const s = 0.82 + 0.18 * o + (d > 0 ? d * 0.14 : 0);
        // Each scene sits on a tilted plane: it swings in from a steep angle
        // (rotateX/rotateY), squares up to face the viewer at its peak, and
        // tips away as it hands off — a 3D turn rather than a flat rotate.
        const rotX = d * 55;
        const rotY = (side === 'left' ? -1 : 1) * d * 50;
        const tz = -Math.abs(d) * 170;
        el.style.opacity = o;
        el.style.transform =
          `translateY(${y}px) translateZ(${tz}px) ` +
          `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${s})`;
        // Drop fully-faded scenes out of hit/paint work entirely.
        el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';

        // Per-part assembly. `k` is 0 at the scene's peak (fully seated) and 1
        // at the extremes (fully exploded / not yet drawn). Each part gets its
        // own lead-in window so the object assembles piece by piece, and a
        // persistent resting depth plane (baseZ) so it has thickness at rest.
        if (o > 0.002) {
          drawParts[i].forEach(part => {
            const kRaw = clamp((a - part.lead) / (1 - part.lead), 0, 1);
            const k = kRaw * kRaw;
            if (part.draw > 0) part.el.style.strokeDashoffset = `${part.draw * k}`;

            const dir = d > 0 ? 1 : -1;
            const ez = explode ? part.oz * k : 0;
            const z  = part.baseZ + ez;                        // resting plane + explode lift
            const ex = explode ? part.ox * k * dir : 0;
            const ey = explode ? part.oy * k : 0;
            const rX = explode ? part.rx * k : 0;
            const rY = explode ? part.ry * k * dir : 0;
            const rZ = explode ? part.rot * k * dir : 0;
            const sc = explode ? (1 - 0.22 * k) : 1;

            part.el.style.transform =
              `translate3d(${ex.toFixed(2)}px, ${ey.toFixed(2)}px, ${z.toFixed(2)}px) ` +
              `rotateX(${rX.toFixed(2)}deg) rotateY(${rY.toFixed(2)}deg) ` +
              `rotateZ(${rZ.toFixed(2)}deg) scale(${sc.toFixed(3)})`;

            // Depth cueing: far parts dim + soften; exploded parts cast a shadow
            // that deepens as they lift clear. Thin helper lines keep their 0.65
            // base fade (multiply rather than override it).
            const depthN = clamp((z + 60) / 120, 0, 1);        // 0 far .. 1 near
            const base = part.isThin ? 0.65 : 1;
            part.el.style.opacity = (base * (0.55 + 0.45 * depthN)).toFixed(3);
            const f = [];
            if (z < -6) f.push(`blur(${(-(z + 6) * 0.014).toFixed(2)}px)`);
            if (explode && k > 0.03)
              f.push(`drop-shadow(0 ${(2 + 5 * k).toFixed(1)}px ${(3 + 7 * k).toFixed(1)}px rgba(0,0,0,0.30))`);
            part.el.style.filter = f.length ? f.join(' ') : 'none';
          });
        }
      });
      // Container scroll-parallax: the whole flourish drifts against the page.
      root.style.transform = `translateY(${(0.5 - p) * 40}px)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      loops.forEach(a => a && a.revert && a.revert());
      cancelAnimationFrame(raf);
    };
  }, [side]);

  return (
    <div className={`about-flourish about-flourish--${side}`} ref={ref} aria-hidden="true">
      <svg viewBox="0 0 180 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Shading + wireframe hatch, scoped per side so the two SVGs don't
            share gradient/pattern ids. */}
        <defs>
          <linearGradient id={`flr-shade-${side}`} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.34" />
            <stop offset="55%" stopColor="var(--accent-color)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.03" />
          </linearGradient>
          <pattern id={`flr-hatch-${side}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent-color)" strokeWidth="0.7" strokeOpacity="0.5" />
          </pattern>
        </defs>
        <g className="flr-orbit" style={{ '--flr-shade': `url(#flr-shade-${side})`, '--flr-hatch': `url(#flr-hatch-${side})` }}>
          {side === 'left' ? <AiStages /> : <RoboticsStages />}
        </g>
      </svg>
      <div className="flr-sheen" aria-hidden="true" />
    </div>
  );
}
