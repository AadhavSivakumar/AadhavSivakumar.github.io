import React, { useEffect, useRef } from 'react';
import { animate, createTimeline, onScroll, stagger } from 'animejs';

// Page-wide decorative 3D flourishes — one per side, fixed to the viewport and
// scrubbed by page scroll. Built from HTML divs inside a real CSS 3D context
// (`perspective` + an unbroken `transform-style: preserve-3d` chain), so
// `translateZ` produces TRUE projective foreshortening. SVG cannot do this: a
// measured ±150px translateZ on an SVG node gave a size ratio of exactly 1.0.
//
//   LEFT  — "Train Loop": a four-layer network standing in real depth. A gold
//           packet runs down it, the answer comes out wrong against a target
//           chip, a teal packet crawls back UP (backprop — the one mechanic no
//           other domain owns), the wires it passes thicken or thin behind it,
//           a loss curve steps downward, and a decision panel resolves from
//           mottled noise into a clean two-tone split.
//   RIGHT — "Down the Shaft": an archetypal electric motor threading itself
//           together on ONE axis in assembly order — shaft, rotor, wound
//           stator, two end bells, vented can — and then running.
//
// ── Architecture ───────────────────────────────────────────────────────────
// Each side is ONE anime.js timeline whose playhead IS the page scroll: it is
// created with `autoplay: onScroll(...)`, anime v4.5's own ScrollObserver, so
// there is no hand-rolled scroll listener, no forced layout read per event, and
// `sync` gives the assembly weighted catch-up — it keeps settling after you
// stop scrolling, which is what makes it feel like it has mass.
// Timeline time 0…1000ms maps to page scroll 0…1, so a "beat at 0.46" is
// literally `.add(..., 460)`.
//
// ── The one rule this file lives or dies by ────────────────────────────────
// ONE WRITER PER PROPERTY. anime emits transform components in a FIXED order
// (translate → rotate → scale, see node_modules/animejs/dist/modules/core/
// consts.js `validTransforms`), so it can never reproduce a rotate-THEN-
// translate placement. Everything placed that way — helix chords, radial
// arrays, cylinder slats, network edges — carries a STATIC inline transform,
// and anime animates a CSS VARIABLE inside it instead of the transform itself.
// That is why edges can pulse and re-weight without anime ever touching their
// `transform`: the string is ours, the numbers inside it are anime's.

const DEG = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Deterministic pseudo-random, so the "learned" weights and the panel's noise
// are identical on every load and every reverse scroll.
const hash = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

// ── Connecting two points in 3D with a div ─────────────────────────────────
// A div is a plane, not a line: give it width L along its own +X and rotate
// that axis onto the direction we want.
//
//   translate3d(P1) rotateY(θ) rotateZ(φ)   applied to (L,0,0) gives
//   (L·cosφ·cosθ, L·sinφ, −L·cosφ·sinθ)
//
// so φ = asin(dy/L) and θ = atan2(−dz, dx). This is rotateY-BEFORE-rotateZ,
// which is exactly the order anime.js emits — the one orientation form that
// stays valid if a tween ever touches it. Verified by composing the matrices:
// worst tip error 2.9e-14px over 8 cases including all three degenerate axes,
// and the ribbon's thickness direction keeps an in-screen-plane component of
// ≥0.88 across the whole camera sweep, so an edge can never project to a
// hairline and vanish.
function link(p1, p2) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2];
  const L = Math.hypot(dx, dy, dz);
  return {
    L,
    t: `translate3d(${p1[0].toFixed(2)}px, ${p1[1].toFixed(2)}px, ${p1[2].toFixed(2)}px) ` +
       `rotateY(${(Math.atan2(-dz, dx) * DEG).toFixed(2)}deg) ` +
       `rotateZ(${(Math.asin(dy / L) * DEG).toFixed(2)}deg)`,
  };
}

// ── Shared primitives ──────────────────────────────────────────────────────
// Translucency lives in the COLOUR (a color-mix percentage), never in
// `opacity`: the build timeline owns every leaf's opacity to fade parts in as
// they arrive, and a second writer there would make a part glow before it has
// landed. `tone` is that percentage.
const wash = t => `color-mix(in srgb, var(--accent-color) ${t}%, transparent)`;

const FACE_EXPLODE = 74;

function boxFaces(w, h, d) {
  return [
    { key: 'front', W: w, H: h, rot: 'rotateY(0deg)', z: d / 2, tone: 100 },
    { key: 'back', W: w, H: h, rot: 'rotateY(180deg)', z: d / 2, tone: 38 },
    { key: 'right', W: d, H: h, rot: 'rotateY(90deg)', z: w / 2, tone: 60 },
    { key: 'left', W: d, H: h, rot: 'rotateY(-90deg)', z: w / 2, tone: 60 },
    { key: 'top', W: w, H: d, rot: 'rotateX(90deg)', z: h / 2, tone: 76 },
  ];
}

