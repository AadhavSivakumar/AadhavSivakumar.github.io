import React, { useEffect, useRef } from 'react';
// `steps` must be imported and passed as a FUNCTION: anime v4.5 removed the
// string form (ease: 'steps(4)' hits the deprecated list in easings/eases/
// parser.js, warns, and silently falls back to linear).
import { animate, stagger, steps, createTimeline } from 'animejs';

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

// The activation field is a real 4x4x2 VOXEL LATTICE, not a flat grid — two
// slices separated along Z. That is what lets anime.js's 3D grid stagger
// (`grid: [4, 4, 2]`) compute a true 3D Euclidean distance from the centre, so
// the activation wave radiates SPHERICALLY through a volume instead of rippling
// across a plane. It is anime.js's signature 3D move and needs real depth to read.
//
// EMISSION ORDER IS LOAD-BEARING: stagger derives toX = i%4, toY = floor(i/4)%4,
// toZ = floor(i/16), so cells must be emitted slice-outer, row-middle,
// column-inner (index = s*16 + iy*4 + ix). Any other order sends the wave down
// the wrong axis.
//
// The mask keeps every one of the 32 grid slots occupied (the indices must stay
// aligned) but renders the quiet ones as small dots — a dense input slice and a
// sparse feature slice. A full 4x4x2 of identical cells reads as rigid
// repetition; sparsity makes it read as activations.
const ACT_MASK = [
  ['####', '####', '.###', '##.#'], // slice 0 — input (dense)
  ['.#..', '.##.', '..#.', '.#..'], // slice 1 — features (sparse)
];
const SLICE_Z = [0, 46];

