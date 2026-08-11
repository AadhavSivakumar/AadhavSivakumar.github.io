import React, { useEffect, useRef } from 'react';
// NB: deliberately NO `steps` import. A stepped ease cannot drive the kernel
// raster: `ease` is an ANIMATION-level option, so translateX and translateY
// share one eased t — x === y on every frame, which traces the diagonal rather
// than scanning the grid — and floor-stepping the range parks 3 of its 4 dwells
// off the 26px cell pitch. Per-tween `modifier` snaps each axis to the real grid
// instead. (If a stepped ease is ever needed, import steps as a FUNCTION: v4.5
// removed the 'steps(4)' string form, which silently falls back to linear.)
import { animate, stagger, createTimeline } from 'animejs';

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

// Kernel raster slot -> lattice position. Slot 0..31 = slice*16 + iy*4 + ix, the
// same ordering the cells are emitted in, so the kernel walks the grid in step
// with the stagger's own indexing. The clamp is load-bearing: the tween reaches
// exactly 32 on its terminal frame, and an unclamped floor would throw the kernel
// a whole slice past the volume for one frame on every loop.
const kslot = v => Math.min(31, Math.floor(v));
const KX = i => (i % 4) * 26 - 39;
const KY = i => (Math.floor(i / 4) % 4) * 26 - 39;
const KZ = i => Math.floor(i / 16) * SLICE_Z[1] + 9; // sits just in front of its slice

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

// ── The magnet wire: a REAL 3D HELIX wound around the rotor core ────────────
//
// This used to be an SVG path — a serpentine of alternating quadratic curves in
// ONE FLAT PLANE, cloned onto a second plane 90° away. That is a sine wave, not
// a winding: it waggles from side to side along the axis and never encircles
// anything. (SVG could not have fixed it either — an SVG node ignores
// translateZ outright, so a path can never leave its own plane.)
//
// A winding is a HELIX, and the thing that makes a helix read as a helix is
// that it passes IN FRONT OF the core on the near side and BEHIND it on the far
// side. That is a depth fact, so it needs real 3D: the coil is built from short
// straight chord segments, each an HTML div placed on the helix by
//
//     translateZ(z) rotateZ(θ) translateX(r) rotateY(90deg) rotateZ(φ)
//
// Working the frames through: rotateZ(θ) translateX(r) puts the segment on the
// cylinder at angle θ; rotateY(90deg) then maps the element's WIDTH axis onto
// the module's axial (−Z) direction and leaves its HEIGHT axis tangential (the
// same fact the housing slats rely on); so the final rotateZ(φ) — which is now
// about the RADIAL axis — swings the segment's long axis within the
// axial/tangential plane, i.e. sets the helix PITCH.
//
// Matching the chord direction (tangential 2r·sin(Δθ/2), axial Δz) against that
// basis gives φ = atan2(2r·sin(Δθ/2), −Δz). Worth keeping the two degenerate
// checks that pin the sign: zero twist ⇒ φ = 180° (a straight axial run, which
// is exactly what the lead-in reuses), and zero pitch ⇒ φ = 90° (a flat ring).
//
// Using the true CHORD length (not the arc) makes consecutive segments share
// endpoints, so the polyline is continuous with no gaps at the joints.
//
// This is rotate-THEN-translate placement, so it is STATIC inline style only:
// anime.js emits transform components in a fixed order and can never reproduce
// it. The scroll handler animates these segments' OPACITY (a leaf property,
// safe under the grouping rule) to wind the wire on turn by turn.
const COIL_R = 45; // in the stator slot band: rotor OD 30 < 45 < stator OD 58
const COIL_TURNS = 5;
const COIL_SEG_PER_TURN = 16;
const COIL_ZC = 80; // the rotor/stator station on the module axis
const COIL_HALF = 34;
const LEAD_SEGS = 3;
const LEAD_LEN = 22;
const DEG = 180 / Math.PI;

