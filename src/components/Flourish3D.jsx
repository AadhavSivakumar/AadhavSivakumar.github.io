import React, { useEffect, useRef } from 'react';
import { onScroll as onPageScroll } from '../scrollDriver';

// Page-wide decorative flourishes — one per side, fixed to the viewport and
// scrubbed by page scroll.
//
//   LEFT  — "Detection": a camera takes itself apart down to its sensor; the
//           sensor resolves into pixels; the pixels are cut into PATCHES and
//           flattened into a token sequence (the move that defines a Vision
//           Transformer); the tokens attend to each other; the result is a
//           detection.
//   RIGHT — "Down the Shaft": an IEC-proportioned electric motor threading
//           itself together on one axis, then running.
//
// ── Why this is a canvas and not 300 divs ──────────────────────────────────
// It was CSS 3D: every part a div inside a `transform-style: preserve-3d` tree.
// That is genuinely 3D and it looked right, but it cost the browser a re-sort
// and re-rasterise of every element in both trees on every camera change.
// Measured with geckodriver, rAF intervals during a scripted scroll:
//
//     no flourishes                     17.2 ms/frame
//     DOM, 356 elements                 33.2 ms
//     DOM, 261 elements (27% trimmed)   33.2 ms   <- no better
//     canvas, 4000 segments per frame   17.1 ms   <- same as drawing nothing
//
// The DOM cost is not linear in element count in that range: the work overruns
// the 16.7 ms budget either way and the frame drops to the next vsync. Coming
// back under would need roughly a 5-10x cut, which deletes the detail the
// pieces exist for. Doing the projection by hand and stroking paths removes the
// expensive part entirely — the browser composites ONE element per side — and
// makes complexity nearly free.
//
// What carried over unchanged: the geometry (the IEC D80 motor profiles, the
// meridian maths, the ViT patch/token layout), the beat timings, both themes,
// reduced-motion, and the >=992px gate in App.jsx.

const hexToRgb = h => {
  const v = h.replace('#', '').trim();
  const n = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  return [parseInt(n.slice(0, 2), 16) || 0, parseInt(n.slice(2, 4), 16) || 0, parseInt(n.slice(4, 6), 16) || 0];
};

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const win = (p, lead, span) => clamp((p - lead) / span, 0, 1);
const smooth = t => t * t * (3 - 2 * t);
// out-back: overshoots ~7% and settles, so parts snap into place the way
// machined things do rather than easing to a dead stop
const seat = t => { const u = t - 1; return 1 + 2.4 * u * u * u + 1.4 * u * u; };
const hash = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/* ── linear algebra ─────────────────────────────────────────────────────── */

const mul = (A, B) => [
  A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8],
];
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const scaleM = k => [k, 0, 0, 0, k, 0, 0, 0, k];

// A placement is a 3x3 rotation/scale plus a translation.
const place = (m, t) => ({ m, t });
const chain = (a, b) => place(mul(a.m, b.m), [
  a.m[0] * b.t[0] + a.m[1] * b.t[1] + a.m[2] * b.t[2] + a.t[0],
  a.m[3] * b.t[0] + a.m[4] * b.t[1] + a.m[5] * b.t[2] + a.t[1],
  a.m[6] * b.t[0] + a.m[7] * b.t[1] + a.m[8] * b.t[2] + a.t[2],
]);

/* ── geometry: everything is a list of polylines in local space ──────────── */

// a circle in the XY plane at height z — the axis is Z throughout
function ring(r, z, n = 40) {
  const pts = new Array(n + 1);
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; pts[i] = [r * Math.cos(a), r * Math.sin(a), z]; }
  return pts;
}

// One meridian section of a surface of revolution, at angle `th`. In canvas a
// stroked polyline IS an outline, so unlike the CSS version this needs no
// clip-path and no evenodd hole — the closed cross-section is simply a path.
function meridian(prof, th) {
  const c = Math.cos(th), s = Math.sin(th);
  const out = [];
  for (const [z, r] of prof) out.push([r * c, r * s, z]);
  for (let i = prof.length - 1; i >= 0; i--) { const [z, r] = prof[i]; out.push([-r * c, -r * s, z]); }
  out.push(out[0]);
  return out;
}

function revolve(prof, blades, ringsAt = []) {
  const polys = [];
  for (let k = 0; k < blades; k++) polys.push(meridian(prof, (k * Math.PI) / blades));
  for (const [z, r] of ringsAt) polys.push(ring(r, z));
  return polys;
}

// n copies of a shape placed around the axis
function radial(n, make) {
  const polys = [];
  for (let k = 0; k < n; k++) polys.push(...make((k / n) * TAU, k));
  return polys;
}
const at = (a, R, z) => [R * Math.cos(a), R * Math.sin(a), z];
const ringAt = (r, cx, cy, z, n = 10) => ring(r, z, n).map(q => [q[0] + cx, q[1] + cy, q[2]]);

// a small box, as its 12 edges
function boxWire(w, h, d, cx = 0, cy = 0, cz = 0) {
  const X = w / 2, Y = h / 2, Z = d / 2;
  const v = [
    [cx - X, cy - Y, cz - Z], [cx + X, cy - Y, cz - Z], [cx + X, cy + Y, cz - Z], [cx - X, cy + Y, cz - Z],
    [cx - X, cy - Y, cz + Z], [cx + X, cy - Y, cz + Z], [cx + X, cy + Y, cz + Z], [cx - X, cy + Y, cz + Z],
  ];
  return [
    [v[0], v[1], v[2], v[3], v[0]], [v[4], v[5], v[6], v[7], v[4]],
    [v[0], v[4]], [v[1], v[5]], [v[2], v[6]], [v[3], v[7]],
  ];
}

// a flat rectangle in the XY plane
const rect = (w, h, x, y, z) => [
  [x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z], [x - w / 2, y - h / 2, z],
];

/* ── shaded solids ───────────────────────────────────────────────────────
   The wireframe above is still used for fine detail (cage bars, copper, teeth,
   louvres, bolts) because at this size a line reads better than a 2px sliver of
   filled geometry. The MASSES — frame, bells, cowl, shaft, cores, camera body,
   lens — are surfaces: quads with a normal, lit and depth-sorted, so they read
   as rendered metal instead of blueprint linework.

   A face is { v: [p0,p1,p2,p3], n: [x,y,z] }. Normals are computed once in
   local space from the winding of the first three vertices, and rotated per
   frame by the part's own matrix (uniform scale only, so no inverse-transpose
   needed). */

function faceNormal(v) {
  const [a, b, c] = v;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
  const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
  const L = Math.hypot(nx, ny, nz) || 1;
  return [nx / L, ny / L, nz / L];
}
const face = v => ({ v, n: faceNormal(v) });

