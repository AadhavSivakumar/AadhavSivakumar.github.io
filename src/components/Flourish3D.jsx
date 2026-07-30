import React, { useEffect, useRef } from 'react';
// `steps` must be imported and passed as a FUNCTION: anime v4.5 removed the
// string form (ease: 'steps(4)' hits the deprecated list in easings/eases/
// parser.js, warns, and silently falls back to linear).
import { animate, stagger, steps } from 'animejs';

// Page-wide decorative 3D flourishes — one per side, fixed to the viewport and
// scrubbed by page scroll. Unlike the old SVG storyboards these are built from
// HTML divs inside a real CSS 3D context (`perspective` + an unbroken
// `transform-style: preserve-3d` chain), so `translateZ` produces TRUE
// projective foreshortening. SVG cannot do this: translateZ on an SVG node is
// silently ignored (a measured ±150px gave a size ratio of exactly 1.0) and
// rotateY only yields a flat cos() x-squash.
//
//   LEFT  (AI / ML)    — "Conv Stack": three wireframe feature volumes that
//                        blow apart into their own faces and reassemble, an
//                        activation plane rippling on a 3D grid stagger, and a
//                        token row spread purely along Z.
//   RIGHT (Robotics)   — "Joint Module": a revolute actuator (bracket, motor
//                        can, stator, rotor, output flange + link arm) exploded
//                        along its own rotation axis, with a dashed centreline.
//
// Scroll drives the explode/assemble parameter and the camera yaw/pitch;
// anime.js drives the ambient life (rotor spin, kernel raster, activation
// ripple, idle yaw). The two never write the same element's transform.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Explode distance each box face travels along its own normal.
const FACE_EXPLODE = 74;
const TOP_EXPLODE = 60;

// The five visible faces of a wireframe box (the bottom is omitted — the camera
// is always pitched slightly down). Each face is placed by rotating to its own
// plane and then pushing out along that plane's normal, so "exploding" is just
// a larger translateZ — the faces separate in real depth, and the near ones
// visibly grow while the far ones shrink.
function boxFaces(w, h, d) {
  return [
    { key: 'front', W: w, H: h, rot: 'rotateY(0deg)', z: d / 2, op: 1, ex: FACE_EXPLODE },
    { key: 'back', W: w, H: h, rot: 'rotateY(180deg)', z: d / 2, op: 0.38, ex: FACE_EXPLODE },
    { key: 'right', W: d, H: h, rot: 'rotateY(90deg)', z: w / 2, op: 0.6, ex: FACE_EXPLODE },
    { key: 'left', W: d, H: h, rot: 'rotateY(-90deg)', z: w / 2, op: 0.6, ex: FACE_EXPLODE },
    { key: 'top', W: w, H: d, rot: 'rotateX(90deg)', z: h / 2, op: 0.76, ex: TOP_EXPLODE },
  ];
}

// A wireframe box. Faces carry their base depth + explode distance as data so
// the scroll handler can re-place them without React re-rendering.
function Box({ w, h, d, y = 0, x = 0, z = 0, extraClass = '' }) {
  return (
    <div className={`f3d__part ${extraClass}`} style={{ transform: `translate3d(${x}px, ${y}px, ${z}px)` }}>
      {boxFaces(w, h, d).map(f => (
        <div
          key={f.key}
          className="f3d__face"
          data-rot={f.rot}
          data-z={f.z}
          data-ex={f.ex}
          style={{
            width: `${f.W}px`,
            height: `${f.H}px`,
            marginLeft: `${-f.W / 2}px`,
            marginTop: `${-f.H / 2}px`,
            opacity: f.op,
            transform: `${f.rot} translateZ(${f.z}px)`,
          }}
        />
      ))}
    </div>
  );
}

// A flat ring (perfect CSS circle) — the module tilt turns it into a correctly
// eccentric perspective ellipse, and it re-shapes live as the camera pitches.
function Ring({ d, z = 0, op = 0.7, thick = 1, cls = '' }) {
  return (
    <div
      className={`f3d__ring ${cls}`}
      style={{
        width: `${d}px`,
        height: `${d}px`,
        marginLeft: `${-d / 2}px`,
        marginTop: `${-d / 2}px`,
        borderWidth: `${thick}px`,
        opacity: op,
        transform: `translateZ(${z}px)`,
      }}
    />
  );
}