// A wireframe box: five faces (the bottom is omitted — the camera is always
// pitched slightly down), each rotated into its own plane then pushed out along
// that plane's normal, so the near ones visibly grow while the far ones shrink.
function Box({ w, h, d, y = 0, x = 0, z = 0, extraClass = '' }) {
  return (
    <div className={`f3d__part ${extraClass}`} style={{ transform: `translate3d(${x}px, ${y}px, ${z}px)` }}>
      {boxFaces(w, h, d).map(f => (
        <div
          key={f.key}
          className="f3d__face"
          data-ex={FACE_EXPLODE}
          style={{
            width: `${f.W}px`,
            height: `${f.H}px`,
            marginLeft: `${-f.W / 2}px`,
            marginTop: `${-f.H / 2}px`,
            borderColor: wash(f.tone),
            transform: `${f.rot} translateZ(${f.z}px)`,
          }}
        />
      ))}
    </div>
  );
}

// A flat ring (a perfect CSS circle) — the module's tilt turns it into a
// correctly eccentric perspective ellipse that re-shapes live as the camera
// pitches.
function Ring({ d, z = 0, tone = 70, thick = 1, cls = '' }) {
  // tone 0 = leave the colour to the class (used by the copper end turns)
  return (
    <div
      className={`f3d__ring ${cls}`}
      style={{
        width: `${d}px`, height: `${d}px`,
        marginLeft: `${-d / 2}px`, marginTop: `${-d / 2}px`,
        borderWidth: `${thick}px`, ...(tone ? { borderColor: wash(tone) } : null),
        transform: `translateZ(${z}px)`,
      }}
    />
  );
}

// Radial array (magnets, bolts, pole bars, ribs). Rotate-then-translate, which
// anime can never reproduce — STATIC inline only.
function Radial({ n, r, cls, from = 0, extra = '' }) {
  return Array.from({ length: n }, (_, k) => (
    <div key={k} className={cls} style={{ transform: `rotateZ(${from + (k * 360) / n}deg) translateX(${r}px) ${extra}` }} />
  ));
}

/* ══════════════════════════════════════════════════════════════════════════
   LEFT — "Train Loop"
   ══════════════════════════════════════════════════════════════════════════ */

// Four layers, alternating their depth sign so successive layers zigzag in plan
// view. Every layer spans 104px of DEPTH, so edges sweep through Z and cross in
// front of and behind each other — the thing a flat diagram cannot do. X
// narrows so the architecture reads as a funnel while depth stays uniform.
// 4-5-3-2 = 41 edges. It was 5-6-4-2 = 62, which at this size read as a
// hairball rather than as a network: past roughly 45 edges the individual
// connections stop being separable and the whole thing turns to spaghetti.
const LAYERS = [4, 5, 3, 2];
const LAYER_Y = [-96, -40, 16, 72];
const NODE_DX = 17;
const LAYER_DZ = 52;

const nodePos = (i, j) => {
  const n = LAYERS[i];
  const c = (n - 1) / 2;
  // Narrow layers get proportionally less depth: at n=2 the full spread threw
  // one output node 52px back, far enough that it read as a stray dot rather
  // than as part of the graph.
  const dz = LAYER_DZ * (n <= 2 ? 0.42 : n <= 3 ? 0.72 : 1);
  return [(j - c) * NODE_DX, LAYER_Y[i], c ? ((j - c) / c) * dz * (i % 2 ? -1 : 1) : 0];
};

const NODES = LAYERS.flatMap((n, i) => Array.from({ length: n }, (_, j) => ({ i, j, p: nodePos(i, j) })));

// 30 + 24 + 8 = 62 edges. `hop` is which layer gap it spans, which is what the
// forward and backward packets travel along.
const EDGES = LAYERS.slice(0, -1).flatMap((n, i) =>
  Array.from({ length: n }, (_, a) =>
    Array.from({ length: LAYERS[i + 1] }, (_, b) => {
      const id = `${i}-${a}-${b}`;
      const u = hash(i * 97 + a * 13 + b * 7);
      // Shaped so few weights land near zero: a network of uniformly middling
      // weights reads as decoration, not as something that has learned.
      const w = Math.sign(u - 0.5) * Math.pow(Math.abs(u * 2 - 1), 0.7);
      return { id, hop: i, w, ...link(nodePos(i, a), nodePos(i + 1, b)) };
    })
  ).flat()
).flat();