// a surface of revolution as quads: one band per profile segment
function surface(prof, segs = 14) {
  const out = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const [z0, r0] = prof[i], [z1, r1] = prof[i + 1];
    if (r0 === 0 && r1 === 0) continue;
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * TAU, a1 = ((k + 1) / segs) * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      out.push(face([
        [r0 * c0, r0 * s0, z0], [r0 * c1, r0 * s1, z0],
        [r1 * c1, r1 * s1, z1], [r1 * c0, r1 * s0, z1],
      ]));
    }
  }
  return out;
}

// an end cap / annulus
function disc(rIn, rOut, z, segs = 14) {
  const out = [];
  for (let k = 0; k < segs; k++) {
    const a0 = (k / segs) * TAU, a1 = ((k + 1) / segs) * TAU;
    out.push(face([
      [rIn * Math.cos(a0), rIn * Math.sin(a0), z], [rOut * Math.cos(a0), rOut * Math.sin(a0), z],
      [rOut * Math.cos(a1), rOut * Math.sin(a1), z], [rIn * Math.cos(a1), rIn * Math.sin(a1), z],
    ]));
  }
  return out;
}

function boxFaces(w, h, d, cx = 0, cy = 0, cz = 0) {
  const X = w / 2, Y = h / 2, Z = d / 2;
  const P = (sx, sy, sz) => [cx + sx * X, cy + sy * Y, cz + sz * Z];
  return [
    face([P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)]),
    face([P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)]),
    face([P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1)]),
    face([P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)]),
    face([P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)]),
    face([P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1)]),
  ];
}

// a flat quad facing +Z
const plate = (w, h, x, y, z) => [face([
  [x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z],
])];

// extrude a 2D silhouette between two Z planes: side walls plus both caps
function extrude(sil, z0, z1) {
  const out = [];
  for (let i = 0; i < sil.length; i++) {
    const a = sil[i], b = sil[(i + 1) % sil.length];
    out.push(face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]));
  }
  const capA = sil.map(([x, y]) => [x, y, z1]);
  const capB = [...sil].reverse().map(([x, y]) => [x, y, z0]);
  out.push(face(capA), face(capB));
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   RIGHT — the motor. Profiles in units of ~1mm of an IEC D80 frame:
   AC 159 frame OD, D 19 shaft, E 40 shaft extension, H 80 shaft height.
   ══════════════════════════════════════════════════════════════════════════ */

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

// a square-section bar lying along the axis at radius R — solid, so it sorts
// against the shell instead of being painted over it
function barSolid(a, R, z0, z1, w) {
  const c = Math.cos(a), s2 = Math.sin(a), h = w / 2;
  const rr = [R - h, R + h];
  const P = (ri, t, z) => [rr[ri] * c - t * h * s2, rr[ri] * s2 + t * h * c, z];
  return [
    face([P(1, -1, z0), P(1, 1, z0), P(1, 1, z1), P(1, -1, z1)]),
    face([P(0, 1, z0), P(0, -1, z0), P(0, -1, z1), P(0, 1, z1)]),
    face([P(0, -1, z0), P(1, -1, z0), P(1, -1, z1), P(0, -1, z1)]),
    face([P(1, 1, z0), P(0, 1, z0), P(0, 1, z1), P(1, 1, z1)]),
  ];
}

const P_SHAFT = [[-166, 9.5], [150, 9.5], [156, 8], [178, 8], [178, 0]];
const P_COWL = [[-166, 26], [-158, 32], [-150, 47], [-136, 63], [-126, 72], [-118, 76], [-114, 82], [-104, 82], [-100, 78]];
const P_FRAME = finnedFrame(-98, 98, 78, 86, 9);
// The OCCLUDER for the frame is a plain cylinder, not the serrated profile.
// Filling the serration made the assembled machine a scalloped barrel — six
// fat bands with a domed bell on each end, which read as a beehive rather than
// as a motor. A technical drawing solves this the same way: a clean cylindrical
// silhouette, with the fins drawn ON it as lines.
const P_FRAME_SOLID = [[-98, 82], [98, 82]];
const P_FRONT = [[98, 78], [102, 82], [112, 82], [116, 74], [122, 52], [130, 38], [136, 27], [142, 22], [146, 14]];