// LEFT — AI / ML. Feature volumes + activation plane + a token row that exists
// only because of perspective (identical CSS sizes, spread along Z).
function ConvStack() {
  const CELLS = 16; // 4x4 activation grid
  const TOKENS = 7;
  return (
    <>
      {/* hairline spine behind everything */}
      <div className="f3d__spine" />

      {/* three feature volumes, tapering wide+flat -> narrow+deep */}
      <Box w={100} h={100} d={18} y={-150} />
      <Box w={74} h={74} d={46} y={-24} />
      <Box w={44} h={44} d={72} y={84} />

      {/* Z-rails tying the activation plane back to the input volume's front
          face. A rotateY(90deg) ribbon lies ALONG the depth axis: its projected
          width is width*sin(yaw) — exactly zero when the camera faces it
          head-on, splaying open as the world turns. Nothing in 2D does that,
          which makes these the cheapest undeniable proof of real depth.
          Static-only: anime emits transform components in a fixed order and so
          can never reproduce a rotate-then-translate placement. */}
      <div className="f3d__part" style={{ transform: 'translate3d(0, -150px, 0)' }}>
        {[[-44, -44], [44, -44], [-44, 44], [44, 44]].map(([x, y], i) => (
          <div
            key={i}
            className="f3d__rail"
            style={{ transform: `translate3d(${x}px, ${y}px, 62px) rotateY(90deg)` }}
          />
        ))}
      </div>

      {/* activation plane floating in front of the input volume */}
      <div className="f3d__part f3d__actplane" style={{ transform: 'translate3d(0, -150px, 62px)' }}>
        {Array.from({ length: CELLS }, (_, i) => {
          const cx = i % 4;
          const cy = Math.floor(i / 4);
          return (
            <div
              key={i}
              className="f3d__cellwrap"
              style={{ transform: `translate3d(${(cx - 1.5) * 26}px, ${(cy - 1.5) * 26}px, 0)` }}
            >
              <div className="f3d__cell" />
            </div>
          );
        })}
        {/* convolution kernel that rasters across the grid */}
        <div className="f3d__kernel" />
      </div>

      {/* token row — identical sizes, spread purely along Z */}
      <div className="f3d__part" style={{ transform: 'translate3d(0, 172px, 0)' }}>
        {Array.from({ length: TOKENS }, (_, i) => (
          <div
            key={i}
            className="f3d__tokwrap"
            style={{ transform: `translate3d(${(i - 3) * 5}px, 0, ${(i - 3) * 32}px)` }}
          >
            <div className="f3d__token" />
          </div>
        ))}
      </div>
    </>
  );
}

// The bare wire the motor builds itself around: a serpentine winding running
// along the module axis. Drawn as a flat SVG path inside a div that is itself
// placed in 3D (the one sanctioned use of SVG here) so it can draw on via
// stroke-dashoffset; two copies 90° apart about the axis give it volume.
const WIRE_W = 120;
const WIRE_H = 240;
function coilPath() {
  const cx = WIRE_W / 2;
  const turns = 9;
  const amp = 26;
  const yTop = 34;
  const yBot = 206;
  const step = (yBot - yTop) / turns;
  let d = `M ${cx} ${WIRE_H - 6} L ${cx} ${yBot}`;
  for (let i = 0; i < turns; i++) {
    const ya = yBot - i * step;
    const yb = yBot - (i + 1) * step;
    const dir = i % 2 === 0 ? 1 : -1;
    d += ` Q ${cx + dir * amp} ${(ya + yb) / 2} ${cx} ${yb}`;
  }
  return d + ` L ${cx} 8`;
}
const WIRE_D = coilPath();

function Wire() {
  return (
    <>
      {['a', 'b'].map(k => (
        <div key={k} className={`f3d__wirewrap f3d__wirewrap--${k}`}>
          <svg className="f3d__wire" viewBox={`0 0 ${WIRE_W} ${WIRE_H}`} fill="none">
            <path className="f3d__wirepath" d={WIRE_D} />
          </svg>
        </div>
      ))}
    </>
  );
}

// Radial detail ring (gear teeth, magnet segments, bolts) — placed by
// rotate-then-translate, which anime can never reproduce, so STATIC ONLY.
function Radial({ n, r, cls, from = 0 }) {
  return Array.from({ length: n }, (_, k) => (
    <div key={k} className={cls} style={{ transform: `rotateZ(${from + (k * 360) / n}deg) translateX(${r}px)` }} />
  ));
}

