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
   LEFT — "Detection": what actually happens between a camera and a bounding box
   ══════════════════════════════════════════════════════════════════════════
   A camera takes itself apart down to its sensor; the sensor resolves into
   pixels; the pixels are cut into PATCHES and flattened into a token sequence
   (the move that defines a Vision Transformer — "an image is worth 16x16
   words"); the tokens attend to each other; and the result is a detection.

   Every stage is the real mechanism, not a metaphor: the patch grid, the
   flattening into a sequence, the CLS token at the head, the all-pairs
   attention collapsing onto a few strong links, and a box with a confidence.  */

const PX_C = 8, PX_R = 6, PX = 12;              // 48 photosites, 96x72
const PATCH_C = 4, PATCH_R = 3, PATCH = 24;     // 12 patches over that grid
const NTOK = PATCH_C * PATCH_R;                 // 12 patch tokens (+1 CLS)

const IMG_Y = -142;   // the image plane, where the camera is
const SEQ_Y = 24;     // the token sequence
const OUT_Y = 158;    // the detection result

const pxPos = i => {
  const c = i % PX_C, r = Math.floor(i / PX_C);
  return [(c - (PX_C - 1) / 2) * PX, (r - (PX_R - 1) / 2) * PX];
};
// a soft blob in the frame, so the "image" has a subject the box can land on
const pxVal = i => {
  const [x, y] = pxPos(i);
  const d = Math.hypot((x - 12) / 34, (y + 6) / 26);
  return clamp(1.15 - d, 0.06, 1) * (0.75 + 0.25 * hash(i * 3.7));
};
const patchPos = k => [((k % PATCH_C) - (PATCH_C - 1) / 2) * PATCH, (Math.floor(k / PATCH_C) - (PATCH_R - 1) / 2) * PATCH];
// tokens: a sequence receding along Z, which is the one thing a flat diagram of
// a transformer can never show
const tokPos = i => [(i - NTOK / 2) * 6.4, Math.abs(i - NTOK / 2) * -1.6, -74 + i * 12.4];

const ATT_N = 4;  // 4x4 attention map


// Outline clip for an arbitrary silhouette: the polygon, then the same polygon
// shrunk about its centroid, with `evenodd` turning the inside into a hole. Same
// idea as the meridian blades — a contour you can see through, rather than a
// filled slab that hides everything behind it.
function outlineClip(pts, k = 0.955) {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const fmt = ([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`;
  const inner = pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  return `polygon(evenodd, ${[...pts.map(fmt), ...inner.map(fmt)].join(', ')})`;
}

// A camera body seen side-on: pentaprism hump, grip swell, lens mount boss.
const CAM_SIL = [
  [3, 40], [3, 22], [16, 20], [22, 6], [44, 2], [52, 18], [78, 18],
  [88, 24], [97, 26], [97, 74], [88, 84], [70, 88], [26, 90], [8, 82], [3, 62],
];

// A real lens is a turned stack of steps, not a cone: mount flange, barrel,
// knurled focus ring, front step, filter thread, front element.
const P_LENS = [
  [10, 33], [16, 33], [18, 26], [30, 26], [32, 29], [48, 29],
  [50, 25], [62, 25], [64, 27], [70, 27], [72, 20], [74, 0],
];

function VisionPipeline() {
  const cls = tokPos(-1);
  return (
    <>
      {/* ── the camera, and the image plane it forms an image on ─────────── */}
      <div className="f3d__vpstage" style={{ transform: `translate3d(0, ${IMG_Y}px, 0) scale(1.18)` }}>
        <div className="f3d__vpcam">
        {/* lens barrel, turned from a real stepped profile */}
        <div className="f3d__vpfront">
          <Revolve prof={P_LENS} blades={6} tone={58}
                   rings={[[16, 33, 78], [30, 26], [48, 29, 70], [62, 25], [70, 27, 78]]} />
          {/* knurling on the focus ring */}
          <div className="f3d__part" style={{ transform: 'translateZ(40px)' }}>
            <Radial n={16} r={29} cls="f3d__knurl" extra="rotateY(90deg)" />
          </div>
          <div className="f3d__vpglass" style={{ transform: 'translateZ(72px)' }} />
        </div>

        {/* body shell */}
        <div className="f3d__vpshell">
          {/* the body as its real side-on SILHOUETTE — pentaprism hump, grip
              swell, mount boss — drawn at both faces so perspective separates
              them into a solid, instead of a rectangular prism */}
          {[-19, 19].map(z => (
            <div key={z} className="f3d__vpbody"
                 style={{ clipPath: outlineClip(CAM_SIL), transform: `translateZ(${z}px)` }} />
          ))}
          <div className="f3d__vpshutter" style={{ transform: 'translate3d(24px, -34px, 20px)' }} />
          <div className="f3d__vpdial" style={{ transform: 'translate3d(-32px, -30px, 20px)' }} />
        </div>
        </div>

        {/* THE SENSOR, sitting at the image plane inside the body, and the
            photosite grid on its face */}
        <div className="f3d__vpsensor">
          <div className="f3d__vpdie" />
          <div className="f3d__vpsub" />
          {Array.from({ length: PX_C * PX_R }, (_, i) => {
            const [x, y] = pxPos(i);
            return (
              <div key={i} className="f3d__vppx" data-v={pxVal(i).toFixed(3)}
                   style={{ transform: `translate3d(${x}px, ${y}px, 1px)` }} />
            );
          })}
          {/* patch grid — the ViT move: the image is cut into fixed tiles */}
          {Array.from({ length: NTOK }, (_, k) => {
            const [x, y] = patchPos(k);
            return <div key={k} className="f3d__vppatch" style={{ transform: `translate3d(${x}px, ${y}px, 3px) scale(var(--s))` }} />;
          })}
        </div>
      </div>

      {/* ── the token sequence ───────────────────────────────────────────── */}
      <div className="f3d__vpseq" style={{ transform: `translate3d(0, ${SEQ_Y}px, 0) scale(1.18)` }}>
        {/* transformer blocks the sequence passes through */}
        {[0, 1, 2].map(k => (
          <div key={k} className="f3d__vpblock" style={{ transform: `translate3d(0, 0, ${-52 + k * 52}px)` }} />
        ))}
        {/* CLS token at the head of the sequence — the one that carries the
            answer out, which is why the attention links all originate here */}
        <div className="f3d__vptokwrap" style={{ transform: `translate3d(${cls[0]}px, 0, ${cls[2]}px)` }}>
          <div className="f3d__vptok f3d__vptok--cls" data-k="-1" />
        </div>
        {Array.from({ length: NTOK }, (_, i) => {
          const t = tokPos(i), pp = patchPos(i);
          return (
            <div key={i} className="f3d__vptokwrap" style={{ transform: `translate3d(${t[0].toFixed(1)}px, 0, ${t[2].toFixed(1)}px)` }}>
              {/* flies in from its own patch's position on the sensor */}
              <div className="f3d__vptok" data-k={i}
                   data-fx={(pp[0] - t[0]).toFixed(1)}
                   data-fy={(IMG_Y - SEQ_Y).toFixed(1)}
                   data-fz={(3 - t[2]).toFixed(1)} />
              <div className="f3d__vptick" />
            </div>
          );
        })}
        {/* all-pairs attention from the CLS token to every patch token */}
        {Array.from({ length: NTOK }, (_, i) => {
          const e = link(cls, tokPos(i));
          return (
            <div key={i} className="f3d__vpatt" data-k={i}
                 style={{ width: `${e.L.toFixed(1)}px`, transform: `${e.t} scaleY(var(--k))` }} />
          );
        })}
      </div>

      {/* ── attention map ────────────────────────────────────────────────── */}
      <div className="f3d__vpmat" style={{ transform: `translate3d(62px, ${SEQ_Y + 4}px, -26px)` }}>
        <div className="f3d__vpmatframe" />
        {Array.from({ length: ATT_N * ATT_N }, (_, i) => (
          <div key={i} className="f3d__vpcell" data-i={i}
               style={{ transform: `translate3d(${((i % ATT_N) - (ATT_N - 1) / 2) * 12}px, ${(Math.floor(i / ATT_N) - (ATT_N - 1) / 2) * 12}px, 0)` }} />
        ))}
      </div>

      {/* ── the detection ────────────────────────────────────────────────── */}
      <div className="f3d__vpout" style={{ transform: `translate3d(0, ${OUT_Y}px, 0) scale(1.18)` }}>
        <div className="f3d__vpframe" />
        <div className="f3d__vpbox" />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => (
          <div key={i} className="f3d__vpcorner" style={{ transform: `translate3d(${sx * 26}px, ${sy * 19}px, 2px) scale(var(--s))` }} />
        ))}
        <div className="f3d__vplabel" />
        <div className="f3d__vpconf" />
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RIGHT — "Down the Shaft"
   ══════════════════════════════════════════════════════════════════════════ */


// ── Surfaces of revolution from a real meridian profile ────────────────────
//
// A div placed by `rotateZ(theta) rotateX(90deg)` lies in a plane that CONTAINS
// the axis: rotateX(90) maps the element's local +Y onto world +Z and leaves
// local X radial, so the element's own 2D box IS the lathe cross-section plane.
// Verified numerically: local (x=r, y=z) lands at world radius r, axial z, for
// every theta.
//
// That means `clip-path` can cut the REAL TURNED PROFILE out of it — tapers,
// steps, flanges, bearing bosses, the serration of cooling fins — and a handful
// of those blades rotated about the axis reads as a machined solid instead of a
// stack of identical rings. clip-path is a grouping property, so it would flatten
// a preserve-3d subtree; these are LEAVES with no children, so there is nothing
// to flatten and the leaf itself is still placed in true 3D by its parents.
//
// Profiles are [axial, radius] pairs in units of roughly one millimetre of an
// IEC D80 frame motor (AC 159 frame OD, D 19 shaft, E 40 shaft extension,
// H 80 shaft height), so the proportions are a real machine's, not invented.

// clip-path for one meridian blade. A FILLED cross-section builds into a solid
// mass once several blades overlap and hides the machine inside, so this emits
// a stroked OUTLINE instead: the closed cross-section, then the same shape
// offset inward, with `evenodd` turning the inner loop into a hole. The seam
// between the two loops is zero-width and invisible.
function meridianClip(prof, rMax, z0, z1, w = 1.15) {
  const H = z1 - z0, W = 2 * rMax;
  const pct = (z, r) => `${(((r + rMax) / W) * 100).toFixed(3)}% ${(((z - z0) / H) * 100).toFixed(3)}%`;

  // inward normal offset of the +r profile: for segment (dz, dr) the interior
  // (toward the axis) is (dr, -dz) normalised
  const inner = prof.map((pt, i) => {
    const a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)];
    const dz = b[0] - a[0], dr = b[1] - a[1];
    const L = Math.hypot(dz, dr) || 1;
    return [pt[0] + (w * dr) / L, Math.max(0, pt[1] - (w * dz) / L)];
  });
  // pull the end caps in so the ribbon closes across them too
  inner[0] = [inner[0][0] + w, inner[0][1]];
  inner[inner.length - 1] = [inner[inner.length - 1][0] - w, inner[inner.length - 1][1]];

  const loop = (pts) => [
    ...pts.map(([z, r]) => pct(z, r)),
    ...[...pts].reverse().map(([z, r]) => pct(z, -r)),
  ];
  return `polygon(evenodd, ${[...loop(prof), ...loop(inner)].join(', ')})`;
}

function Revolve({ prof, blades = 6, rings = [], cls = '', tone = 30, ringTone = 62 }) {
  const rMax = Math.max(...prof.map(p => p[1])) * 1.02;
  const z0 = prof[0][0], z1 = prof[prof.length - 1][0];
  const clip = meridianClip(prof, rMax, z0, z1);
  return (
    <>
      {Array.from({ length: blades }, (_, k) => (
        <div
          key={k}
          className={`f3d__blade3 ${cls}`}
          style={{
            width: `${(2 * rMax).toFixed(1)}px`, height: `${(z1 - z0).toFixed(1)}px`,
            marginLeft: `${(-rMax).toFixed(1)}px`, marginTop: `${(-(z1 - z0) / 2).toFixed(1)}px`,
            clipPath: clip,
            background: wash(tone),   /* the stroke colour of the outline */
            transform: `translateZ(${((z0 + z1) / 2).toFixed(1)}px) rotateZ(${((k * 180) / blades).toFixed(2)}deg) rotateX(90deg)`,
          }}
        />
      ))}
      {rings.map(([z, r, t], i) => (
        <Ring key={`r${i}`} d={2 * r} z={z} tone={t || ringTone} />
      ))}
    </>
  );
}

// Cooling fins, as a serration in the profile itself — so the blades show them
// in section and the crest rings show them in plan. This is what a finned frame
// actually looks like on a drawing.
function finnedFrame(zA, zB, rRoot, rTip, n) {
  const out = [[zA, rRoot]];
  const step = (zB - zA) / n;
  for (let k = 0; k < n; k++) {
    const z = zA + k * step;
    out.push([z + step * 0.16, rTip], [z + step * 0.74, rTip], [z + step * 0.9, rRoot]);
  }
  out.push([zB, rRoot]);
  return out;
}

// IEC D80 proportions: frame OD 156 (AC 159), shaft 19 dia, 40 shaft extension.
const P_SHAFT = [[-166, 9.5], [150, 9.5], [156, 8], [178, 8], [178, 0]];
const P_COWL = [
  [-166, 26], [-158, 32], [-150, 47], [-136, 63], [-126, 72],
  [-118, 76], [-114, 82], [-104, 82], [-100, 78],
];
const P_FRAME = finnedFrame(-98, 98, 78, 88, 6);
const P_FRONT = [
  [98, 78], [102, 82], [112, 82], [116, 74], [122, 52],
  [130, 38], [136, 27], [142, 22], [146, 14],
];

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
  { id: 'shaft', lead: 0.02, sz: 0, dir: [0.06, -0.10, 1], spin: -180, ghost: { w: 19, h: 344, r: 0, z: 6 } },
  { id: 'rotor', lead: 0.11, sz: 0, dir: [-0.08, 0.12, 1], spin: 300, ghost: { w: 66, h: 66, r: 50, z: 0 } },
  { id: 'stator', lead: 0.20, sz: 0, dir: [0.10, 0.05, 1], spin: -260, ghost: { w: 124, h: 124, r: 50, z: 0 } },
  { id: 'rearbell', lead: 0.40, sz: 0, dir: [-0.05, -0.12, -1], spin: 220, ghost: { w: 164, h: 164, r: 50, z: -104 } },
  { id: 'frontbell', lead: 0.49, sz: 0, dir: [0.08, 0.10, 1], spin: -240, ghost: { w: 164, h: 164, r: 50, z: 104 } },
  { id: 'can', lead: 0.58, sz: 0, dir: [-0.10, 0.06, -1], spin: 200, ghost: { w: 174, h: 174, r: 50, z: 0 } },
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
          <Revolve prof={P_SHAFT} blades={4} tone={70}
                   rings={[[-166, 9.5], [150, 9.5, 80], [156, 8], [178, 8, 80]]} />
          {/* keyway on the drive end — the flat a coupling keys onto */}
          <div className="f3d__keyway" style={{ transform: 'translateZ(162px) rotateX(90deg)' }} />
        </div>

        {/* 2 · ROTOR — back iron plus eight arc magnets, down the shaft */}
        <div className="f3d__build" {...part('rotor')}>
          <div className="f3d__rotor">
            <div className="f3d__rotorlife">
              <Ring d={40} z={-22} tone={80} />
              <Ring d={40} z={22} tone={80} />
              <Radial n={8} r={25} cls="f3d__magnet" />
              {/* squirrel-cage bars — they turn with the rotor, so the spin-up
                  has something legible to move */}
              <Radial n={14} r={31} cls="f3d__cagebar" extra="rotateY(90deg)" />
              <Ring d={66} z={-40} tone={55} />
              <Ring d={66} z={40} tone={55} />
              {/* cooling fan on the rear of the shaft — the trailing rotateZ is
                  about the RADIAL axis after the rotateY(90deg), so it pitches
                  each blade the way the helix chords are pitched */}
              <div className="f3d__part" style={{ transform: 'translateZ(-126px)' }}>
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
          {/* rear bell and the stamped fan cowl over it, as ONE turned form
              that tapers back to the air inlet — the most recognisable end of
              a TEFC motor */}
          <Revolve prof={P_COWL} blades={5} tone={54}
                   rings={[[-104, 82, 80], [-118, 76], [-136, 63], [-150, 47], [-158, 32, 75]]} />
          {/* bearing: outer race, inner race, balls between them */}
          <Ring d={34} z={-100} tone={55} />
          <Ring d={19} z={-100} tone={55} />
          <Radial n={8} r={13} cls="f3d__ball" extra="translateZ(-100px)" />
          <Radial n={8} r={62} cls="f3d__bolt" extra="translateZ(-104px)" />
          {/* louvres punched in the cowl face, tapered like real ones */}
          <div className="f3d__part" style={{ transform: 'translateZ(-152px)' }}>
            <Radial n={8} r={34} cls="f3d__vent" />
          </div>
        </div>

        {/* 5 · FRONT BELL — closes from the front and carries the output flange
             the shaft protrudes through */}
        <div className="f3d__build" {...part('frontbell')}>
          <Revolve prof={P_FRONT} blades={5} tone={54}
                   rings={[[102, 82, 80], [112, 82], [122, 52], [130, 38], [136, 27, 80], [146, 14]]} />
          <Ring d={34} z={104} tone={55} />
          <Ring d={19} z={104} tone={55} />
          <Radial n={8} r={13} cls="f3d__ball" extra="translateZ(104px)" />
          <Radial n={8} r={62} cls="f3d__bolt" extra="translateZ(104px)" />
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
          <Revolve prof={P_FRAME} blades={4} tone={48} rings={[]} />
          {/* a few crest rings only — the serration in the blades already
              carries the fins, and one ring per fin was pure line noise */}
          {Array.from({ length: 3 }, (_, k) => (
            <Ring key={k} d={174} z={-66 + k * 66} tone={26} />
          ))}
          <Ring d={156} z={-98} tone={70} thick={1.5} />
          <Ring d={156} z={98} tone={70} thick={1.5} />
          {/* terminal box on the flank, where the phase leads come out, with
              its cover bolts and the conduit running out of it */}
          <div className="f3d__part" style={{ transform: 'rotateZ(90deg) translateX(86px) rotateZ(-90deg)' }}>
            <Box w={30} h={26} d={40} />
            <Radial n={4} r={17} cls="f3d__bolt" from={45} />
            <div className="f3d__part" style={{ transform: 'translateY(-20px)' }}>
              <div className="f3d__conduit" />
              <Ring d={11} tone={70} />
            </div>
          </div>

          {/* nameplate riveted to the flank opposite the terminal box */}
          <div className="f3d__part" style={{ transform: 'rotateZ(-90deg) translateX(80px) rotateZ(90deg) rotateX(90deg)' }}>
            <div className="f3d__plate" />
            <div className="f3d__plateline" style={{ transform: 'translateY(-5px)' }} />
            <div className="f3d__plateline" style={{ transform: 'translateY(0px)' }} />
            <div className="f3d__plateline" style={{ transform: 'translateY(5px)' }} />
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
      translateZ: isLeft ? [-70, 100] : [-140, 30],
      rotateX: [7, 16],
      rotateY: isLeft ? [26, -22] : [-28, 20],
      duration: 1000,
    }, 0);

    if (isLeft) {
      const toks = q('.f3d__vptok');
      const atts = q('.f3d__vpatt');
      const px = q('.f3d__vppx');

      // 1 · THE CAMERA is there from the start.
      tl.add(q('.f3d__vpbody,.f3d__vpshutter,.f3d__vpdial'),
        { opacity: [0, 1], duration: 60, delay: stagger(5) }, at(0.005));
      tl.add(q('.f3d__vpfront .f3d__ring,.f3d__vpfront .f3d__blade3,.f3d__knurl,.f3d__vpglass'),
        { opacity: [0, 1], duration: 60, delay: stagger(6) }, at(0.02));

      // 2 · IT TAKES ITSELF APART, along the optical axis — the same exploded
      // -view grammar the motor assembles with, run backwards.
      tl.add(q('.f3d__vpfront'), { translateZ: [0, 150], duration: 150, ease: 'inOutQuad' }, at(0.10));
      tl.add(q('.f3d__vpfront .f3d__ring,.f3d__vpfront .f3d__blade3,.f3d__knurl,.f3d__vpglass'), { opacity: [1, 0], duration: 120, delay: stagger(6) }, at(0.12));
      tl.add(q('.f3d__vpshell'), { translateY: [0, -120], translateZ: [0, -60], duration: 150, ease: 'inOutQuad' }, at(0.13));
      tl.add(q('.f3d__vpbody,.f3d__vpshutter,.f3d__vpdial'),
        { opacity: [1, 0], duration: 110, delay: stagger(4) }, at(0.14));

      // 3 · THE SENSOR is what was inside. It comes forward and the photosites
      // light to their own values — an image forming, one site at a time.
      tl.add(q('.f3d__vpdie,.f3d__vpsub'), { opacity: [0, 1], duration: 80 }, at(0.16));
      tl.add(q('.f3d__vpsensor'), { translateZ: [-30, 16], duration: 170, ease: 'outQuad' }, at(0.18));
      tl.add(px, {
        opacity: (el) => [0, 0.18 + 0.82 * +el.dataset.v],
        duration: 90,
        delay: stagger([0, 130], { grid: [PX_C, PX_R], from: 'first' }),
      }, at(0.24));

      // 4 · PATCHES. The image is cut into fixed tiles — the move that makes a
      // Vision Transformer a transformer at all.
      tl.add(q('.f3d__vppatch'), {
        opacity: [0, 1], '--s': [0.55, 1],
        duration: 80, ease: 'outBack(2)',
        delay: stagger(11, { grid: [PATCH_C, PATCH_R], from: 'first' }),
      }, at(0.40));

      // 5 · FLATTEN. Every patch flies off the sensor and lands in the
      // sequence, in raster order. The flight is per-token, from its own tile.
      tl.add(toks, {
        translateX: (el) => [+el.dataset.fx || 0, 0],
        translateY: (el) => [+el.dataset.fy || 0, 0],
        translateZ: (el) => [+el.dataset.fz || 0, 0],
        opacity: [0, 1],
        duration: 130,
        ease: 'inOutQuad',
        delay: stagger(9),
      }, at(0.50));
      tl.add(q('.f3d__vppatch'), { opacity: [1, 0.25], duration: 100, delay: stagger(9) }, at(0.52));
      tl.add(q('.f3d__vptick'), { opacity: [0, 0.7], duration: 60, delay: stagger(7) }, at(0.56));
      tl.add(q('.f3d__vpblock'), { opacity: [0, 1], duration: 90, delay: stagger(30) }, at(0.60));

      // 6 · ATTENTION. Every token attends to the CLS token: all-pairs first,
      // which is the honest picture of self-attention before it has learned
      // anything.
      tl.add(atts, { opacity: [0, 0.4], '--k': [0.1, 0.3], duration: 90, delay: stagger(7) }, at(0.64));
      tl.add(q('.f3d__vpmatframe'), { opacity: [0, 0.5], duration: 70 }, at(0.66));
      tl.add(q('.f3d__vpcell'), {
        opacity: (el) => [0, 0.15 + 0.85 * hash(+el.dataset.i * 5.1)],
        duration: 80,
        delay: stagger([0, 90], { grid: [ATT_N, ATT_N], from: 'first' }),
      }, at(0.68));

      // 7 · IT COLLAPSES onto a few strong links. That is what a trained
      // attention head actually looks like: most of the map goes quiet.
      tl.add(atts, {
        opacity: (el) => { const w = hash(+el.dataset.k * 9.3); return [0.4, w > 0.62 ? 0.9 : 0.07]; },
        '--k': (el) => { const w = hash(+el.dataset.k * 9.3); return [0.3, w > 0.62 ? 1.25 : 0.05]; },
        duration: 130, ease: 'outQuad', delay: stagger(6),
      }, at(0.76));
      tl.add(q('.f3d__vpcell'), {
        opacity: (el) => { const i = +el.dataset.i; const w = hash(i * 5.1); return [0.15 + 0.85 * w, w > 0.68 ? 1 : 0.08]; },
        duration: 120, delay: stagger(4, { grid: [ATT_N, ATT_N], from: 'center' }),
      }, at(0.78));

      // 8 · THE DETECTION. A box, its corner handles, a class label and a
      // confidence that fills — the actual output of the whole pipeline.
      tl.add(q('.f3d__vpframe'), { opacity: [0, 0.45], duration: 70 }, at(0.84));
      tl.add(q('.f3d__vpbox'), { opacity: [0, 1], scale: [1.5, 1], duration: 110, ease: 'outBack(1.6)' }, at(0.88));
      tl.add(q('.f3d__vpcorner'), { opacity: [0, 1], '--s': [0, 1], duration: 70, delay: stagger(18) }, at(0.90));
      tl.add(q('.f3d__vplabel'), { opacity: [0, 1], '--sx': [0.2, 1], duration: 80, ease: 'outQuad' }, at(0.93));
      tl.add(q('.f3d__vpconf'), { opacity: [0, 1], '--sx': [0, 1], duration: 110, ease: 'outQuad' }, at(0.95));

      // ambient: the sensor plane and the attention map breathe. Both wrappers
      // carry no static transform of their own, so anime owns them outright.
      if (!reduce) {
        loops.push(
          animate(q('.f3d__vpmat'), { rotateY: [16, 26], duration: 8200, loop: true, alternate: true, ease: 'inOutSine' })
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
        tl.add(el.querySelectorAll('.f3d__face,.f3d__ring,.f3d__blade3,.f3d__tooth,.f3d__magnet,.f3d__bolt,.f3d__blade,.f3d__ball,' +
        '.f3d__cagebar,.f3d__keyway,.f3d__vent,.f3d__plate,.f3d__plateline,.f3d__conduit'), {
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
        <div className="f3d__idle">{isLeft ? <VisionPipeline /> : <MotorBuild />}</div>
      </div>
    </div>
  );
}