// Loss: an exponential decay with a cosine ripple on it. A smooth monotone
// curve reads as a loading bar; the ringing is what reads as an optimiser.
const LOSS_N = 24;
const lossPt = u => [-48 + 96 * u, 26 - 58 * (0.10 + 0.90 * Math.exp(-3.4 * u) * (1 + 0.30 * Math.cos(11 * u)) / 1.30), 0];
const LOSS_SEGS = Array.from({ length: LOSS_N }, (_, i) => link(lossPt(i / LOSS_N), lossPt((i + 1) / LOSS_N)));

// 5x5 decision panel. Each cell's FINAL side of the boundary is fixed; what
// animates is how strongly it commits. Resolving them in a scattered order is
// what produces the mottled intermediate state that reads as *learning*.
const PANEL_N = 5;
const CELL = 15;
const CELLS = Array.from({ length: PANEL_N * PANEL_N }, (_, i) => {
  const cx = i % PANEL_N, cy = Math.floor(i / PANEL_N);
  const d = Math.tanh(1.15 * ((cy - 2) - 0.80 * (cx - 2) + 0.62 * Math.sin((cx - 2) * 1.15)));
  return { cx, cy, pos: d > 0 };
});

// Training points. Three of them sit on the wrong side until late and then
// flip — one at a time, which is why each carries two stacked marks.
const PTS = Array.from({ length: 10 }, (_, i) => {
  const a = hash(i * 31 + 5), b = hash(i * 17 + 91);
  const cx = (a - 0.5) * 62, cy = (b - 0.5) * 62;   // inside the 79px panel frame
  const d = (cy / 30) - 0.80 * (cx / 30) + 0.62 * Math.sin(cx / 26);
  return { x: cx, y: cy, pos: d > 0, flips: i === 2 || i === 5 || i === 8 };
});

const OUT_A = nodePos(3, 0);
const TARGET = [OUT_A[0] + 34, OUT_A[1], OUT_A[2]];