// RIGHT — a Franka Emika Research 3 style joint module. The FR3 is a 7-DOF
// cobot whose every joint is an integrated harmonic-drive actuator: a frameless
// BLDC rotor/stator, a strain-wave (harmonic) gear — elliptical wave generator
// inside a toothed flexspline inside a rigid circular spline — plus a brake, an
// encoder and, the FR3's signature, a strain-gauge torque-sensor flexure ring,
// all inside a CYLINDRICAL housing (not a hexagonal can).
//
// It starts as a bare wire (the motor phase leads) and the joint assembles
// around it from the axis outward. Each part has its OWN scroll window; the
// windows are far wider than the gaps between them, so ~3 parts are always in
// flight. Parts arrive from six different directions and spin as they seat.
const FR3_PARTS = [
  // lead, seatZ, incoming direction (unit-ish), spin-in degrees
  { id: 'wavegen', lead: 0.08, sz: 74, dir: [0, 0, 1], spin: -300 },
  { id: 'flexspline', lead: 0.18, sz: 78, dir: [-1, -0.3, 0.2], spin: 260 },
  { id: 'circspline', lead: 0.28, sz: 82, dir: [0.4, 1, 0], spin: -240 },
  { id: 'rotor', lead: 0.38, sz: 86, dir: [1, -0.4, 0.3], spin: 320 },
  { id: 'stator', lead: 0.48, sz: 86, dir: [-0.5, 1, -0.4], spin: -280 },
  { id: 'torque', lead: 0.58, sz: 122, dir: [0, -1, 0.5], spin: 300 },
  { id: 'housing', lead: 0.68, sz: 88, dir: [0, 0, -1], spin: -200 },
  { id: 'endcap', lead: 0.78, sz: 140, dir: [0.8, 0.6, 0.6], spin: 240 },
];
const partAttrs = id => {
  const p = FR3_PARTS.find(x => x.id === id);
  return {
    'data-lead': p.lead,
    'data-sz': p.sz,
    'data-fx': p.dir[0],
    'data-fy': p.dir[1],
    'data-fz': p.dir[2],
    'data-spin': p.spin,
    style: { transform: `translate3d(0,0,${p.sz}px)` },
  };
};