function wireSegments() {
  const N = COIL_TURNS * COIL_SEG_PER_TURN;
  const z0 = COIL_ZC - COIL_HALF;
  const dz = (2 * COIL_HALF) / N;
  const dTheta = (COIL_TURNS * 360) / N;
  // Chord across one segment: tangential component + axial component.
  const half = (Math.PI * COIL_TURNS) / N; // half the angle subtended by one segment
  const chord = 2 * COIL_R * Math.sin(half);
  const len = Math.hypot(chord, dz);
  const phi = Math.atan2(chord, -dz) * DEG;
  // A chord's MIDPOINT lies inside the circle, at r·cos(half). Seat the segment
  // centres there so the endpoints land exactly on radius COIL_R and the turns
  // are a true inscribed polygon — otherwise every joint bulges ~0.9px proud.
  const rMid = COIL_R * Math.cos(half);

  const segs = [];
  // Lead-in first, so the draw-on reveal starts outside the machine: the tail
  // runs up the axis at θ = 0 and hands straight over to the first turn.
  for (let i = LEAD_SEGS; i > 0; i--) {
    const zm = z0 - (i - 0.5) * LEAD_LEN;
    segs.push({
      len: LEAD_LEN,
      t: `translateZ(${zm.toFixed(2)}px) translateX(${COIL_R}px) rotateY(90deg) rotateZ(180deg)`,
    });
  }
  for (let k = 0; k < N; k++) {
    segs.push({
      len,
      t:
        `translateZ(${(z0 + (k + 0.5) * dz).toFixed(2)}px) ` +
        `rotateZ(${((k + 0.5) * dTheta).toFixed(2)}deg) translateX(${rMid.toFixed(3)}px) ` +
        `rotateY(90deg) rotateZ(${phi.toFixed(2)}deg)`,
    });
  }
  return segs;
}
const WIRE_SEGS = wireSegments();