// Every part arrives along the SAME axis in assembly order: `fz` dominates and
// the lateral jitter is capped, so parts thread down the shaft rather than
// converging from six directions, which reads as a pile of boxes meeting.
const MOTOR_SPEC = [
  {
    id: 'shaft', lead: 0.02, dir: [0.06, -0.10, 1], spin: -180, spins: true,
    ghost: () => [ring(9.5, -166, 20), ring(9.5, 178, 20)],
    solids: () => [...surface(P_SHAFT, 14), ...disc(0, 9.5, -166, 14)],
    polys: () => [
      ...revolve(P_SHAFT, 3, [[-166, 9.5], [150, 9.5], [178, 8]]),
      rect(7, 16, 0, 0, 162),                                    // keyway, drive end
    ],
  },
  {
    id: 'rotor', lead: 0.11, dir: [-0.08, 0.12, 1], spin: 300, spins: true,
    ghost: () => [ring(33, 0, 28)],
    solids: () => [
      ...surface([[-40, 33], [40, 33]], 22), ...disc(9.5, 33, -40, 22), ...disc(9.5, 33, 40, 22),
    ],
    polys: () => [
      ring(20, -22), ring(20, 22), ring(33, -40), ring(33, 40),
      // arc-segment magnets on the back iron
      ...radial(6, a => {
        const w = 0.34, arc = [], arc2 = [];
        for (let i = 0; i <= 5; i++) {
          const t = a - w / 2 + (i / 5) * w;
          arc.push([28 * Math.cos(t), 28 * Math.sin(t), -16]);
          arc2.push([28 * Math.cos(t), 28 * Math.sin(t), 16]);
        }
        return [arc, arc2, [arc[0], arc2[0]], [arc[5], arc2[5]]];
      }),
      // squirrel-cage bars — they turn with the rotor
      ...radial(9, a => [[at(a, 31, -38), at(a, 31, 38)]]),
    ],
  },
  {
    // The cooling fan is its OWN part. It used to be drawn as part of the
    // rotor, 86 units behind it, which meant the exploded view had a rotor
    // with a fan floating off one end rather than a fan you could see arrive.
    id: 'fan', lead: 0.14, dir: [0.10, -0.06, 1], spin: 260, spins: true,
    ghost: () => [ring(44, -128, 20)],
    solids: () => [...surface([[-136, 16], [-118, 16]], 16), ...disc(9.5, 16, -136, 16)],
    polys: () => [
      ...radial(8, a => {
        const rake = 0.34;
        return [[at(a, 16, -125), at(a + rake * 0.4, 28, -132), at(a + rake, 44, -136), at(a + rake * 0.5, 36, -121), at(a, 16, -125)]];
      }),
      ring(16, -125, 20), ring(44, -134, 24), ring(9.5, -136, 16),
    ],
  },
  {
    id: 'stator', lead: 0.20, dir: [0.10, 0.05, 1], spin: -260,
    ghost: () => [ring(62, 0, 32)],
    solids: () => [
      ...surface([[-45, 62], [45, 62]], 24), ...disc(31, 62, -45, 24), ...disc(31, 62, 45, 24),
    ],
    polys: () => [
      ring(31, -45), ring(31, 45), ring(62, -45), ring(62, 45),
      // trapezoidal slot teeth on both lamination faces
      ...[-45, 45].flatMap(z => radial(9, a => {
        const w = 0.11;
        return [[at(a - w, 40, z), at(a - w * 0.45, 50, z), at(a + w * 0.45, 50, z), at(a + w, 40, z)]];
      })),
    ],
  },
  {
    id: 'rearbell', lead: 0.40, dir: [-0.05, -0.12, -1], spin: 220,
    ghost: () => [ring(82, -104, 32)],
    solids: () => [...surface(P_COWL, 22), ...disc(26, 32, -160, 22)],
    polys: () => [
      ...revolve(P_COWL, 3, [[-104, 82], [-118, 76], [-136, 63], [-150, 47], [-158, 32]]),
      ring(17, -100, 22), ring(9.5, -100, 18),                   // bearing races
      ...radial(6, a => [ringAt(2.2, 13 * Math.cos(a), 13 * Math.sin(a), -100, 8)]),
      ...radial(6, a => [ringAt(2.6, 62 * Math.cos(a), 62 * Math.sin(a), -104, 8)]),
      // louvres punched in the cowl face, tapered like real ones
      ...radial(7, a => {
        const w = 0.15;
        return [[at(a - w, 28, -154), at(a - w * 0.55, 42, -152), at(a + w * 0.55, 42, -152), at(a + w, 28, -154), at(a - w, 28, -154)]];
      }),
    ],
  },
  {
    id: 'frontbell', lead: 0.49, dir: [0.08, 0.10, 1], spin: -240,
    ghost: () => [ring(82, 104, 32)],
    solids: () => [...surface(P_FRONT, 22), ...disc(14, 22, 146, 18)],
    polys: () => [
      ...revolve(P_FRONT, 3, [[102, 82], [112, 82], [122, 52], [130, 38], [136, 27]]),
      ring(17, 104, 22), ring(9.5, 104, 18),
      ...radial(6, a => [ringAt(2.2, 13 * Math.cos(a), 13 * Math.sin(a), 104, 8)]),
      ...radial(6, a => [ringAt(2.6, 62 * Math.cos(a), 62 * Math.sin(a), 104, 8)]),
    ],
  },
  {
    id: 'can', lead: 0.58, dir: [-0.10, 0.06, -1], spin: 200,
    ghost: () => [ring(88, 0, 32)],
    solids: () => [
      ...surface(P_FRAME_SOLID, 24),
      ...disc(0, 82, -98, 24), ...disc(0, 82, 98, 24),
      ...plate(38, 24, 0, -92, 13),                // nameplate
    ],
    polys: () => [
      ...revolve(P_FRAME, 3, [[-98, 78], [98, 78], [0, 88]]),
      // nameplate on the flank, with its engraved lines
      rect(38, 24, 0, -92, 0),
      [[-13, -92, 5], [13, -92, 5]], [[-13, -92, -1], [13, -92, -1]],
    ],
  },
  {
    // The terminal box is a RADIAL feature — it bolts onto the flank of the
    // frame — so it is the one part that leaves sideways rather than along the
    // axis. `side` is how far out it goes, in local units.
    id: 'tbox', lead: 0.62, dir: [0, 0, 0], spin: 0, side: 300,
    ghost: () => [ringAt(6, 0, 142, 0, 12)],
    solids: () => [...boxFaces(30, 40, 26, 0, 100, 0)],
    polys: () => [
      ...boxWire(30, 40, 26, 0, 100, 0),
      ...radial(4, a => [ringAt(2, 11 * Math.cos(a), 100 + 11 * Math.sin(a), 13, 6)]),
      [[-5, 120, 0], [-5, 142, 0]], [[5, 120, 0], [5, 142, 0]],
      ringAt(6, 0, 142, 0, 12),
    ],
  },
];
// built once — the geometry never changes, only its placement
const MOTOR = MOTOR_SPEC.map(p => ({ ...p, polys: p.polys(), ghost: p.ghost(), solids: p.solids ? p.solids() : [] }));
const STATOR_I = MOTOR.findIndex(p => p.id === 'stator');
// The axis is STEEP — about 69 degrees on screen — because the stage is 340x660
// and the parts have diameter as well as length. The old 41-degree axis was
// chosen as "the diagonal", but the diagonal of a 340x660 box is 63 degrees,
// not 41: at 41 the laid-out strip measured 301x393px inside a 340-wide stage
// and the end parts were cropped. Solved rather than eyeballed - the strip now
// measures 238x530 with the part radii included, and the assembled machine
// 224x267. If you re-tilt this, re-run that fit.
const MOTOR_TILT = mul(rotX(66 * DEG), rotY(30 * DEG));
// How long the piece is allowed to be on screen, in stage pixels, measured
// along its axis. The module scale is solved from this every frame:
//   k = RUN / (spread + machine length)
// so the strip holds a constant on-screen run while the parts converge, then
// MOTOR_K_MAX takes over and the assembled machine settles at its own size.
// The machine is 344 units end to end (shaft -166..178).
const MOTOR_RUN_PX = 560;
const MOTOR_LEN = 344;
const MOTOR_K_MAX = 0.66;
const motorModule = k => chain(place(IDENT, [0, 10, 0]), place(mul(MOTOR_TILT, scaleM(k)), [0, 0, 0]));

// Where each part sits when fully exploded, in assembly order along the axis —
// fan cover and endbell at the back, then rotor, stator, housing, front endbell.
// This is the layout every reference photo uses.
// Gaps wider than the parts are long, which is what every reference exploded
// view does — at the old spacing the rotor and stator overlapped and the strip
// read as one object with lumps rather than as parts laid out.
// Centred on the axis: the stations used to run -980..+760, so the strip's
// middle sat 110 units behind the module origin and the whole layout hung off
// one corner of a 340x660 stage with the end parts cropped.
// These are OFFSETS, and every part already sits somewhere on the axis in
// machine coordinates — the fan's blades are modelled at z = -130, the front
// bell at +122. Adding a station to that double-counts, which is why the
// laid-out strip used to bunch in the middle with holes at both ends. So the
// numbers below are (target - natural centre), for targets evenly spaced 220
// apart from -750 to +570 in assembly order: rear bell, fan, rotor, stator,
// frame, front bell, and the shaft drawn out the front. The terminal box rides
// with the frame and leaves sideways instead (`side`).
const LAID_OUT = {
  rearbell: -620, fan: -400, rotor: -310, stator: -90, copper: -90,
  can: 130, tbox: 130, frontbell: 228, shaft: 564,
};