function MotorBuild() {
  return (
    <div className="f3d__module">
      {/* dashed centreline — the signature of a real engineering assembly view */}
      <div className="f3d__axiswrap">
        <div className="f3d__axis" />
      </div>

      {/* The whole joint turns about its own axis as it assembles. */}
      <div className="f3d__spin">
        {/* 0 · the motor phase wire, present from the start */}
        <Wire />

        {/* 1 · WAVE GENERATOR — the harmonic drive's elliptical cam + bearing.
             The ellipse is the instantly-readable "this is a strain wave gear". */}
        <div className="f3d__part f3d__build" {...partAttrs('wavegen')}>
          <div className="f3d__ellipse" />
          <div className="f3d__ellipse f3d__ellipse--inner" />
          <Ring d={16} op={0.9} />
        </div>

        {/* 2 · FLEXSPLINE — flexible externally-toothed cup deformed by the cam */}
        <div className="f3d__part f3d__build" {...partAttrs('flexspline')}>
          <Ring d={62} z={-16} op={0.7} />
          <Ring d={62} z={16} op={0.55} />
          <Radial n={10} r={31} cls="f3d__tooth" />
        </div>

        {/* 3 · CIRCULAR SPLINE — rigid internally-toothed outer ring (2 more
             teeth than the flexspline: that difference IS the gear ratio) */}
        <div className="f3d__part f3d__build" {...partAttrs('circspline')}>
          <Ring d={80} z={-14} op={0.7} />
          <Ring d={80} z={14} op={0.7} />
          <Radial n={12} r={36} cls="f3d__tooth" from={15} />
        </div>

        {/* 4 · ROTOR — frameless BLDC rotor, magnet segments on a back iron */}
        <div className="f3d__part f3d__build" {...partAttrs('rotor')}>
          <div className="f3d__rotor">
            <Ring d={92} z={-18} op={0.75} />
            <Ring d={92} z={18} op={0.75} />
            <Radial n={8} r={44} cls="f3d__magnet" />
          </div>
        </div>

        {/* 5 · STATOR — laminated core with the windings the phase wire feeds */}
        <div className="f3d__part f3d__build" {...partAttrs('stator')}>
          <Ring d={108} z={-22} op={0.6} />
          <Ring d={108} z={22} op={0.6} />
          {Array.from({ length: 10 }, (_, k) => (
            <div key={k} className="f3d__coil" style={{ transform: `rotateZ(${k * 36}deg) translateX(50px) rotateY(90deg)` }} />
          ))}
        </div>

        {/* 6 · TORQUE SENSOR — the FR3 signature: a spoked strain-gauge flexure
             ring in the output path, giving every joint true torque feedback */}
        <div className="f3d__part f3d__build" {...partAttrs('torque')}>
          <Ring d={86} op={0.8} thick={1.5} />
          <Ring d={34} op={0.8} />
          <Radial n={6} r={30} cls="f3d__flexspoke" />
          <Radial n={6} r={40} cls="f3d__gauge" from={30} />
        </div>

        {/* 7 · HOUSING — the cylindrical shell that closes over the whole joint,
             built from 14 flat slats around the axis (near slats spread apart,
             far ones bunch: textbook perspective convergence) */}
        <div className="f3d__part f3d__build" {...partAttrs('housing')}>
          {Array.from({ length: 14 }, (_, k) => (
            <div
              key={k}
              className="f3d__slat"
              style={{ transform: `rotateZ(${(k * 360) / 14}deg) translateX(58px) rotateY(90deg)` }}
            />
          ))}
        </div>

        {/* 8 · END CAP + output flange feeding the next link */}
        <div className="f3d__part f3d__build" {...partAttrs('endcap')}>
          <Ring d={58} op={0.85} thick={1.5} />
          <Radial n={6} r={22} cls="f3d__bolt" />
          <div className="f3d__pivot">
            <Box w={22} h={80} d={16} y={-46} z={6} />
            <div className="f3d__toolwrap" style={{ transform: 'translate3d(0,-88px,6px)' }}>
              <Ring d={20} op={0.9} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Flourish3D({ side = 'left' }) {
  const ref = useRef(null);
  const isLeft = side === 'left';

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const world = root.querySelector('.f3d__world');
    // Only the left stack explodes into its own faces; the right side's faces
    // ride their parent part in, so they must stay seated.
    const faces = isLeft ? Array.from(root.querySelectorAll('.f3d__face')) : [];

    // Right side: each motor part gets its own scroll window [lead, lead+SPAN].
    // SPAN is much wider than the 0.12 gap between leads, so ~3 parts are in
    // flight at once — a part starts arriving long before the previous seats.
    const BUILD_SPAN = 0.32;
    // EVERY leaf a build part can contain must be listed here — the build owns
    // their opacity, and anything omitted stays fully visible before its part
    // has arrived. Keep in sync when adding parts.
    const LEAF_SEL =
      '.f3d__face,.f3d__ring,.f3d__slat,.f3d__coil,.f3d__spoke,.f3d__bolt,' +
      '.f3d__ellipse,.f3d__tooth,.f3d__magnet,.f3d__flexspoke,.f3d__gauge';
    const builds = isLeft
      ? []
      : Array.from(root.querySelectorAll('.f3d__build')).map(el => ({
          el,
          lead: +el.dataset.lead,
          sz: +el.dataset.sz,
          fx: +el.dataset.fx,
          fy: +el.dataset.fy,
          fz: +el.dataset.fz,
          spin: +el.dataset.spin,
          // Base opacity must be sampled BEFORE we ever write an inline one.
          leaves: Array.from(el.querySelectorAll(LEAF_SEL)).map(l => ({
            l,
            base: parseFloat(getComputedStyle(l).opacity) || 1,
          })),
        }));
    const spinner = isLeft ? null : root.querySelector('.f3d__spin');
    const wirePaths = isLeft
      ? []
      : Array.from(root.querySelectorAll('.f3d__wirepath')).map(p => {
          const len = p.getTotalLength ? p.getTotalLength() : 0;
          p.style.strokeDasharray = `${len}`;
          return { p, len };
        });

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- scroll: explode/assemble + camera -------------------------------
    // k = 0 fully seated, 1 fully exploded. Two smooth cycles across the page
    // so the assembly breathes apart and back together as you scroll.
    const smooth = t => t * t * (3 - 2 * t);

    const place = (k, B) => {
      for (const el of faces) {
        el.style.transform = `${el.dataset.rot} translateZ(${(+el.dataset.z + +el.dataset.ex * k).toFixed(1)}px)`;
      }
      // The wire draws itself on first, before any motor part arrives.
      const wireP = clamp(B / 0.1, 0, 1);
      for (const w of wirePaths) {
        w.p.style.strokeDashoffset = `${(w.len * (1 - wireP)).toFixed(1)}`;
      }
      // The whole joint turns about its own axis while it assembles — a bit over
      // a full revolution across the page.
      if (spinner) spinner.style.transform = `rotateZ(${(B * 400).toFixed(1)}deg)`;

      // Each part eases in from its OWN direction (data-fx/fy/fz), tumbling and
      // spinning as it seats. Opacity is written on LEAVES only — putting it on
      // the part wrapper would trip the grouping-property rule and flatten that
      // part's 3D children.
      for (const b of builds) {
        const e = smooth(clamp((B - b.lead) / BUILD_SPAN, 0, 1));
        const away = 1 - e;
        const D = 210;
        const x = b.fx * away * D;
        const y = b.fy * away * D;
        const z = b.sz + b.fz * away * D;
        const s = 1 + away * 0.5;
        b.el.style.transform =
          `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) ` +
          `rotateX(${(away * b.fy * 52).toFixed(1)}deg) rotateY(${(away * -b.fx * 52).toFixed(1)}deg) ` +
          `rotateZ(${(away * b.spin).toFixed(1)}deg) scale(${s.toFixed(3)})`;
        for (const lf of b.leaves) lf.l.style.opacity = (lf.base * e).toFixed(3);
      }
    };

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      const k = 0.5 - 0.5 * Math.cos(p * TAU * 2);
      place(k, p);
      // Camera. Yaw deliberately crosses 0 so every box's left/right side wall
      // foreshortens to nothing and swaps over — a tell no 2D fake can produce.
      const yaw = (isLeft ? 1 : -1) * (26 - p * 48);
      const pitch = 7 + p * 9;
      if (world) world.style.transform = `rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
    };

    if (reduce) {
      place(0.5, 1); // composed: left half-exploded, right fully built
      if (world) world.style.transform = `rotateX(9deg) rotateY(${isLeft ? 20 : -20}deg)`;
      return;
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // --- anime.js: ambient life ------------------------------------------
    const q = s => Array.from(root.querySelectorAll(s));
    const anims = [
      // slow idle yaw so the piece lives even when the page is still
      animate(q('.f3d__idle'), {
        rotateY: [(isLeft ? -1 : 1) * 7, (isLeft ? 1 : -1) * 7],
        duration: 9000, loop: true, alternate: true, ease: 'inOutSine',
      }),
    ];

    if (isLeft) {
      anims.push(
        // spherical ripple through the activation plane (anime.js grid stagger)
        animate(q('.f3d__cell'), {
          translateZ: [0, 15],
          opacity: [0.3, 1],
          scale: [0.72, 1.06],
          delay: stagger(90, { grid: [4, 4], from: 'center' }),
          duration: 1400, loop: true, alternate: true, ease: 'inOutQuad',
        }),
        // the kernel rasters the grid with a stepped stride (a real convolution)
        animate(q('.f3d__kernel'), {
          translateX: [-39, 39],
          translateY: [-39, 39],
          duration: 5200, loop: true, alternate: true, ease: steps(4),
        }),
        // token row breathes in depth
        animate(q('.f3d__token'), {
          opacity: [0.35, 0.95],
          scale: [0.85, 1.08],
          delay: stagger(110, { from: 'center' }),
          duration: 1600, loop: true, alternate: true, ease: 'inOutSine',
        })
      );
    } else {
      anims.push(
        animate(q('.f3d__rotor'), { rotateZ: 360, duration: 4200, loop: true, ease: 'linear' }),
        // the link arm articulates like a joint under load
        animate(q('.f3d__pivot'), {
          rotateZ: [-16, 16],
          duration: 5200, loop: true, alternate: true, ease: 'inOutSine',
        }),
        // NB: nothing here may animate `.f3d__coil` (or any build leaf). Their
        // opacity is owned by the scroll-driven build, and a second writer makes
        // parts glow before they have arrived. A transform loop is worse still:
        // the coils use rotate-then-translate placement, which anime cannot
        // reproduce in its fixed component order and would destroy.
        animate(q('.f3d__wirepath'), {
          opacity: [0.5, 0.9],
          duration: 2200, loop: true, alternate: true, ease: 'inOutSine',
        })
      );
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      anims.forEach(a => a && a.revert && a.revert());
    };
  }, [isLeft]);

  return (
    <div className={`f3d f3d--${side}`} ref={ref} aria-hidden="true">
      <div className="f3d__world">
        <div className="f3d__idle">{isLeft ? <ConvStack /> : <MotorBuild />}</div>
      </div>
    </div>
  );
}