function Wire() {
  return (
    <div className="f3d__part f3d__wire">
      {WIRE_SEGS.map((s, i) => (
        <div
          key={i}
          className="f3d__wireseg"
          style={{ width: `${s.len.toFixed(2)}px`, marginLeft: `${(-s.len / 2).toFixed(2)}px`, transform: s.t }}
        />
      ))}
    </div>
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

        {/* 1 · STATOR — the laminated core the wire is wound into. The radial
             stack reads outward as a real machine section: rotor OD 30 | bore 36
             | WINDING 45 (the helix) | slot walls 52 | stator OD 58. The slot
             walls sit just OUTSIDE the coil so the winding visibly lies in the
             slots; they used to be at r=48, which put them on top of the wire. */}
        <div className="f3d__part f3d__build" {...partAttrs('stator')}>
          <Ring d={116} z={-26} op={0.6} />
          <Ring d={116} z={26} op={0.6} />
          <Ring d={72} z={-26} op={0.4} />
          <Ring d={72} z={26} op={0.4} />
          {Array.from({ length: 12 }, (_, k) => (
            <div key={k} className="f3d__coil" style={{ transform: `rotateZ(${k * 30}deg) translateX(52px) rotateY(90deg)` }} />
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
    const wireSegs = isLeft ? [] : Array.from(root.querySelectorAll('.f3d__wireseg'));

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- scroll: explode/assemble + camera -------------------------------
    // k = 0 fully seated, 1 fully exploded. Two smooth cycles across the page
    // so the assembly breathes apart and back together as you scroll.
    // Machined snap-into-place: each part overshoots its seat by ~7% and settles,
    // rather than easing to a dead stop the way a smoothstep does. This is
    // out-back with s = 1.4, written out rather than imported — `eases` is not in
    // anime 4.5's public type exports, and this is one line.
    // seat(0) === 0 and seat(1) === 1 exactly; it peaks at ~1.07 near t = 0.73.
    const seat = t => { const u = t - 1; return 1 + 2.4 * u * u * u + 1.4 * u * u; };

    const place = (k, B) => {
      for (const el of faces) {
        el.style.transform = `${el.dataset.rot} translateZ(${(+el.dataset.z + +el.dataset.ex * k).toFixed(1)}px)`;
      }
      // The wire winds itself on first, before any motor part arrives: a front
      // travels along the segment list (lead-in, then turn after turn), so you
      // watch the wire run in from outside and wrap the core. `nW * wireP - i`
      // is the front's position relative to segment i, clamped to a 1-segment
      // fade so the leading edge is soft rather than a hard on/off.
      const wireP = clamp(B / 0.1, 0, 1);
      const nW = wireSegs.length;
      for (let i = 0; i < nW; i++) {
        wireSegs[i].style.opacity = (0.8 * clamp(nW * wireP - i, 0, 1)).toFixed(3);
      }
      // The whole joint turns about its own axis while it assembles — a bit over
      // a full revolution across the page.
      if (spinner) spinner.style.transform = `rotateZ(${(B * 400).toFixed(1)}deg)`;

      // Each part eases in from its OWN direction (data-fx/fy/fz), tumbling and
      // spinning as it seats. Opacity is written on LEAVES only — putting it on
      // the part wrapper would trip the grouping-property rule and flatten that
      // part's 3D children.
      for (const b of builds) {
        const e = seat(clamp((B - b.lead) / BUILD_SPAN, 0, 1));
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
        // clamp: `seat` overshoots past 1, and an unclamped multiply would flash
        // the leaf brighter than its designed base opacity as the part settles.
        for (const lf of b.leaves) lf.l.style.opacity = (lf.base * clamp(e, 0, 1)).toFixed(3);
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
      // Parked mid-dolly so the static pose matches the middle of the scroll range.
      if (world) world.style.transform = `translateZ(20px) rotateX(9deg) rotateY(${isLeft ? 20 : -20}deg)`;
      return;
    }

    // Camera yaw deliberately CROSSES 0 across the scroll range, so every box's
    // left and right side wall foreshortens to nothing and swaps over — a tell
    // no 2D fake can produce. Pitch deepens as the page descends.
    cam = createTimeline({ autoplay: false, defaults: { ease: 'linear' } }).add(
      world,
      {
        // Dolly along the view axis as the page descends, so the perspective
        // DIVERGENCE itself changes — near parts gain size faster than far ones
        // and the depth spread visibly stretches, which orbiting alone can't do.
        // With perspective:720px this runs 720/800 = 0.90x at the top of the page
        // to 720/600 = 1.20x at the bottom; the deepest geometry still sits well
        // short of the camera plane, so nothing inverts.
        translateZ: [-80, 120],
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
        // The convolution kernel rasters each 4x4 slice row-major and then steps
        // BACK to the next slice, so the scan window travels through the lattice
        // VOLUME rather than across one plane — and visibly shrinks as it recedes.
        // One linear tween per axis, each snapped onto the real 26px cell pitch by
        // a per-tween `modifier` (see the import note for why a stepped ease
        // cannot do this). Indices 0..31 = slice*16 + row*4 + col, matching the
        // lattice's own emission order.
        animate(q('.f3d__kernel'), {
          translateX: { from: 0, to: 32, modifier: v => KX(kslot(v)) },
          translateY: { from: 0, to: 32, modifier: v => KY(kslot(v)) },
          translateZ: { from: 0, to: 32, modifier: v => KZ(kslot(v)) },
          duration: 12800, loop: true, ease: 'linear',
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
        })
        // NB: nothing here may animate `.f3d__coil` or `.f3d__wireseg` (or any
        // build leaf). Their opacity is owned by the scroll-driven build/wind-on,
        // and a second writer makes parts glow before they have arrived. A
        // transform loop is worse still: both use rotate-then-translate
        // placement, which anime cannot reproduce in its fixed component order
        // and would destroy. (Nor may anything animate a transform on
        // `.f3d__module` itself: its tilt comes from the STYLESHEET, and anime
        // only merges *inline* static components — it would wipe the tilt.)
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