/* ══════════════════════════════════════════════════════════════════════════
   LEFT — the detection pipeline
   ══════════════════════════════════════════════════════════════════════════ */

const PX_C = 8, PX_R = 6, PX = 13;
const PATCH_C = 4, PATCH_R = 3, PATCH = 26;
const NTOK = PATCH_C * PATCH_R;
const ATT_N = 4;
const IMG_Y = -150, SEQ_Y = 26, OUT_Y = 162;

const pxPos = i => [((i % PX_C) - (PX_C - 1) / 2) * PX, (Math.floor(i / PX_C) - (PX_R - 1) / 2) * PX];
const pxVal = i => {
  const [x, y] = pxPos(i);
  const d = Math.hypot((x - 13) / 38, (y + 7) / 29);
  return clamp(1.15 - d, 0.05, 1) * (0.75 + 0.25 * hash(i * 3.7));
};
const patchPos = k => [((k % PATCH_C) - (PATCH_C - 1) / 2) * PATCH, (Math.floor(k / PATCH_C) - (PATCH_R - 1) / 2) * PATCH];
// the sequence recedes along Z — the one thing a flat transformer diagram
// cannot show — and fans in X so the attention links stay separable
const tokPos = i => [(i - NTOK / 2) * 9, Math.abs(i - NTOK / 2) * -2, -78 + i * 13];

// A camera body seen side-on: pentaprism hump, grip swell, mount boss.
const CAM_SIL = [
  [-51, 2], [-51, -14], [-37, -16], [-31, -30], [-8, -34], [0, -18], [28, -18],
  [38, -12], [48, -10], [48, 36], [38, 46], [19, 50], [-27, 52], [-46, 44], [-51, 24],
];
const P_LENS = [[10, 33], [16, 33], [18, 26], [30, 26], [32, 29], [48, 29], [50, 25], [62, 25], [64, 27], [70, 27], [72, 20], [74, 0]];

// The camera comes apart into six pieces so the explode reads as a real
// teardown rather than a body sliding off a lens: front shell, back shell,
// lens barrel, two lens elements, and the top-plate furniture. Each gets its
// own direction and spin.
const CAM_FRONT_SOLID = extrude(CAM_SIL, 2, 19);
const CAM_BACK_SOLID = extrude(CAM_SIL, -19, -2);
const LENS_E1 = [...surface([[44, 27], [50, 25], [52, 22]], 18), ...disc(0, 27, 44, 18)];
const LENS_E2 = [...surface([[62, 25], [68, 23], [70, 19]], 18), ...disc(0, 25, 62, 18)];
const CAM_TOP = [...boxFaces(22, 10, 16, 24, -30, 4), ...boxFaces(16, 9, 14, -32, -26, 4)];
// THE CAMERA COMES APART ALONG ITS OWN OPTICAL AXIS, in assembly order, the
// way a parts diagram lays a camera out: lens groups forward off the front,
// shells back off the rear, the top plate lifted straight up. It used to throw
// all six pieces on their own diagonal with 130-260 degrees of tumble each,
// which read as an explosion in a bin rather than a teardown.
//
// `at` is the station along the axis (+ is out the front, - is out the back),
// `rise` lifts a piece clear of the strip so it does not queue behind another,
// and `order` is when it leaves. Nothing spins.
// Each piece carries its OWN wireframe. Deriving one from the face list wires
// every triangle of a lathe's end-cap fan and the lens front comes out as a
// sunburst; a shell comes out as a ladder of coincident quad edges.
const shellWire = (z0, z1) => [
  [...CAM_SIL.map(([x, y]) => [x, y, z0]), [CAM_SIL[0][0], CAM_SIL[0][1], z0]],
  [...CAM_SIL.map(([x, y]) => [x, y, z1]), [CAM_SIL[0][0], CAM_SIL[0][1], z1]],
  ...CAM_SIL.filter((_, i) => i % 3 === 0).map(([x, y]) => [[x, y, z0], [x, y, z1]]),
];
const CAM_PIECES = [
  // out the FRONT, furthest-forward element first
  { solid: () => LENS_E2, wire: () => [ring(25, 62, 20), ring(19, 70, 20)],
    at: 1.00, rise: 0.00, order: 0 },
  { solid: () => LENS_E1, wire: () => [ring(27, 44, 20), ring(22, 52, 20)],
    at: 0.72, rise: 0.00, order: 1 },
  { solid: () => LENS_SOLID,
    wire: () => [...revolve(P_LENS, 3, [[16, 33], [30, 26], [48, 29], [62, 25], [70, 27]]),
                 ...radial(10, a2 => [[at(a2, 29, 36), at(a2, 29, 46)]])],
    at: 0.44, rise: 0.00, order: 2 },
  { solid: () => CAM_FRONT_SOLID, wire: () => shellWire(2, 19),
    at: 0.20, rise: 0.00, order: 3 },
  // straight UP off the body
  { solid: () => CAM_TOP,
    wire: () => [...boxWire(22, 10, 16, 24, -30, 4), ...boxWire(16, 9, 14, -32, -26, 4)],
    at: 0.00, rise: -1.00, order: 4 },
  // out the BACK
  { solid: () => CAM_BACK_SOLID, wire: () => shellWire(-19, -2),
    at: -0.34, rise: 0.00, order: 5 },
];

const CAM_BODY = [-19, 19].map(z => [...CAM_SIL.map(([x, y]) => [x, y, z]), [CAM_SIL[0][0], CAM_SIL[0][1], z]]);
const CAM_STRUTS = CAM_SIL.filter((_, i) => i % 3 === 0).map(([x, y]) => [[x, y, -19], [x, y, 19]]);
const CAM_DETAIL = [ringAt(7, 24, -30, 20, 12), ringAt(9, -32, -26, 20, 12)];   // shutter, dial
const CAM_SOLID = extrude(CAM_SIL, -19, 19);
const LENS_SOLID = [...surface(P_LENS, 20), ...disc(0, 20, 72, 20)];
const LENS = [
  ...revolve(P_LENS, 3, [[16, 33], [30, 26], [48, 29], [62, 25], [70, 27]]),
  ...radial(10, a => [[at(a, 29, 36), at(a, 29, 46)]]),        // focus-ring knurling
  ring(18, 74, 24),
];

/* ── the component ──────────────────────────────────────────────────────── */

