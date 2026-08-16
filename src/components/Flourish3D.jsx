import React, { useEffect, useRef } from 'react';
import { createGLRenderer } from './flourishGL';

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
const P_FRAME = finnedFrame(-98, 98, 78, 86, 6);
const P_FRONT = [[98, 78], [102, 82], [112, 82], [116, 74], [122, 52], [130, 38], [136, 27], [142, 22], [146, 14]];

// Every part arrives along the SAME axis in assembly order: `fz` dominates and
// the lateral jitter is capped, so parts thread down the shaft rather than
// converging from six directions, which reads as a pile of boxes meeting.
const MOTOR_SPEC = [
  {
    id: 'shaft', lead: 0.02, dir: [0.06, -0.10, 1], spin: -180,
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
      // cooling fan on the rear of the shaft, blades raked back
      ...radial(6, a => {
        const rake = 0.36;
        return [[at(a, 12, -126), at(a + rake * 0.4, 19, -131), at(a + rake, 26, -134), at(a + rake * 0.5, 21, -123), at(a, 12, -126)]];
      }),
      ring(12, -126, 18),
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
      ...surface(P_FRAME, 24),
      ...boxFaces(30, 40, 26, 0, 100, 0),          // terminal box
      ...plate(38, 24, 0, -92, 13),                // nameplate
    ],
    polys: () => [
      ...revolve(P_FRAME, 3, [[-98, 78], [98, 78], [0, 88]]),
      // terminal box on the flank, its cover bolts, and the conduit out of it
      ...boxWire(30, 40, 26, 0, 100, 0),
      ...radial(4, a => [ringAt(2, 11 * Math.cos(a), 100 + 11 * Math.sin(a), 13, 6)]),
      [[-5, 120, 0], [-5, 142, 0]], [[5, 120, 0], [5, 142, 0]],
      ringAt(6, 0, 142, 0, 12),
      // nameplate on the opposite flank, with its engraved lines
      rect(38, 24, 0, -92, 0),
      [[-13, -92, 5], [13, -92, 5]], [[-13, -92, -1], [13, -92, -1]],
    ],
  },
];
// built once — the geometry never changes, only its placement
const MOTOR = MOTOR_SPEC.map(p => ({ ...p, polys: p.polys(), ghost: p.ghost(), solids: p.solids ? p.solids() : [] }));
const MOTOR_MODULE = chain(
  place(IDENT, [0, 30, 0]),
  chain(place(rotX(58 * DEG), [0, 0, 0]), chain(place(rotZ(-16 * DEG), [0, 0, 0]), place(scaleM(0.8), [0, 0, 0]))),
);

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
    const W = 340, H = 660;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // WebGL2 if the browser will give us one; otherwise the Canvas2D path below
    // runs exactly as before. The site has already been taken down once by
    // assuming a WebGL context exists (see the lanyard error boundary), so the
    // fallback is not optional.
    let canvas = host.querySelector('canvas');
    const glr = createGLRenderer(canvas, W, H, dpr);
    if (!glr) {
      // A canvas can NEVER hand out a second context type. createGLRenderer may
      // have taken a webgl2 context and only then failed (a shader that will
      // not compile on this driver, say), in which case getContext('2d') on
      // this element returns null and the piece dies silently. Swapping in a
      // fresh element makes the fallback hold no matter where GL gave up.
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      canvas = fresh;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = glr ? null : canvas.getContext('2d');
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const CX = W / 2, CY = H / 2;

    // theme colours, read once and refreshed when the theme attribute changes
    let ink = '#C5A35C', copper = '#A85A2A', slate = '#4E7C8C', err = '#A8503B';
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue('--accent-color').trim() || ink;
      copper = cs.getPropertyValue('--f3d-copper').trim() || copper;
      slate = cs.getPropertyValue('--ml-neg').trim() || slate;
      err = cs.getPropertyValue('--ml-err').trim() || err;
    };
    readTheme();
    // Material tints. The metal is the accent desaturated toward neutral so
    // lighting does the work rather than hue; copper stays warm and saturated.
    let METAL = [0, 0, 0, 1], CU = [0, 0, 0, 2];
    const mkMaterial = (hex, id, mixGrey) => {
      const v = hex.replace('#', '');
      const n = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
      const r = parseInt(n.slice(0, 2), 16) || 160, g = parseInt(n.slice(2, 4), 16) || 140, b = parseInt(n.slice(4, 6), 16) || 110;
      const grey = (r + g + b) / 3;
      return [r + (grey - r) * mixGrey, g + (grey - g) * mixGrey, b + (grey - b) * mixGrey, id];
    };
    const readMaterials = () => { METAL = mkMaterial(ink, 1, 0.45); CU = mkMaterial(copper, 2, 0.1); };
    readMaterials();
    const themeWatch = new MutationObserver(() => { readTheme(); readMaterials(); colCache.clear(); buildStage(); lastP = -1; onScroll(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── camera ──────────────────────────────────────────────────────────
    const PERSP = 600;
    let cam = null;
    const setCam = (yaw, pitch, dolly) => {
      if (glr) { glr.setCamera(yaw, pitch, dolly); return; }
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
      if (glr) { glr.stroke(polys, T, color, alpha, width); return; }
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
      if (glr) { glr.fill(polys, T, color, alpha); return; }
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
// Key light from upper-left-front, a hemispheric ambient (sky above, bounce
    // below) so faces pointing up are never as dark as faces pointing down, and
    // a rim term that lights grazing edges — which is most of what makes a
    // product render read as photographed rather than shaded.
    const LIGHT = (() => { const v = [-0.42, -0.80, 0.43]; const L = Math.hypot(v[0], v[1], v[2]); return [v[0] / L, v[1] / L, v[2] / L]; })();
    const HALF = (() => { const h = [LIGHT[0], LIGHT[1], LIGHT[2] + 1]; const L = Math.hypot(h[0], h[1], h[2]); return [h[0] / L, h[1] / L, h[2] / L]; })();
    let bucket = [];
    const hexToRgb = h => {
      const v = h.replace('#', '').trim();
      const n = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
      return [parseInt(n.slice(0, 2), 16) || 0, parseInt(n.slice(2, 4), 16) || 0, parseInt(n.slice(4, 6), 16) || 0];
    };
    const colCache = new Map();
    const shadeColor = (base, lit, spec) => {
      // quantised so the cache stays small and string churn stays low
      const q = Math.round(lit * 40), qs = Math.round(spec * 20);
      const key = base[3] * 100000 + q * 64 + qs;
      let c = colCache.get(key);
      if (c) return c;
      const l = q / 40, sp = qs / 20;
      c = `rgb(${Math.min(255, Math.round(base[0] * l + 255 * sp))},${Math.min(255, Math.round(base[1] * l + 250 * sp))},${Math.min(255, Math.round(base[2] * l + 240 * sp))})`;
      colCache.set(key, c);
      return c;
    };

    function submit(faces, T, base, alpha) {
      if (glr) { glr.submit(faces, T, base, alpha); return; }
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

        const inx = nx / nl, iny = ny / nl, inz = nz / nl;
        const d = Math.max(0, inx * LIGHT[0] + iny * LIGHT[1] + inz * LIGHT[2]);
        const hd = Math.max(0, inx * HALF[0] + iny * HALF[1] + inz * HALF[2]);

        // ENVIRONMENT REFLECTION. Reflect the view direction (0,0,1) about the
        // normal and ask what that ray would hit in a two-band studio: bright
        // sky above, dark floor below, and a hot horizon line between them.
        //   R = 2(N·V)N - V, with V = (0,0,1)  =>  R.y = 2·n_z·n_y
        // The horizon streak is the tell — it is what makes a curved metal body
        // read as reflective rather than as matte plastic, and it costs one
        // exp() per face.
        const envUp = -2 * inz * iny;
        const envT = clamp(0.5 + 1.9 * envUp, 0, 1);          // floor -> sky
        const horizon = Math.exp(-(envUp * envUp) / 0.012);
        const env = 0.10 + 0.55 * envT + 0.42 * horizon;

        // rim: faces turned away from the viewer catch a bright edge
        const facing = Math.abs(inz);
        const rim = 0.30 * Math.pow(1 - facing, 4);
        // depth fade — far geometry loses a little contrast
        const zc = zsum / v.length;
        const fade = clamp(0.82 + 0.0009 * zc, 0.72, 1.06);
        bucket.push({
          pts, z: zc, a: alpha,
          c: shadeColor(base, (0.10 + 0.44 * d + 0.46 * env) * fade, 0.5 * Math.pow(hd, 26) + rim),
        });
        segs += v.length;
      }
    }

    function flush() {
      if (glr) return;                       // the depth buffer sorts for us
      if (!bucket.length) return;
      bucket.sort((A, B) => A.z - B.z);          // far first
      for (let i = 0; i < bucket.length; i++) {
        const f = bucket[i];
        ctx.beginPath();
        ctx.moveTo(f.pts[0], f.pts[1]);
        for (let k = 2; k < f.pts.length; k += 2) ctx.lineTo(f.pts[k], f.pts[k + 1]);
        ctx.closePath();
        ctx.globalAlpha = f.a;
        ctx.fillStyle = f.c;
        ctx.fill();
      }
      bucket.length = 0;
    }

    // Axial explode offsets, in assembly order out from the middle. After the
    // machine has come together it opens back UP into a held exploded view —
    // a solid-shaded body hides its own internals, so staying assembled would
    // throw away everything inside it.
    const EXPLODE = { shaft: 0, rotor: -88, stator: 74, can: 186, rearbell: -226, frontbell: 288, copper: -8 };
    const EXPLODE_ORDER = [0, -88, 74, -226, 288, 186];

    function drawMotor(p) {
      setCam((-28 + 48 * p) * DEG, (7 + 9 * p) * DEG, -140 + 170 * p - 90 * smooth(win(p, 0.62, 0.30)));
      const ex = smooth(win(p, 0.62, 0.30));
      const spin = place(rotZ(340 * DEG * Math.min(p / 0.62, 1) + 40 * DEG * ex), [0, 0, 0]);
      const base = chain(
        chain(MOTOR_MODULE, place(scaleM(1 - 0.30 * ex), [0, 0, 0])),
        spin,
      );
      const D = 210;
      const axial = i => (typeof i === 'number' ? EXPLODE_ORDER[i] || 0 : EXPLODE[i] || 0) * ex;

      for (const part of MOTOR) {
        const e = seat(win(p, part.lead, 0.26));
        const away = 1 - clamp(e, 0, 1);
        // the phantom of each seat, fading out as the real part lands on it
        if (away > 0.002) stroke(part.ghost, base, ink, 0.16 * away, 1);
        if (e <= 0.004) continue;

        const s = 1 + away * 0.5;
        let m = mul(rotX(away * part.dir[1] * 52 * DEG), rotY(away * -part.dir[0] * 52 * DEG));
        m = mul(m, rotZ(away * part.spin * DEG));
        // the rotor keeps turning once the stator has seated over it
        if (part.spins) m = mul(m, rotZ(3200 * DEG * Math.pow(win(p, 0.46, 0.54), 2)));
        const T = chain(base, place(mul(m, scaleM(s)), [
          part.dir[0] * away * D, part.dir[1] * away * D, part.dir[2] * away * D + axial(part.id),
        ]));
        submit(part.solids, T, METAL, clamp(e, 0, 1));
        part._T = T; part._a = clamp(e, 0, 1);
      }
      flush();                                   // masses, back to front
      for (const part of MOTOR) {
        if (!part._T || part._a <= 0.004) continue;
        // detail lines ride on top of the shaded masses
        stroke(part.polys, part._T, ink, 0.13 * part._a, 1);
      }

      // Copper: bars lying IN the stator slots, tied by an end-turn ring past
      // each end of the stack. A coil around the shaft axis is a solenoid, not
      // a motor winding.
      const cu = win(p, 0.30, 0.16);
      if (cu > 0) {
        const n = 9;
        const T = chain(base, place(IDENT, [0, 0, axial('copper')]));
        for (let k = 0; k < n; k++) {
          if (k / n > cu) break;
          submit(barSolid((k / n) * TAU, 44, -52, 52, 7), T, CU, 1);
        }
        const turn = win(p, 0.42, 0.08);
        if (turn > 0) {
          submit(surface([[-56, 46], [-48, 46]], 14), T, CU, turn);
          submit(surface([[48, 46], [56, 46]], 14), T, CU, turn);
        }
      }
    }

    function drawVision(p) {
      setCam((26 - 48 * p) * DEG, (7 + 9 * p) * DEG, -70 + 170 * p);
      const stage = place(IDENT, [0, IMG_Y, 0]);

      // 1 · the camera, taking itself apart along the optical axis
      const gone = smooth(win(p, 0.10, 0.16));
      const camAlpha = 1 - win(p, 0.13, 0.13);
      if (camAlpha > 0) {
        const turn = place(rotY(-42 * DEG), [0, 0, 0]);
        const shell = chain(stage, chain(turn, place(IDENT, [0, -120 * gone, -60 * gone])));
        const barrel = chain(stage, chain(turn, place(IDENT, [0, 0, 150 * gone])));
        submit(CAM_SOLID, shell, METAL, camAlpha);
        submit(LENS_SOLID, barrel, METAL, camAlpha);
        flush();
        stroke(CAM_BODY.concat(CAM_STRUTS, CAM_DETAIL), shell, ink, 0.5 * camAlpha, 1);
        stroke(LENS, barrel, ink, 0.45 * camAlpha, 1);
      }

      // 2 · the sensor it was hiding, coming forward
      const sens = smooth(win(p, 0.16, 0.14));
      if (sens > 0) {
        const T = chain(stage, place(IDENT, [0, 0, -30 + 46 * sens]));
        stroke([rect(112, 86, 0, 0, 0), rect(126, 100, 0, 0, -3)], T, ink, 0.5 * sens, 1);

        // photosites light to their own values, so the grid IS the image.
        // Bucketed by brightness so 48 cells cost 4 strokes, not 48.
        const buckets = [[], [], [], []];
        for (let i = 0; i < PX_C * PX_R; i++) {
          const a = smooth(win(p, 0.24 + (i / (PX_C * PX_R)) * 0.12, 0.05));
          if (a <= 0.02) continue;
          const [x, y] = pxPos(i);
          const v = pxVal(i) * a;
          const sz = PX * 0.76 * (0.45 + 0.55 * a);
          buckets[clamp(Math.ceil(v * 4) - 1, 0, 3)].push(rect(sz, sz, x, y, 1));
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
    // A soft studio ground behind the piece. Metal needs something to be lit
    // AGAINST — on a bare page background the reflection model has nothing to
    // read as, and the parts look like stickers. Built once, not per frame.
    let stage = null;
    const buildStage = () => {
      if (!ctx) return;
      const g = ctx.createRadialGradient(CX, CY * 0.92, 10, CX, CY * 0.92, W * 0.72);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      g.addColorStop(0, dark ? 'rgba(0,0,0,0.58)' : 'rgba(64,52,36,0.26)');
      g.addColorStop(0.55, dark ? 'rgba(0,0,0,0.34)' : 'rgba(64,52,36,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      stage = g;
    };
    buildStage();

    function draw(p) {
      if (glr) {
        glr.begin();
        if (isLeft) drawVision(p); else drawMotor(p);
        glr.end();
        canvas.dataset.segs = String(Math.round(glr.segs));
        canvas.dataset.calls = String(glr.calls);
        return;
      }
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
      canvas.dataset.calls = '';
    }

    // ── scroll driver ───────────────────────────────────────────────────
    // Hand-rolled and idle-when-idle: one passive listener, at most one rAF in
    // flight, and no redraw unless the progress actually moved. (anime's
    // onScroll with a numeric `sync` never settles — it kept rewriting the
    // scene ~1200x/second on a completely static page.)
    let raf = 0, lastP = -1, maxScroll = 1;
    const measure = () => { maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
    const frame = () => {
      raf = 0;
      const p = clamp(window.scrollY / maxScroll, 0, 1);
      if (Math.abs(p - lastP) < 0.0004) return;
      lastP = p;
      draw(p);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const onResize = () => { measure(); lastP = -1; onScroll(); };

    measure();
    if (reduce) {
      draw(isLeft ? 0.97 : 0.9);          // one composed, representative frame
    } else {
      draw(clamp(window.scrollY / maxScroll, 0, 1));
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
      themeWatch.disconnect();
      if (glr) glr.dispose();
    };
  }, [isLeft]);

  return (
    <div className={`f3d f3d--${side}`} ref={hostRef} aria-hidden="true">
      <canvas />
    </div>
  );
}