function TrainLoop() {
  const delta = link(OUT_A, TARGET);
  return (
    <>
      {/* decision panel, floating above and behind the network */}
      <div className="f3d__mlpanel">
        <div className="f3d__mlpanelspin">
          <div className="f3d__mlframe" />
          {CELLS.map((c, i) => (
            <div
              key={i}
              className="f3d__mlcell"
              data-i={i}
              style={{
                transform: `translate3d(${(c.cx - 2) * CELL}px, ${(c.cy - 2) * CELL}px, 0)`,
                '--cell-base': c.pos ? 'var(--ml-pos)' : 'var(--ml-neg)',
              }}
            />
          ))}
        </div>
      </div>

      {/* the network itself */}
      <div className="f3d__mlnet">
        {EDGES.map(e => (
          <div
            key={e.id}
            className="f3d__mledge"
            data-hop={e.hop}
            data-w={e.w.toFixed(4)}
            style={{
              width: `${e.L.toFixed(2)}px`,
              // scaleY is the LAST component, so it thickens the ribbon about
              // its own centreline without touching its length or direction.
              transform: `${e.t} scaleY(calc(var(--k) + var(--swell)))`,
              '--edge-base': e.w > 0 ? 'var(--ml-pos)' : 'var(--ml-neg)',
            }}
          />
        ))}
        {NODES.map((n, i) => (
          <div
            key={i}
            className="f3d__mlnode"
            data-layer={n.i}
            style={{ transform: `translate3d(${n.p[0]}px, ${n.p[1]}px, ${n.p[2]}px) scale(calc(1 + 0.38 * var(--lit)))` }}
          />
        ))}
        {/* the verdict: a hollow target chip and the error bar between it and
            the output the network actually produced */}
        {/* the chip is wrapped so anime owns its whole transform (scale) and
            never has to merge with a static placement it did not write */}
        <div className="f3d__mlchipwrap" style={{ transform: `translate3d(${TARGET[0]}px, ${TARGET[1]}px, ${TARGET[2]}px)` }}>
          <div className="f3d__mlchip" />
        </div>
        <div
          className="f3d__mldelta"
          style={{ width: `${delta.L.toFixed(2)}px`, transform: `${delta.t} scaleY(var(--k))` }}
        />
      </div>

      {/* labelled training points, on their own plane in front */}
      <div className="f3d__mlpts">
        {PTS.map((p, i) => (
          <div key={i} className="f3d__mlptwrap" style={{ transform: `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)` }}>
            {p.flips && <div className="f3d__mlpt f3d__mlpt--wrong" style={{ '--pt-base': p.pos ? 'var(--ml-neg)' : 'var(--ml-pos)' }} />}
            <div className="f3d__mlpt" data-flip={p.flips ? 1 : 0} style={{ '--pt-base': p.pos ? 'var(--ml-pos)' : 'var(--ml-neg)' }} />
          </div>
        ))}
      </div>

      {/* loss curve */}
      <div className="f3d__mlloss">
        <div className="f3d__mllossspin">
          <div className="f3d__mlaxis f3d__mlaxis--y" />
          <div className="f3d__mlaxis f3d__mlaxis--x" />
          {LOSS_SEGS.map((s, i) => (
            <div key={i} className="f3d__mlseg" style={{ width: `${s.L.toFixed(2)}px`, transform: s.t }} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RIGHT — "Down the Shaft"
   ══════════════════════════════════════════════════════════════════════════ */

// A wound stator, the way a real one looks: copper bars lying IN the 12 slots
// along the core, tied together by an end-turn ring bulging past each end of the
// stack. This replaced a single big helix wound around the shaft axis — that is
// a solenoid, and it read as a spring in a cage rather than as a motor.
// Assembly order, centre outward, every part arriving along the SAME axis.
// `fz` dominates and lateral jitter is capped at 0.12 — 25px of sideways travel
// against 210px of axial travel — so parts visibly thread DOWN THE SHAFT
// instead of converging from six directions, which reads as a pile of boxes
// meeting rather than as an assembly. The two end bells are the one place ±fz
// is used, and it is legible precisely because it is symmetric about the axis.
const PARTS = [
  { id: 'shaft', lead: 0.02, sz: 118, dir: [0.06, -0.10, 1], spin: -180, ghost: { w: 13, h: 236, r: 0, z: 118 } },
  { id: 'rotor', lead: 0.11, sz: 105, dir: [-0.08, 0.12, 1], spin: 300, ghost: { w: 40, h: 40, r: 50, z: 105 } },
  { id: 'stator', lead: 0.20, sz: 105, dir: [0.10, 0.05, 1], spin: -260, ghost: { w: 124, h: 124, r: 50, z: 105 } },
  { id: 'rearbell', lead: 0.40, sz: 26, dir: [-0.05, -0.12, -1], spin: 220, ghost: { w: 164, h: 164, r: 50, z: 26 } },
  { id: 'frontbell', lead: 0.49, sz: 190, dir: [0.08, 0.10, 1], spin: -240, ghost: { w: 164, h: 164, r: 50, z: 190 } },
  { id: 'can', lead: 0.58, sz: 105, dir: [-0.10, 0.06, -1], spin: 200, ghost: { w: 156, h: 156, r: 50, z: 105 } },
];
const part = id => {
  const p = PARTS.find(x => x.id === id);
  return { 'data-id': id, style: { transform: `translate3d(0,0,${p.sz}px)` } };
};

function MotorBuild() {
  return (
    <div className="f3d__module">
      {/* dashed centreline — the signature of a real engineering assembly view */}
      <div className="f3d__axiswrap"><div className="f3d__axis" /></div>

      {/* Phantom outlines of where each part will seat. Seven divs, and they
          are what makes an incoming part read as heading for a NAMED SOCKET
          rather than drifting toward a blob. Deliberately OUTSIDE every
          .f3d__build so the build's leaf query can never claim their opacity
          and fly them in with the part they are supposed to be waiting for. */}
      <div className="f3d__ghosts">
        {PARTS.map(p => (
          <div
            key={p.id}
            className="f3d__ghost"
            data-id={p.id}
            style={{
              width: `${p.ghost.w}px`, height: `${p.ghost.h}px`,
              marginLeft: `${-p.ghost.w / 2}px`, marginTop: `${-p.ghost.h / 2}px`,
              borderRadius: `${p.ghost.r}%`,
              transform: `translateZ(${p.ghost.z}px)`,
            }}
          />
        ))}
      </div>

      {/* The whole machine turns about its own axis while it assembles, then
          HOLDS — so the rotor's spin at the bottom of the page is unambiguous
          rather than competing with a still-moving frame. */}
      <div className="f3d__spin">
        {/* 1 · SHAFT — the spine. Everything after it slides onto it, and its
             two 310x13 side faces sit under rotateY(90deg), so they project far
             narrower than 310px: the cheapest undeniable proof of real depth. */}
        <div className="f3d__build" {...part('shaft')}>
          {/* rotateX(90deg) maps the plate's HEIGHT onto the module's Z — the
              motor axis — the same trick .f3d__axiswrap uses. Without it the
              plate lies ACROSS the machine instead of along it. The second
              plate is the same thing rolled 90deg about the axis, so one of
              the two always faces the camera whatever the yaw. */}
          <div className="f3d__shaftplate" style={{ transform: 'rotateX(90deg)' }} />
          <div className="f3d__shaftplate" style={{ transform: 'rotateZ(90deg) rotateX(90deg)' }} />
          <Ring d={13} z={-118} tone={85} />
          <Ring d={13} z={118} tone={85} />
        </div>

        {/* 2 · ROTOR — back iron plus eight arc magnets, down the shaft */}
        <div className="f3d__build" {...part('rotor')}>
          <div className="f3d__rotor">
            <div className="f3d__rotorlife">
              <Ring d={40} z={-22} tone={80} />
              <Ring d={40} z={22} tone={80} />
              <Radial n={8} r={25} cls="f3d__magnet" />
              {/* cooling fan on the rear of the shaft — the trailing rotateZ is
                  about the RADIAL axis after the rotateY(90deg), so it pitches
                  each blade the way the helix chords are pitched */}
              <div className="f3d__part" style={{ transform: 'translateZ(-74px)' }}>
                <Radial n={8} r={24} cls="f3d__blade" extra="rotateY(90deg) rotateZ(34deg)" />
                <Ring d={22} tone={70} />
              </div>
            </div>
          </div>
        </div>

        {/* 3 · STATOR — laminated core with 12 axial pole bars, over the rotor.
             Radial stack outward, verified clear: shaft 6.5 | rotor core 20 |
             magnets 21.5-28.5 | stator bore 31 | WINDING 44 | poles 54 |
             stator OD 62 | can ribs 78 | bell flange 82. */}
        <div className="f3d__build" {...part('stator')}>
          <Ring d={62} z={-45} tone={40} />
          <Ring d={62} z={45} tone={40} />
          <Ring d={124} z={-45} tone={65} />
          <Ring d={124} z={45} tone={65} />
          {/* slot teeth on the lamination faces — the slotting reads from the
              end faces, where a viewer actually sees it, instead of from 12
              bars standing up inside the shell like a fence */}
          <div className="f3d__part" style={{ transform: 'translateZ(-45px)' }}>
            <Radial n={12} r={46} cls="f3d__tooth" />
          </div>
          <div className="f3d__part" style={{ transform: 'translateZ(45px)' }}>
            <Radial n={12} r={46} cls="f3d__tooth" />
          </div>
          {/* COPPER: bars lying in the slots, plus an end-turn ring bulging
              past each end of the stack. This is what a wound stator looks
              like. */}
          <Radial n={12} r={44} cls="f3d__slotbar" extra="rotateY(90deg)" />
          <Ring d={92} z={-52} tone={0} cls="f3d__endturn" thick={2} />
          <Ring d={92} z={52} tone={0} cls="f3d__endturn" thick={2} />
        </div>

        {/* 4 · REAR BELL — closes from behind, bearing boss + 6-bolt circle */}
        <div className="f3d__build" {...part('rearbell')}>
          <Ring d={164} tone={80} thick={1.5} />
          <Ring d={26} tone={90} />
          <Radial n={6} r={13} cls="f3d__ball" />
          <Radial n={6} r={62} cls="f3d__bolt" />
        </div>

        {/* 5 · FRONT BELL — closes from the front and carries the output flange
             the shaft protrudes through */}
        <div className="f3d__build" {...part('frontbell')}>
          <Ring d={164} tone={80} thick={1.5} />
          <Ring d={76} tone={70} />
          <Ring d={26} tone={90} />
          <Radial n={6} r={13} cls="f3d__ball" />
          <Radial n={6} r={62} cls="f3d__bolt" />
        </div>

        {/* 6 · VENTED CAN — LAST, and the part that fixes the silhouette. 16
             ribs at r=78: after rotateY(90deg) a rib's WIDTH maps to the axial
             direction and its HEIGHT stays tangential, so a CLOSED shell would
             need height = 2*78*tan(180/16) = 31.03px. These are 12px, leaving
             19px slots — deliberately vented, so the copper winding and the
             spinning rotor stay visible through the gaps. Recompute that pitch
             if you ever change n or r; do not copy the number. */}
        <div className="f3d__build" {...part('can')}>
          {/* COOLING FINS as a stack of circumferential rings, NOT longitudinal
              slats. A cylinder built from slats around the axis always reads as
              a picket fence or a birdcage — 14 of them plus 14 fins was 28
              vertical sticks and the machine inside was invisible. Rings follow
              the same perspective ellipse the bells and the winding do, so the
              shell reads as one turned cylinder, stays open enough to see the
              copper and the spinning rotor through, and looks like a finned
              motor housing rather than a cage. */}
          {Array.from({ length: 7 }, (_, k) => (
            <Ring key={k} d={156} z={-78 + k * 26} tone={30} />
          ))}
          <Ring d={156} z={-95} tone={75} thick={1.5} />
          <Ring d={156} z={95} tone={75} thick={1.5} />
          {/* terminal box on the flank, where the phase leads come out */}
          <div className="f3d__part" style={{ transform: 'rotateZ(90deg) translateX(86px) rotateZ(-90deg)' }}>
            <Box w={30} h={26} d={40} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function Flourish3D({ side = 'left' }) {
  const ref = useRef(null);
  const isLeft = side === 'left';

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const q = s => Array.from(root.querySelectorAll(s));
    const world = root.querySelector('.f3d__world');

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ms position in the timeline for a scroll fraction
    const at = f => f * 1000;
    const loops = [];

    // ── the scroll-scrubbed story ────────────────────────────────────────
    const tl = createTimeline({
      defaults: { ease: 'linear' },
      // Not a hand-rolled scroll listener: anime's own ScrollObserver, which
      // keeps ONE rAF-batched listener per container with cached bounds.
      // Threshold strings are '<container> <target>', container FIRST —
      // 'start start' → 'end end' reproduces scrollY / (scrollHeight -
      // innerHeight) exactly. `sync: 0.2` smooths the playhead toward the
      // scroll position instead of welding it there, so the machine has mass.
      // NB the target must be the document, never `.f3d` — a position:fixed
      // element's getBoundingClientRect is the viewport and the range collapses.
      autoplay: reduce ? false : onScroll({ target: document.body, enter: 'start start', leave: 'end end', sync: 0.2 }),
    });

    // Pin the total duration at exactly 1000ms so scroll fraction == ms/1000
    // regardless of where the last tween happens to end.
    tl.add({ duration: 1000 }, 0);

    // Camera. Yaw deliberately CROSSES 0 across the range so every box's left
    // and right side walls foreshorten to nothing and swap over — a tell no 2D
    // fake and no pre-rendered image sequence can produce. The dolly changes
    // the perspective DIVERGENCE itself, which orbiting alone cannot do.
    tl.add(world, {
      translateZ: isLeft ? [-70, 100] : [-140, 55],
      rotateX: [7, 16],
      rotateY: isLeft ? [26, -22] : [-28, 20],
      duration: 1000,
    }, 0);

    if (isLeft) {
      const edges = q('.f3d__mledge');
      const byHop = [0, 1, 2].map(h => edges.filter(e => +e.dataset.hop === h));
      const nodesByLayer = [0, 1, 2, 3].map(l => q(`.f3d__mlnode[data-layer="${l}"]`));

      // 1 · DATA IN — points drop toward the viewer, staggered.
      tl.add(q('.f3d__mlpt:not(.f3d__mlpt--wrong)'), {
        opacity: [0, 1], translateZ: [84, 3], scale: [0.4, 1],
        duration: 90, delay: stagger(6), ease: 'outQuad',
      }, at(0.01));
      tl.add(q('.f3d__mlpt--wrong'), { opacity: [0, 1], translateZ: [84, 3], scale: [0.4, 1], duration: 90, delay: stagger(6) }, at(0.01));
      // the untrained panel: every cell barely committed
      tl.add(q('.f3d__mlcell'), { '--r': [0, 0.18], duration: 120, delay: stagger(4, { from: 'center' }) }, at(0.02));

      // 2 · FORWARD PASS — a packet crawls hop by hop. The swell IS the packet:
      // each edge fattens as its wave passes, which is what stays legible at
      // 200px where a travelling dot would not.
      const FWD = [0.100, 0.145, 0.190];
      byHop.forEach((group, h) => {
        tl.add(group, {
          '--swell': [{ to: 0.55, duration: 38, ease: 'outQuad' }, { to: 0, duration: 38, ease: 'inQuad' }],
          delay: stagger(4),
        }, at(FWD[h]));
      });
      nodesByLayer.forEach((group, l) => {
        tl.add(group, {
          '--lit': [{ to: 1, duration: 34, ease: 'outQuad' }, { to: 0.18, duration: 60, ease: 'inOutSine' }],
          delay: stagger(4),
        }, at(0.10 + l * 0.045));
      });

      // 3 · WRONG — the output settles on the error hue, the target chip
      // appears beside it, and the delta bar between them opens up.
      tl.add(q('.f3d__mlnode[data-layer="3"]')[0], { '--err': [0, 1], duration: 60 }, at(0.26));
      tl.add(q('.f3d__mlchip'), { opacity: [0, 0.85], scale: [0.5, 1], duration: 60, ease: 'outBack(2)' }, at(0.26));
      tl.add(q('.f3d__mldelta'), { opacity: [0, 0.75], '--k': [0.1, 0.85], duration: 70, ease: 'outQuad' }, at(0.27));

      // 4 · BACKPROP — the same swell mechanic run right-to-left, hop 2 first.
      // This is the most ML-exclusive thing on the page: nothing in robotics or
      // graphics has a corrective wave that travels back up the graph.
      const BWD = [0.440, 0.390, 0.340];
      byHop.forEach((group, h) => {
        tl.add(group, {
          '--bwd': [{ to: 0.55, duration: 45, ease: 'outQuad' }, { to: 0, duration: 45, ease: 'inQuad' }],
          '--swell': [{ to: 0.30, duration: 45, ease: 'outQuad' }, { to: 0, duration: 45, ease: 'inQuad' }],
          // a wide stagger is what makes this read as a WAVE sweeping through
          // the layer; at 1.6ms the whole hop lit at once, which is a repaint
          delay: stagger(5, { reversed: true }),
        }, at(BWD[h]));
      });

      // 5 · RE-WEIGHT — each edge's thickness tween starts just AFTER its
      // backward packet passed it, so causality reads. Some thicken, some thin
      // to almost nothing; that asymmetry is what makes it look LEARNED rather
      // than merely animated. `outBack` overshoot is honest here — an optimiser
      // with momentum overshoots and settles.
      byHop.forEach((group, h) => {
        tl.add(group, {
          '--k': (el) => [0.17, 0.10 + 0.72 * Math.abs(+el.dataset.w)],
          // ^1.6 prunes: a near-zero weight fades almost out instead of sitting
          // there at the same weight as one the network actually learned
          opacity: (el) => [0.28, 0.10 + 0.72 * Math.pow(Math.abs(+el.dataset.w), 1.6)],
          duration: 140,
          ease: 'outBack(1.4)',
          delay: stagger([0, 26], { jitter: 8, seed: 11 }),
        }, at(BWD[h] + 0.07));
      });

      // 6 · LOSS CURVE draws downward alongside, with visible slope reversals.
      tl.add(q('.f3d__mlaxis'), { opacity: [0, 0.3], duration: 40 }, at(0.28));
      tl.add(q('.f3d__mlseg'), { opacity: [0, 0.85], duration: 26, delay: stagger(24) }, at(0.30));

      // 7 · EPOCH LOOP — three compressed forward/back cycles, each weaker than
      // the last, so the training visibly converges instead of just stopping.
      [0, 1, 2].forEach(n => {
        const amp = Math.pow(0.7, n);
        byHop.forEach((group, h) => {
          tl.add(group, {
            '--swell': [{ to: 0.34 * amp, duration: 22, ease: 'outQuad' }, { to: 0, duration: 22, ease: 'inQuad' }],
            delay: stagger(1),
          }, at(0.62 + n * 0.06 + h * 0.012));
        });
        // the nodes fire with each cycle too — measured without this, they sit
        // at their 0.18 baseline from the first pass all the way to 0.93, and
        // the epoch loop reads as edges twitching on a dead network.
        nodesByLayer.forEach((group, l) => {
          tl.add(group, {
            '--lit': [{ to: 0.75 * amp, duration: 18, ease: 'outQuad' }, { to: 0.18, duration: 30, ease: 'inOutSine' }],
            delay: stagger(2),
          }, at(0.62 + n * 0.06 + l * 0.011));
        });
      });
      tl.add(q('.f3d__mldelta'), { '--k': [0.85, 0.1], opacity: [0.75, 0.18], duration: 220, ease: 'inOutQuad' }, at(0.60));

      // 8 · BOUNDARY SHARPENS — the panel commits, cell by cell in a scattered
      // order, and the three mislabelled points flip one at a time.
      tl.add(q('.f3d__mlcell'), {
        '--r': [0.18, 1],
        duration: 90,
        delay: stagger([0, 90], { grid: [PANEL_N, PANEL_N], from: 'center', jitter: 22, seed: 7 }),
      }, at(0.76));
      tl.add(q('.f3d__mlpt--wrong'), { opacity: [1, 0], duration: 40, delay: stagger(28) }, at(0.82));
      tl.add(q('.f3d__mlnode[data-layer="3"]')[0], { '--err': [1, 0], duration: 90 }, at(0.84));

      // 9 · GENERALISE — one final clean forward sweep over the now-trained
      // network. Stillness after motion is what converged looks like.
      byHop.forEach((group, h) => {
        tl.add(group, {
          '--swell': [{ to: 0.5, duration: 30, ease: 'outQuad' }, { to: 0, duration: 30, ease: 'inQuad' }],
          delay: stagger(1.2),
        }, at(0.93 + h * 0.02));
      });
      nodesByLayer.forEach((group, l) => {
        tl.add(group, { '--lit': [{ to: 1, duration: 26 }, { to: 0.3, duration: 44 }], delay: stagger(3) }, at(0.935 + l * 0.018));
      });

      // ambient: the two side planes breathe on their own so the piece is alive
      // on a still page. Both wrappers carry NO static transform (their parents
      // hold the placement), so there is nothing here for anime to wipe.
      if (!reduce) {
        loops.push(
          animate(q('.f3d__mlpanelspin'), { rotateY: [20, 31], duration: 8200, loop: true, alternate: true, ease: 'inOutSine' }),
          animate(q('.f3d__mllossspin'), { rotateY: [-30, -19], duration: 7400, loop: true, alternate: true, ease: 'inOutSine' })
        );
      }
    } else {
      // 1 · every part threads in along the axis from its own lead, tumbling
      // and spinning as it goes. BUILD_SPAN (0.26) is far wider than the 0.09
      // gap between leads, so ~3 parts are always in flight — a part starts
      // arriving long before the previous one seats. Widen the gap or shrink
      // the span and it degenerates into a stiff one-at-a-time queue.
      const D = 210;
      const SPAN = 260;
      // outBack overshoots ~7% and settles: a machined snap into place rather
      // than easing to a dead stop.
      const SEAT = 'outBack(1.4)';

      PARTS.forEach(p => {
        const el = root.querySelector(`.f3d__build[data-id="${p.id}"]`);
        if (!el) return;
        tl.add(el, {
          translateX: [p.dir[0] * D, 0],
          translateY: [p.dir[1] * D, 0],
          translateZ: [p.sz + p.dir[2] * D, p.sz],
          rotateX: [p.dir[1] * 52, 0],
          rotateY: [-p.dir[0] * 52, 0],
          rotateZ: [p.spin, 0],
          scale: [1.5, 1],
          duration: SPAN,
          ease: SEAT,
        }, at(p.lead));
        // Opacity on LEAVES only — putting it on the part wrapper would trip
        // the grouping rule and flatten that part's 3D children.
        tl.add(el.querySelectorAll('.f3d__face,.f3d__ring,.f3d__shaftplate,.f3d__tooth,.f3d__magnet,.f3d__bolt,.f3d__blade,.f3d__ball'), {
          opacity: [0, 1], duration: SPAN * 0.7, ease: 'outQuad',
        }, at(p.lead));
        // its phantom fades out exactly as the real part lands on it
        tl.add(root.querySelector(`.f3d__ghost[data-id="${p.id}"]`), {
          opacity: [0.13, 0], duration: SPAN * 0.8, ease: 'inQuad',
        }, at(p.lead));
      });

      // 2 · the winding runs on turn by turn, from the lead-in outside the
      // machine to the last turn, finishing just as the stator settles over it.
      tl.add(q('.f3d__slotbar'), { opacity: [0, 1], duration: 45, delay: stagger(9) }, at(0.30));
      tl.add(q('.f3d__endturn'), { opacity: [0, 1], duration: 60 }, at(0.42));

      // 3 · the presentation turn: 340° while assembling, then HOLD.
      tl.add(q('.f3d__spin'), { rotateZ: [0, 340], duration: at(0.62), ease: 'inOutSine' }, 0);

      // 4 · SPIN-UP — the rotor starts turning the instant the stator seats and
      // accelerates to the bottom of the page, so you watch the bells and the
      // can close over a machine that is already running.
      tl.add(q('.f3d__rotor'), { rotateZ: [0, 3200], duration: at(0.54), ease: 'inQuad' }, at(0.46));

      // ambient idle so the motor is alive on a still page. This MUST live on
      // the nested .f3d__rotorlife, never on .f3d__rotor — two writers on the
      // same rotateZ would fight and jitter. Nested rotations about the same
      // axis simply add.
      if (!reduce) {
        loops.push(animate(q('.f3d__rotorlife'), { rotateZ: 360, duration: 9000, loop: true, ease: 'linear' }));
      }
    }

    if (reduce) {
      // One representative frame, composed rather than blank: the ML side
      // converged, the motor assembled and running.
      tl.seek(isLeft ? 990 : 920);
      if (world) world.style.transform = `translateZ(30px) rotateX(12deg) rotateY(${isLeft ? 12 : -12}deg)`;
      return () => { tl.revert(); };
    }

    // slow idle yaw so the piece breathes even when the page is still
    loops.push(animate(q('.f3d__idle'), {
      rotateY: [(isLeft ? -1 : 1) * 7, (isLeft ? 1 : -1) * 7],
      duration: 9000, loop: true, alternate: true, ease: 'inOutSine',
    }));

    return () => {
      loops.forEach(a => a && a.revert && a.revert());
      tl.revert();
    };
  }, [isLeft]);

  return (
    <div className={`f3d f3d--${side}`} ref={ref} aria-hidden="true">
      <div className="f3d__world">
        <div className="f3d__idle">{isLeft ? <TrainLoop /> : <MotorBuild />}</div>
      </div>
    </div>
  );
}