export default function Flourish3D({ side = 'left' }) {
  const hostRef = useRef(null);
  const isLeft = side === 'left';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const canvas = host.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    const W = 340, H = 660;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const CX = W / 2, CY = H / 2;

    // theme colours, read once and refreshed when the theme attribute changes
    let ink = '#C5A35C', copper = '#A85A2A', slate = '#4E7C8C', err = '#A8503B';
    let paper = '#F7F5F2', dark = false, LINE = '#1a1a1a';
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      dark = document.documentElement.getAttribute('data-theme') === 'dark';
      paper = cs.getPropertyValue('--background-color').trim() || paper;
      // STRUCTURE IS NEUTRAL. Gold everywhere made these read as ornament; the
      // reference language is a grey line with one saturated accent used
      // sparingly. Gold is now reserved for what it means — the optical path
      // and the detection — and copper for the winding.
      LINE = cs.getPropertyValue('--primary-color').trim() || LINE;
      ink = cs.getPropertyValue('--accent-color').trim() || ink;
      copper = cs.getPropertyValue('--f3d-copper').trim() || copper;
      slate = cs.getPropertyValue('--ml-neg').trim() || slate;
      err = cs.getPropertyValue('--ml-err').trim() || err;
    };
    readTheme();
    // ── LOOK ────────────────────────────────────────────────────────────
    // These pieces are LINE ART, not product renders. The surfaces exist only
    // to occlude — they are the page colour, so a line passing behind a body
    // fades out instead of crossing it — and everything you actually read is
    // the 1px stroke on top. The previous version had this exactly backwards:
    // a full Lambert + specular + environment model at alpha 1, and the
    // linework underneath it at alpha 0.13, which is why the motor arrived as
    // a brown lump.
    // A line lying exactly on a surface would z-fight with it; push lines a
    // little toward the viewer so they always win against their own body.
    const LINE_BIAS = 6;
    const LOOK = {
      surface: 1,        // the fill is opaque page colour: it HIDES what is behind
      shadeRange: 0.05,  // how much a face's tone may drift with its normal
      line: 0.78,        // main linework
      lineFar: 0.22,     // linework on parts still far out in the explosion
      width: 1,
    };

    // Material tints. The metal is the accent desaturated toward neutral so
    // lighting does the work rather than hue; copper stays warm and saturated.
    // The occluding fill: the page background, quantised, leaning toward the
    // ink colour for faces turned away from the light. Quantised so a few
    // hundred faces a frame do not churn a few hundred colour strings.
    let paperRGB = [18, 18, 18], inkRGB = [212, 180, 124], cuRGB = [206, 132, 73];
    const toneCache = new Map();
    // `tint` is the material: 0 = plain page-coloured body, 1 = the winding,
    // which keeps a little of its own colour so copper still means copper.
    const paperTone = (up, tint) => {
      const q = Math.max(-8, Math.min(8, Math.round(up * 8)));
      const key = q * 4 + tint;
      let c = toneCache.get(key);
      if (c) return c;
      // dark theme: lift toward ink.  light theme: sink away from it.
      // Bodies sit slightly OFF the page rather than matching it: on the dark
      // theme a fill of exactly --background-color reads as a hole, because the
      // page itself carries a gradient and is lighter than its own token where
      // the art sits. Lift a little, then let the normal tilt it a touch.
      const lift = dark ? 0.075 : -0.05;
      const k = lift + (q / 8) * LOOK.shadeRange;
      const tgt = k >= 0 ? 255 : 0;
      const mix = a1 => Math.max(0, Math.min(255, Math.round(a1 + (tgt - a1) * Math.abs(k))));
      let r = mix(paperRGB[0]), g = mix(paperRGB[1]), b2 = mix(paperRGB[2]);
      if (tint) {
        const w = 0.42;
        r = Math.round(r + (cuRGB[0] - r) * w);
        g = Math.round(g + (cuRGB[1] - g) * w);
        b2 = Math.round(b2 + (cuRGB[2] - b2) * w);
      }
      c = `rgb(${r},${g},${b2})`;
      toneCache.set(key, c);
      return c;
    };
    let METAL = [0, 0, 0, 1], CU = [0, 0, 0, 2];
    const mkMaterial = (hex, id, mixGrey) => {
      const v = hex.replace('#', '');
      const n = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
      const r = parseInt(n.slice(0, 2), 16) || 160, g = parseInt(n.slice(2, 4), 16) || 140, b = parseInt(n.slice(4, 6), 16) || 110;
      const grey = (r + g + b) / 3;
      return [r + (grey - r) * mixGrey, g + (grey - g) * mixGrey, b + (grey - b) * mixGrey, id];
    };
    const readMaterials = () => {
      METAL = mkMaterial(ink, 1, 0.45); CU = mkMaterial(copper, 2, 0.1);
      paperRGB = hexToRgb(paper); inkRGB = hexToRgb(ink); cuRGB = hexToRgb(copper); toneCache.clear();
    };
    readMaterials();
    const themeWatch = new MutationObserver(() => { readTheme(); readMaterials(); buildStage(); lastP = -1; onScroll(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── camera ──────────────────────────────────────────────────────────
    const PERSP = 600;
    let cam = null;
    const setCam = (yaw, pitch, dolly) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
      cam = (x, y, z) => {
        const X = x * cy + z * sy, Z0 = -x * sy + z * cy;
        const Y = y * cx - Z0 * sx, Z = y * sx + Z0 * cx + dolly;
        const k = PERSP / (PERSP - Z);
        return [CX + X * k, CY + Y * k, Z];
      };
    };

    // ── drawing ─────────────────────────────────────────────────────────
    // One beginPath/stroke per style group, so the draw-call count stays in the
    // dozens no matter how many segments there are.
    let segs = 0;
    function stroke(polys, T, color, alpha, width) {
      if (alpha <= 0.004 || !polys.length) return;
      const m = T.m, t = T.t;
      ctx.beginPath();
      for (let pi = 0; pi < polys.length; pi++) {
        const poly = polys[pi];
        for (let i = 0; i < poly.length; i++) {
          const q = poly[i];
          const s = cam(
            m[0] * q[0] + m[1] * q[1] + m[2] * q[2] + t[0],
            m[3] * q[0] + m[4] * q[1] + m[5] * q[2] + t[1],
            m[6] * q[0] + m[7] * q[1] + m[8] * q[2] + t[2],
          );
          if (i === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
        }
        segs += poly.length - 1;
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function fill(polys, T, color, alpha) {
      if (alpha <= 0.004 || !polys.length) return;
      const m = T.m, t = T.t;
      ctx.beginPath();
      for (let pi = 0; pi < polys.length; pi++) {
        const poly = polys[pi];
        for (let i = 0; i < poly.length; i++) {
          const q = poly[i];
          const s = cam(
            m[0] * q[0] + m[1] * q[1] + m[2] * q[2] + t[0],
            m[3] * q[0] + m[4] * q[1] + m[5] * q[2] + t[1],
            m[6] * q[0] + m[7] * q[1] + m[8] * q[2] + t[2],
          );
          if (i === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
        }
        ctx.closePath();
        segs += poly.length - 1;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill();
    }

    // ── shaded solids ─────────────────────────────────────────────────
    // Faces are collected for the whole frame, then sorted back-to-front and
    // filled — a painter's algorithm. Sorting globally (rather than per part)
    // is what lets the rotor read as being INSIDE the frame.
    let bucket = [];
    function submit(faces, T, base, alpha) {
      if (alpha <= 0.02 || !faces.length) return;
      const m = T.m, t = T.t;
      for (let fi = 0; fi < faces.length; fi++) {
        const f = faces[fi], v = f.v, n = f.n;
        const nx = m[0] * n[0] + m[1] * n[1] + m[2] * n[2];
        const ny = m[3] * n[0] + m[4] * n[1] + m[5] * n[2];
        const nz = m[6] * n[0] + m[7] * n[1] + m[8] * n[2];
        const nl = Math.hypot(nx, ny, nz) || 1;

        const pts = new Array(v.length * 2);
        let zsum = 0;
        for (let i = 0; i < v.length; i++) {
          const q = v[i];
          const sc = cam(
            m[0] * q[0] + m[1] * q[1] + m[2] * q[2] + t[0],
            m[3] * q[0] + m[4] * q[1] + m[5] * q[2] + t[1],
            m[6] * q[0] + m[7] * q[1] + m[8] * q[2] + t[2],
          );
          pts[i * 2] = sc[0]; pts[i * 2 + 1] = sc[1]; zsum += sc[2];
        }
        // back-face cull by screen winding — no view-space normal needed
        let area = 0;
        for (let i = 0; i < v.length; i++) {
          const j = (i + 1) % v.length;
          area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
        }
        if (area <= 0) continue;

        // ONE cheap term, not a lighting rig. The fill is the page colour;
        // all this does is let a face lean a little lighter or darker than the
        // page so a curved body does not collapse into one flat silhouette.
        // Faces pointing up are lighter, faces pointing away are darker.
        const iny2 = ny / nl;
        const zc = zsum / v.length;
        bucket.push({
          pts, z: zc, a: alpha * LOOK.surface,
          c: paperTone(-iny2, base === CU ? 1 : 0),
        });
        segs += v.length;
      }
    }

    // Lines go into the SAME bucket as the faces, so they sort against them.
    // This is what makes hidden-line removal work: a rib on the far side of a
    // body is drawn before that body's surface and is painted over by it.
    // Stroking everything after the fills instead — which is what this did at
    // first — leaves every internal edge showing and the piece reads as a ball
    // of wire.
    function submitLines(polys, T, color, alpha, width) {
      if (alpha <= 0.004 || !polys.length) return;
      const m = T.m, t = T.t;
      for (let pi = 0; pi < polys.length; pi++) {
        const poly = polys[pi];
        if (poly.length < 2) continue;
        const pts = new Array(poly.length * 2);
        let zsum = 0;
        for (let i = 0; i < poly.length; i++) {
          const q = poly[i];
          const sc = cam(
            m[0] * q[0] + m[1] * q[1] + m[2] * q[2] + t[0],
            m[3] * q[0] + m[4] * q[1] + m[5] * q[2] + t[1],
            m[6] * q[0] + m[7] * q[1] + m[8] * q[2] + t[2],
          );
          pts[i * 2] = sc[0]; pts[i * 2 + 1] = sc[1]; zsum += sc[2];
        }
        // nudged toward the viewer so a line ON a surface wins against it
        bucket.push({ line: 1, pts, z: zsum / poly.length + LINE_BIAS, a: alpha, c: color, w: width });
        segs += poly.length - 1;
      }
    }

    function flush() {
      if (!bucket.length) return;
      bucket.sort((A, B) => A.z - B.z);          // far first
      let ca = -1, cc = '', cw = -1;
      for (let i = 0; i < bucket.length; i++) {
        const f = bucket[i];
        ctx.beginPath();
        ctx.moveTo(f.pts[0], f.pts[1]);
        for (let k = 2; k < f.pts.length; k += 2) ctx.lineTo(f.pts[k], f.pts[k + 1]);
        if (f.line) {
          if (f.a !== ca) { ctx.globalAlpha = ca = f.a; }
          if (f.c !== cc) { ctx.strokeStyle = cc = f.c; }
          if (f.w !== cw) { ctx.lineWidth = cw = f.w; }
          ctx.stroke();
        } else {
          ctx.closePath();
          if (f.a !== ca) { ctx.globalAlpha = ca = f.a; }
          if (f.c !== cc) { ctx.fillStyle = cc = f.c; }
          ctx.fill();
        }
      }
      bucket.length = 0;
    }

    // Axial explode offsets, in assembly order out from the middle. After the
    // machine has come together it opens back UP into a held exploded view —
    // a solid-shaded body hides its own internals, so staying assembled would
    // throw away everything inside it.
    // THE AXLE TURNS, AND PARTS GO ONTO IT. It starts turning as soon as it
    // lands and accelerates all the way down the page, so every part that
    // arrives is being threaded onto something already spinning. Everything
    // mounted on the shaft (`spins: true`) turns with it.
    //   revs(p) = the shaft's accumulated rotation in degrees
    const revs = p => 2600 * Math.pow(win(p, 0.06, 0.94), 1.7);

    function drawMotor(p) {
      setCam((-24 + 40 * p) * DEG, (6 + 8 * p) * DEG, -120 + 150 * p);
      // It STARTS laid out as an exploded view and comes together. Each part
      // converges on its own window, back to front, so the machine builds up
      // along the axle rather than everything sliding home at once.
      // Staggered so the LAST part still has room to seat before the page
      // ends. Hard-coding 0.10 per part stopped working the moment there were
      // more than six of them.
      const step = 0.58 / Math.max(1, MOTOR.length - 1);
      const conv = k => smooth(win(p, 0.10 + k * step, 0.30));
      const built = smooth(win(p, 0.10, 0.80));

      // THE SCALE IS DERIVED FROM THE CURRENT SPREAD, not from progress.
      // A fixed "small while spread, larger once closed" ramp gets this wrong,
      // because the strip is at its longest in the MIDDLE of the sequence —
      // the parts are still far apart while the module has already grown — not
      // at the start. Measured off the canvas, that put the motor 338px wide in
      // a 340px stage and running off the top for the first third of the page.
      // Fitting the run every frame makes clipping impossible by construction.
      const offsetOf = k => (LAID_OUT[MOTOR[k].id] || 0) * (1 - clamp(seat(conv(k)), 0, 1));
      let lo = 0, hi = 0;
      for (let k = 0; k < MOTOR.length; k++) {
        const o = offsetOf(k); if (o < lo) lo = o; if (o > hi) hi = o;
      }
      const runK = clamp(MOTOR_RUN_PX / ((hi - lo) + MOTOR_LEN), 0.22, MOTOR_K_MAX);
      const base = chain(motorModule(runK),
        place(rotZ((90 + 250 * built) * DEG), [0, 0, 0]));

      MOTOR.forEach((part, k) => {
        const c = seat(conv(k));                       // 0 laid out -> 1 seated
        const away = 1 - clamp(c, 0, 1);
        const off = (LAID_OUT[part.id] || 0) * away;
        // a small lateral drift while apart, so the strip is not a dead-straight
        // queue, plus the axle's own rotation for anything mounted on it
        let m = rotZ((part.spins ? revs(p) : 0) * DEG + away * part.spin * 0.25 * DEG);
        const T = chain(base, place(m, [
          part.dir[0] * away * 26,
          part.dir[1] * away * 26 + (part.side || 0) * away,   // radial parts go sideways
          off,
        ]));
        submit(part.solids, T, METAL, 1);
        submitLines(part.polys, T, LINE, LOOK.line, LOOK.width);
        part._T = T; part._a = 1;
      });

      // Copper: bars lying IN the stator slots, tied by an end-turn ring past
      // each end of the stack. A coil around the shaft axis is a solenoid, not
      // a motor winding.
      // COPPER. In every reference the windings are the one strongly coloured
      // thing in the strip, so they travel with the stator and the end turns
      // are always present rather than winding on late.
      {
        // Indexed by ID, not by position. This was conv(2), which was the
        // stator until the fan was inserted ahead of it — after that the
        // winding was converging on the fan's schedule.
        const c = seat(conv(STATOR_I));
        const T = chain(base, place(rotZ(revs(p) * DEG), [0, 0, (LAID_OUT.copper || 0) * (1 - clamp(c, 0, 1))]));
        for (let k = 0; k < 9; k++) submit(barSolid((k / 9) * TAU, 46, -52, 52, 7), T, CU, 1);
        // END TURNS. These have to clear the stator body or the one coloured
        // thing on this piece is invisible: at r=50 inside a r=62 core they
        // were hidden by the core's own surface, and the whole strip measured
        // 92 warm pixels. They now bulge to r=64, just past the r=62 core, and
        // reach further along the axis so they read from the side too.
        submit(surface([[-76, 42], [-68, 60], [-56, 64], [-45, 50]], 20), T, CU, 1);
        submit(surface([[45, 50], [56, 64], [68, 60], [76, 42]], 20), T, CU, 1);
        submitLines([ring(64, -58, 28), ring(64, 58, 28)], T, copper, LOOK.line, LOOK.width);
      }
      flush();     // ONE sorted pass over the whole machine: masses and lines
    }

    function drawVision(p) {
      setCam((26 - 48 * p) * DEG, (7 + 9 * p) * DEG, -70 + 170 * p);
      const stage = place(IDENT, [0, IMG_Y, 0]);

      // 1 · THE CAMERA COMES APART — cleanly. Every piece travels along the one
      // optical axis (or straight up, for the top plate), in assembly order,
      // holding its own orientation the whole way. What is left behind is the
      // sensor.
      // The camera was drawn at its natural size and measured 92x98px against
      // the motor's 200x400 — the two sides of the page did not read as a pair.
      // The scale rides on `turn`, so the explosion offsets scale with it.
      const CAM_SCALE = 1.55;
      const turn = place(mul(rotY(-42 * DEG), scaleM(CAM_SCALE)), [0, 0, 0]);
      const EX_D = 360;
      const camT = [];
      CAM_PIECES.forEach((piece) => {
        const i = piece.order;
        const t = smooth(win(p, 0.07 + i * 0.020, 0.24));
        const a = 1 - win(p, 0.20 + i * 0.020, 0.14);
        if (a <= 0.01) return;
        const T = chain(stage, chain(turn, place(IDENT, [
          0,
          piece.rise * EX_D * 0.62 * t,
          piece.at * EX_D * t,
        ])));
        submit(piece.solid(), T, METAL, a);
        // modelled as surfaces only, so without this they would be flat
        // page-coloured shapes sliding apart
        submitLines(piece.wire(), T, LINE, LOOK.line * a, LOOK.width);
      });
      flush();
      // the outline detail rides only the two shells, and only while close
      const shellA = 1 - win(p, 0.14, 0.12);
      if (shellA > 0.01) {
        const t0 = smooth(win(p, 0.07 + 3 * 0.020, 0.24));   // rides the front shell
        const shell = chain(stage, chain(turn, place(IDENT, [0, 0, 0.20 * EX_D * t0])));
        stroke(CAM_BODY.concat(CAM_STRUTS, CAM_DETAIL), shell, LINE, LOOK.line * shellA, LOOK.width);
      }

      // 2 · THE SENSOR IS WHAT IS LEFT. It squares up to the viewer, comes
      // forward, and then its face resolves into photosites — the die does not
      // sit behind a grid, it BECOMES the grid: the package outline fades as
      // the cells take over.
      const sens = smooth(win(p, 0.20, 0.14));
      if (sens > 0) {
        // un-rotate out of the camera's three-quarter view as it takes over
        const square = place(rotY(-42 * (1 - sens) * DEG), [0, 0, 0]);
        const T = chain(stage, chain(square, place(IDENT, [0, 0, -30 + 46 * sens])));
        // the die itself, solid, before it dissolves into pixels
        const dieFade = 1 - win(p, 0.30, 0.10);
        if (dieFade > 0.01) submit(plate(112, 86, 0, 0, 0), T, METAL, 0.85 * sens * dieFade);
        flush();
        stroke([rect(112, 86, 0, 0, 0), rect(126, 100, 0, 0, -3)], T, ink, 0.5 * sens, 1);

        // photosites light to their own values, so the grid IS the image.
        // Bucketed by brightness so 48 cells cost 4 strokes, not 48.
        const buckets = [[], [], [], []];
        for (let i = 0; i < PX_C * PX_R; i++) {
          const a = smooth(win(p, 0.28 + (i / (PX_C * PX_R)) * 0.10, 0.05));
          if (a <= 0.02) continue;
          const [x, y] = pxPos(i);
          const v = pxVal(i) * a;
          // each cell grows out of the die's own surface into its own tile
          const sz = PX * 0.76 * (0.30 + 0.70 * a);
          buckets[clamp(Math.ceil(v * 4) - 1, 0, 3)].push(rect(sz, sz, x * a + x * 0.86 * (1 - a), y * a + y * 0.86 * (1 - a), 1.5));
        }
        // filled, not stroked: the cell's VALUE is its opacity, which is what
        // makes the grid read as an image rather than as graph paper
        for (let b = 0; b < 4; b++) fill(buckets[b], T, ink, 0.12 + 0.72 * ((b + 1) / 4));

        // 3 · patches: the image cut into fixed tiles
        const pt = win(p, 0.40, 0.10);
        if (pt > 0) {
          const fr = [];
          for (let k = 0; k < NTOK; k++) {
            if (k / NTOK > pt * 1.15) break;
            const [x, y] = patchPos(k);
            fr.push(rect(PATCH - 3, PATCH - 3, x, y, 4));
          }
          stroke(fr, T, slate, 0.85 * (1 - 0.55 * win(p, 0.52, 0.12)), 1.2);
        }
      }

      // 4 · flatten: every patch flies off the sensor into the sequence
      const seq = place(IDENT, [0, SEQ_Y, 0]);
      const toks = [], ticks = [];
      for (let i = 0; i < NTOK; i++) {
        const a = smooth(win(p, 0.50 + i * 0.006, 0.09));
        if (a <= 0.02) continue;
        const t = tokPos(i), pp = patchPos(i);
        const x = pp[0] + (t[0] - pp[0]) * a;
        const y = (IMG_Y - SEQ_Y) * (1 - a) + t[1] * a;
        const z = 4 + (t[2] - 4) * a;
        toks.push(rect(19, 19, x, y, z));
        if (win(p, 0.56 + i * 0.004, 0.05) > 0.02) ticks.push([[x - 5, y + 14, z], [x + 5, y + 14, z]]);
      }
      fill(toks, seq, slate, 0.13);
      stroke(toks, seq, slate, 0.85, 1.1);
      stroke(ticks, seq, ink, 0.55, 1);

      // the transformer blocks the sequence passes through
      const blk = win(p, 0.60, 0.10);
      if (blk > 0) stroke([0, 1, 2].map(k => rect(84, 62, 0, 0, -56 + k * 56)), seq, ink, 0.2 * blk, 1);

      // 5 · attention: all-pairs from the CLS token, then a collapse onto a few
      // strong links, which is what a trained head actually looks like
      const att = win(p, 0.64, 0.10);
      if (att > 0) {
        const cls = tokPos(-1);
        const keep = [], drop = [];
        for (let i = 0; i < NTOK; i++) (hash(i * 9.3) > 0.62 ? keep : drop).push([cls, tokPos(i)]);
        const collapse = win(p, 0.76, 0.12);
        stroke(drop, seq, slate, 0.32 * att * (1 - collapse), 1);
        stroke(keep, seq, slate, 0.32 * att + 0.5 * collapse, 1 + 1.4 * collapse);
        fill([rect(15, 15, cls[0], cls[1], cls[2])], seq, ink, 0.3 * att);
        stroke([rect(15, 15, cls[0], cls[1], cls[2])], seq, ink, 0.9 * att, 1.3);
      }

      // the attention map beside it
      const mat = win(p, 0.68, 0.10);
      if (mat > 0) {
        const T = chain(place(IDENT, [66, SEQ_Y + 4, -26]), place(rotY(22 * DEG), [0, 0, 0]));
        stroke([rect(ATT_N * 13, ATT_N * 13, 0, 0, 0)], T, ink, 0.45 * mat, 1);
        const hot = [], cool = [];
        for (let i = 0; i < ATT_N * ATT_N; i++) {
          const w = hash(i * 5.1);
          const on = w > 0.68 ? 1 : 1 - win(p, 0.78, 0.10);
          if (on < 0.06) continue;
          const x = ((i % ATT_N) - (ATT_N - 1) / 2) * 13, y = (Math.floor(i / ATT_N) - (ATT_N - 1) / 2) * 13;
          (w > 0.55 ? hot : cool).push(rect(10, 10, x, y, 0));
        }
        fill(cool, T, slate, 0.18 * mat);
        fill(hot, T, slate, 0.8 * mat);
        stroke(hot.concat(cool), T, slate, 0.5 * mat, 1);
      }

      // 6 · the detection
      const out = place(IDENT, [0, OUT_Y, 0]);
      const fr = win(p, 0.84, 0.06);
      if (fr > 0) stroke([rect(112, 84, 0, 0, 0)], out, ink, 0.4 * fr, 1);
      const bx = seat(win(p, 0.88, 0.08));
      if (bx > 0.01) {
        const g = 1 + 0.5 * (1 - clamp(bx, 0, 1));
        stroke([rect(60 * g, 46 * g, 0, 0, 2)], out, err, clamp(bx, 0, 1), 2);
        const c = win(p, 0.90, 0.05);
        if (c > 0) {
          const corners = [];
          for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) corners.push(rect(7 * c, 7 * c, sx * 30, sy * 23, 3));
          stroke(corners, out, err, c, 1.6);
        }
        const lb = win(p, 0.93, 0.05);
        if (lb > 0) fill([rect(36 * lb, 10, -30 + 18 * lb, -30, 3)], out, err, 0.9);
        const cf = win(p, 0.95, 0.06);
        if (cf > 0) stroke([[[-30, 30, 3], [-30 + 44 * cf, 30, 3]]], out, err, 0.85, 3);
      }
    }

    // ── the frame ───────────────────────────────────────────────────────
    // A whisper of a ground behind the piece, to stop it floating completely
    // free of the page. Built once, not per frame.
    let stage = null;
    const buildStage = () => {
      const g = ctx.createRadialGradient(CX, CY * 0.92, 10, CX, CY * 0.92, W * 0.72);
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      // Barely there. This used to be a 0.58-black vignette AND the same
      // gradient again as .f3d::before in CSS — the two stacked into a hole in
      // the page that the line art then had to climb out of. Line art does not
      // need a studio to be lit against; it needs the page to be quiet.
      g.addColorStop(0, isDark ? 'rgba(0,0,0,0.16)' : 'rgba(64,52,36,0.05)');
      g.addColorStop(0.55, isDark ? 'rgba(0,0,0,0.08)' : 'rgba(64,52,36,0.02)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      stage = g;
    };
    buildStage();

    function draw(p) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.fillStyle = stage;
      ctx.fillRect(0, 0, W, H);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      segs = 0;
      if (isLeft) drawVision(p); else drawMotor(p);
      ctx.globalAlpha = 1;
      canvas.dataset.segs = String(segs);
    }

    // ── scroll driver ───────────────────────────────────────────────────
    // The listener and the rAF are shared with the rest of the page (see
    // src/scrollDriver.js); what stays local is the part that is specific to
    // this piece — no redraw unless the progress ACTUALLY moved. That
    // threshold is the thing that keeps a static page idle. (anime's onScroll
    // with a numeric `sync` never settles — it kept rewriting the scene
    // ~1200x/second on a completely static page.)
    let lastP = -1;
    let stopScroll = null;

    if (reduce) {
      draw(isLeft ? 0.97 : 0.9);          // one composed, representative frame
    } else {
      stopScroll = onPageScroll((y, p) => {
        if (Math.abs(p - lastP) < 0.0004) return;
        lastP = p;
        draw(p);
      });
    }

    return () => {
      stopScroll?.();
      themeWatch.disconnect();
    };
  }, [isLeft]);

  return (
    <div className={`f3d f3d--${side}`} ref={hostRef} aria-hidden="true">
      <canvas />
    </div>
  );
}