// LEFT — AI / ML. Feature volumes + activation voxel lattice + a token row that
// exists only because of perspective (identical CSS sizes, spread along Z).
function ConvStack() {
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

      {/* activation VOLUME floating in front of the input volume — two slices
          along Z so the anime.js grid:[4,4,2] stagger ripples spherically. */}
      <div className="f3d__part f3d__actplane" style={{ transform: 'translate3d(0, -150px, 40px)' }}>
        {ACT_MASK.map((slice, s) => (
          <div key={s} className="f3d__slice" style={{ transform: `translate3d(0, 0, ${SLICE_Z[s]}px)` }}>
            {slice.map((row, iy) =>
              row.split('').map((ch, ix) => (
                <div
                  key={`${iy}-${ix}`}
                  className="f3d__cellwrap"
                  style={{ transform: `translate3d(${(ix - 1.5) * 26}px, ${(iy - 1.5) * 26}px, 0)` }}
                >
                  <div className={`f3d__cell${ch === '#' ? '' : ' f3d__cell--dot'}`} />
                </div>
              ))
            )}
          </div>
        ))}
        {/* convolution kernel that rasters across the input slice */}
        <div className="f3d__kernel" />
      </div>

      {/* Token row — identical CSS sizes, spread purely along Z, so perspective
          alone does 100% of the size variation. Held at a static yaw so the row
          is never seen edge-on as the camera crosses 0. */}
      <div className="f3d__part" style={{ transform: 'translate3d(0, 176px, 0) rotateY(26deg)' }}>
        {Array.from({ length: TOKENS }, (_, i) => (
          <div
            key={i}
            className="f3d__tokwrap"
            style={{ transform: `translate3d(${(i - 3) * 6}px, 0, ${(i - 3) * 38}px)` }}
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
// The wire is a magnet-wire LEAD that runs in from outside and then winds into
// the stator's slots: a long straight tail, then a tight coil whose amplitude
// (WIRE_AMP) sits in the stator slot band — between the rotor OD and the stator
// OD — so the winding visibly occupies the slots rather than floating on the
// axis. Because it draws on from the tail end, you watch the wire arrive and
// then wind itself into the coils.
const WIRE_W = 150;
const WIRE_H = 260;
const WIRE_AMP = 46; // stator slot radius (rotor OD 30 < 46 < stator OD 58)
function windingPath() {
  const cx = WIRE_W / 2;
  const turns = 7;
  const yLead = 254; // outside the machine — the lead-in
  const yCoilStart = 176;
  const yCoilEnd = 84;
  const step = (yCoilStart - yCoilEnd) / turns;
  let d = `M ${cx} ${yLead} L ${cx} ${yCoilStart}`;
  for (let i = 0; i < turns; i++) {
    const ya = yCoilStart - i * step;
    const yb = yCoilStart - (i + 1) * step;
    const dir = i % 2 === 0 ? 1 : -1;
    d += ` Q ${cx + dir * WIRE_AMP} ${(ya + yb) / 2} ${cx} ${yb}`;
  }
  return d + ` L ${cx} 62`;
}
const WIRE_D = windingPath();

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
// Assembly order tells the story: the wire winds into the STATOR slots first,
// the ROTOR drops inside it, the harmonic-drive stage and torque sensor follow
// down the axis, and the CASING closes over everything last.
const FR3_PARTS = [
  // lead, seatZ, incoming direction (unit-ish), spin-in degrees
  { id: 'stator', lead: 0.10, sz: 80, dir: [0, 0, 1], spin: -260 },
  { id: 'rotor', lead: 0.19, sz: 80, dir: [0, -1, 0.3], spin: 340 },
  { id: 'wavegen', lead: 0.28, sz: 134, dir: [-1, 0.2, 0.3], spin: -300 },
  { id: 'flexspline', lead: 0.37, sz: 142, dir: [0.5, 1, 0], spin: 280 },
  { id: 'circspline', lead: 0.46, sz: 142, dir: [1, -0.3, 0.2], spin: -240 },
  { id: 'torque', lead: 0.55, sz: 180, dir: [-0.6, -1, 0.4], spin: 300 },
  { id: 'endcap', lead: 0.64, sz: 202, dir: [0.8, 0.5, 0.6], spin: -220 },
  { id: 'housing', lead: 0.74, sz: 108, dir: [0, 0, -1], spin: 200 },
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

        {/* 1 · STATOR — the laminated core the wire winds into. Its slot teeth
             sit at r=48, straddling the wire's own coil band (WIRE_AMP 46), so
             the winding reads as lying IN the slots. */}
        <div className="f3d__part f3d__build" {...partAttrs('stator')}>
          <Ring d={116} z={-26} op={0.6} />
          <Ring d={116} z={26} op={0.6} />
          <Ring d={72} z={-26} op={0.4} />
          <Ring d={72} z={26} op={0.4} />
          {Array.from({ length: 12 }, (_, k) => (
            <div key={k} className="f3d__coil" style={{ transform: `rotateZ(${k * 30}deg) translateX(48px) rotateY(90deg)` }} />
          ))}
        </div>

        {/* 2 · ROTOR — drops inside the wound stator; magnets on a back iron */}
        <div className="f3d__part f3d__build" {...partAttrs('rotor')}>
          <div className="f3d__rotor">
            <Ring d={60} z={-22} op={0.8} />
            <Ring d={60} z={22} op={0.8} />
            <Radial n={8} r={28} cls="f3d__magnet" />
          </div>
        </div>

        {/* 3 · WAVE GENERATOR — the harmonic drive's elliptical cam + bearing.
             The ellipse is the instantly-readable "this is a strain wave gear". */}
        <div className="f3d__part f3d__build" {...partAttrs('wavegen')}>
          <div className="f3d__ellipse" />
          <div className="f3d__ellipse f3d__ellipse--inner" />
          <Ring d={16} op={0.9} />
        </div>

        {/* 4 · FLEXSPLINE — flexible externally-toothed cup deformed by the cam */}
        <div className="f3d__part f3d__build" {...partAttrs('flexspline')}>
          <Ring d={64} z={-16} op={0.7} />
          <Ring d={64} z={16} op={0.55} />
          <Radial n={10} r={32} cls="f3d__tooth" />
        </div>

        {/* 5 · CIRCULAR SPLINE — rigid internally-toothed outer ring (2 more
             teeth than the flexspline: that difference IS the gear ratio) */}
        <div className="f3d__part f3d__build" {...partAttrs('circspline')}>
          <Ring d={84} z={-14} op={0.7} />
          <Ring d={84} z={14} op={0.7} />
          <Radial n={12} r={38} cls="f3d__tooth" from={15} />
        </div>

        {/* 6 · TORQUE SENSOR — the FR3 signature: a spoked strain-gauge flexure
             ring in the output path, giving every joint true torque feedback */}
        <div className="f3d__part f3d__build" {...partAttrs('torque')}>
          <Ring d={88} op={0.8} thick={1.5} />
          <Ring d={34} op={0.8} />
          <Radial n={6} r={31} cls="f3d__flexspoke" />
          <Radial n={6} r={41} cls="f3d__gauge" from={30} />
        </div>

        {/* 7 · END CAP + output flange feeding the next link */}
        <div className="f3d__part f3d__build" {...partAttrs('endcap')}>
          <Ring d={60} op={0.85} thick={1.5} />
          <Radial n={6} r={23} cls="f3d__bolt" />
          <div className="f3d__pivot">
            <Box w={22} h={80} d={16} y={-46} z={6} />
            <div className="f3d__toolwrap" style={{ transform: 'translate3d(0,-88px,6px)' }}>
              <Ring d={20} op={0.9} />
            </div>
          </div>
        </div>

        {/* 8 · CASING — LAST. The cylindrical shell closes over the whole joint,
             built from 16 flat slats around the axis (near slats spread apart,
             far ones bunch: textbook perspective convergence). */}
        <div className="f3d__part f3d__build" {...partAttrs('housing')}>
          {Array.from({ length: 16 }, (_, k) => (
            <div
              key={k}
              className="f3d__slat"
              style={{ transform: `rotateZ(${(k * 360) / 16}deg) translateX(68px) rotateY(90deg)` }}
            />
          ))}
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
    const BUILD_SPAN = 0.26;
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

    // The camera is an anime.js timeline parked at autoplay:false and scrubbed by
    // scroll via seek() — the same idiom ScrollProgress uses — instead of
    // hand-writing a transform string. anime is then the single writer on
    // `.f3d__world`, and the tween interpolation/easing is anime's, not ours.
    let cam = null;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      const k = 0.5 - 0.5 * Math.cos(p * TAU * 2);
      place(k, p);
      if (cam) cam.seek(1000 * p);
    };

    if (reduce) {
      place(0.5, 1); // composed: left half-exploded, right fully built
      if (world) world.style.transform = `rotateX(9deg) rotateY(${isLeft ? 20 : -20}deg)`;
      return;
    }

    // Camera yaw deliberately CROSSES 0 across the scroll range, so every box's
    // left and right side wall foreshortens to nothing and swaps over — a tell
    // no 2D fake can produce. Pitch deepens as the page descends.
    cam = createTimeline({ autoplay: false, defaults: { ease: 'linear' } }).add(
      world,
      {
        rotateX: [7, 16],
        rotateY: [(isLeft ? 1 : -1) * 26, (isLeft ? 1 : -1) * -22],
        duration: 1000,
      },
      0
    );

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
        // TRUE spherical ripple through the activation VOLUME. `grid: [4, 4, 2]`
        // makes anime.js compute a 3D Euclidean distance from the centre, so the
        // wave expands as a sphere through the two slices rather than sweeping
        // across a plane — and each cell also pops toward the camera in real Z.
        animate(q('.f3d__cell'), {
          translateZ: [0, 16],
          opacity: [0.16, 1],
          scale: [0.55, 1.06],
          delay: stagger(90, { grid: [4, 4, 2], from: 'center' }),
          duration: 900, loop: true, alternate: true, ease: 'inOutSine',
        }),
        // Depth rails breathe. Opacity ONLY — these use rotate-then-translate
        // placement, which anime can never reproduce in its fixed component
        // order, so it must never own their transform.
        animate(q('.f3d__rail'), {
          opacity: [0.16, 0.42],
          delay: stagger(90, { from: 'center' }),
          duration: 2600, loop: true, alternate: true, ease: 'inOutSine',
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
      if (cam && cam.revert) cam.revert();
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
