import React, { useEffect, useRef } from 'react';
import { onScroll as onPageScroll } from '../scrollDriver';
import { heroPhase, S_MORPH, S_ART, partT, partArtA, publishTargets, actAt } from '../waveField';
import { onSettle } from '../scrollSnap';

// Two line-art pieces fixed to the viewport, one per side: a CAMERA on the
// left and an IEC-proportioned electric MOTOR on the right. Both are FORMED
// FROM THE HERO'S SINE WAVES — scroll, and each row is cut at the centre; the
// left half flies straight from the big field into the camera, the right half
// into the motor, part by part — and then they hold.
//
// The strands are drawn by WaveField.jsx, the one canvas that spans both the
// field and the stages. This file supplies where they land (the captured
// finished frame) and fades each part's real drawing in as its strands
// arrive. There used to be page-long scroll sequences on both sides (a
// camera teardown into a vision-transformer pipeline, a motor threading
// itself together on a spinning axle); the owner asked for those to go.
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
// What carried over: the geometry (the IEC D80 motor profiles, the meridian
// maths), both themes and reduced-motion (which shows the finished motor).

// LINE is an rgb() string by the time materials are built, not a hex
const rgbStrToHex = str => {
  const m = (str || '').match(/[\d.]+/g) || [0, 0, 0];
  return '#' + m.slice(0, 3).map(v => Math.round(+v).toString(16).padStart(2, '0')).join('');
};

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
// A propeller for the drive end. Each blade is a twisted surface: walk out
// along the span, and at each station lay the chord across a direction that is
// part tangential and part axial — that angle is the PITCH, and it has to fall
// from root to tip or the blade reads as a flat paddle rather than a screw.
function propBlade(a0, n = 7) {
  const R0 = 18, R1 = 128, Z = 176;
  const quads = [], le = [], te = [];
  const at2 = t => {
    const r = R0 + (R1 - R0) * t;
    const c = 40 * (1 - 0.40 * t);                 // chord narrows toward the tip
    const pitch = (34 - 22 * t) * DEG;             // and flattens
    const a = a0 + 0.30 * t;                       // slight sweep
    const ca = Math.cos(a), sa = Math.sin(a);
    // chord direction = tangential * cos(pitch) + axial * sin(pitch)
    const dx = -sa * Math.cos(pitch), dy = ca * Math.cos(pitch), dz = Math.sin(pitch);
    const px = r * ca, py = r * sa;
    const h = c / 2;
    return [[px + dx * h, py + dy * h, Z + dz * h], [px - dx * h, py - dy * h, Z - dz * h]];
  };
  let prev = at2(0);
  le.push(prev[0]); te.push(prev[1]);
  for (let i = 1; i <= n; i++) {
    const cur = at2(i / n);
    quads.push(face([prev[0], cur[0], cur[1], prev[1]]));
    prev = cur; le.push(cur[0]); te.push(cur[1]);
  }
  return { solids: quads, polys: [le, te, [le[0], te[0]], [le[n], te[n]]] };
}
const PROP_BLADES = 3;
const PROP = (() => {
  const solids = [], polys = [];
  for (let k = 0; k < PROP_BLADES; k++) {
    const b2 = propBlade((k / PROP_BLADES) * TAU);
    solids.push(...b2.solids); polys.push(...b2.polys);
  }
  // spinner: the cone that caps the hub
  solids.push(...surface([[164, 20], [176, 22], [196, 14], [206, 0]], 18));
  solids.push(...disc(9.5, 20, 164, 18));
  polys.push(...revolve([[164, 20], [176, 22], [196, 14], [206, 0]], 3, [[164, 20], [176, 22], [196, 14]]));
  // LOD detail: chord ribs across each blade, root fillets, spinner screws
  const detail = [];
  for (let k = 0; k < PROP_BLADES; k++) {
    const a0 = (k / PROP_BLADES) * TAU;
    const b3 = propBlade(a0, 7);
    const le = b3.polys[0], te = b3.polys[1];
    for (let i = 2; i < le.length - 1; i++) detail.push([le[i], te[i]]);   // ribs
    detail.push([le[1], te[1]]);
  }
  detail.push(ring(20, 168, 18), ring(22, 176, 18), ring(14, 196, 16));
  detail.push(...radial(3, a => [ringAt(2.6, 17 * Math.cos(a), 17 * Math.sin(a), 170, 8)]));
  return { solids, polys, detail };
})();

// MATERIALS. In the exploded strip the parts were nine shapes in one grey, so
// the only thing telling them apart was silhouette. A real parts diagram
// separates them by material, and that is the axis used here — restrained and
// warm rather than a rainbow, and assigned so that NEIGHBOURS along the strip
// never share one. `w` is how far the fill is pulled off the page colour toward
// the hue; the linework gets a lighter dose of the same so the wireframe
// carries the difference too.
//   0 neutral   the default, and everything on the vision side
//   1 copper    the winding, and nothing else (as before)
const MAT = {
  neutral: 0, copper: 1, steel: 2, iron: 3, alu: 4, poly: 5, paint: 6,
};
// hex per slot; `copper` and `paint` are filled in from theme tokens
const MAT_HEX = ['', '', '#8FA6B8', '#7A6A55', '#C9CED4', '#3C4046', '#8A7F6B'];
// Weight is inversely related to how much of the frame the part covers. A tint
// worth 0.3 on the shaft is invisible; the same 0.3 on the housing turns the
// assembled machine into a coloured blob and throws away the line art. So the
// big masses stay near the page colour and the small parts carry the colour —
// and most of the separation is done by the LINEWORK, which costs no area.
const MAT_W   = [0, 0.46, 0.26, 0.30, 0.22, 0.42, 0.13];
const MAT_LINE_W = 0.6;          // how much of the tint the wireframe takes

const MOTOR_SPEC = [
  {
    id: 'shaft', r: 12, mat: MAT.steel, lead: 0.02, dir: [0.06, -0.10, 1], spin: -180, spins: true,
    ghost: () => [ring(9.5, -166, 20), ring(9.5, 178, 20)],
    solids: () => [...surface(P_SHAFT, 14), ...disc(0, 9.5, -166, 14)],
    detail: () => [
      ring(9.5, 118, 20), ring(9.5, 125, 20),      // circlip groove
      ring(9.5, 150, 20), ring(8.6, 174, 20),      // step down, then the chamfer
      ring(9.5, -150, 20),                          // rear bearing seat
      [[-3.5, 0, 154], [3.5, 0, 154]], [[-3.5, 0, 170], [3.5, 0, 170]],  // keyway ends
    ],
    polys: () => [
      ...revolve(P_SHAFT, 3, [[-166, 9.5], [150, 9.5], [178, 8]]),
      rect(7, 16, 0, 0, 162),                                    // keyway, drive end
    ],
  },
  {
    id: 'rotor', r: 34, mat: MAT.steel, lead: 0.11, dir: [-0.08, 0.12, 1], spin: 300, spins: true,
    ghost: () => [ring(33, 0, 28)],
    solids: () => [
      ...surface([[-40, 33], [40, 33]], 18), ...disc(9.5, 33, -40, 18), ...disc(9.5, 33, 40, 18),
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
    detail: () => [
      // the stack is LAMINATED: individual sheets, not a solid drum
      ...Array.from({ length: 9 }, (_, i) => ring(33, -34 + i * 8.5, 26)),
      ...radial(4, a => [ringAt(3.4, 25 * Math.cos(a), 25 * Math.sin(a), 40, 8)]),  // balance holes
      ring(26, 40, 24), ring(26, -40, 24),
    ],
  },
  {
    // The cooling fan is its OWN part. It used to be drawn as part of the
    // rotor, 86 units behind it, which meant the exploded view had a rotor
    // with a fan floating off one end rather than a fan you could see arrive.
    id: 'fan', r: 46, mat: MAT.poly, lead: 0.14, dir: [0.10, -0.06, 1], spin: 260, spins: true,
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
    id: 'stator', r: 64, mat: MAT.iron, lead: 0.20, dir: [0.10, 0.05, 1], spin: -260,
    ghost: () => [ring(62, 0, 32)],
    solids: () => [
      ...surface([[-45, 62], [45, 62]], 20), ...disc(31, 62, -45, 20), ...disc(31, 62, 45, 20),
    ],
    polys: () => [
      ring(31, -45), ring(31, 45), ring(62, -45), ring(62, 45),
      // trapezoidal slot teeth on both lamination faces
      ...[-45, 45].flatMap(z => radial(9, a => {
        const w = 0.11;
        return [[at(a - w, 40, z), at(a - w * 0.45, 50, z), at(a + w * 0.45, 50, z), at(a + w, 40, z)]];
      })),
    ],
    detail: () => [
      ...Array.from({ length: 11 }, (_, i) => ring(62, -42 + i * 8.4, 30)),   // lamination sheets
      ...radial(9, a => [[at(a, 62, -45), at(a, 62, 45)]]),                   // stack keys
      ring(52, -45, 26), ring(52, 45, 26),
    ],
  },
  {
    id: 'rearbell', r: 84, mat: MAT.alu, lead: 0.40, dir: [-0.05, -0.12, -1], spin: 220,
    ghost: () => [ring(82, -104, 32)],
    solids: () => [...surface(P_COWL, 18), ...disc(26, 32, -160, 18)],
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
    detail: () => [
      ring(24, -100, 22), ring(13, -100, 20),                    // bearing outer/inner race
      ...radial(10, a => [[at(a, 18, -99), at(a, 21, -99)]]),     // ball cage ticks
      ...radial(6, a => [ringAt(4.2, 74 * Math.cos(a), 74 * Math.sin(a), -103, 10)]),  // flange bolts
      ring(74, -103, 30),
    ],
  },
  {
    id: 'frontbell', r: 84, mat: MAT.alu, lead: 0.49, dir: [0.08, 0.10, 1], spin: -240,
    ghost: () => [ring(82, 104, 32)],
    solids: () => [...surface(P_FRONT, 18), ...disc(14, 22, 146, 16)],
    polys: () => [
      ...revolve(P_FRONT, 3, [[102, 82], [112, 82], [122, 52], [130, 38], [136, 27]]),
      ring(17, 104, 22), ring(9.5, 104, 18),
      ...radial(6, a => [ringAt(2.2, 13 * Math.cos(a), 13 * Math.sin(a), 104, 8)]),
      ...radial(6, a => [ringAt(2.6, 62 * Math.cos(a), 62 * Math.sin(a), 104, 8)]),
    ],
    detail: () => [
      ring(24, 104, 22), ring(13, 104, 20),
      ...radial(10, a => [[at(a, 18, 105), at(a, 21, 105)]]),
      ...radial(6, a => [ringAt(4.2, 74 * Math.cos(a), 74 * Math.sin(a), 103, 10)]),
      ring(74, 103, 30),
      ring(16, 140, 20), ring(14, 146, 20),                       // oil seal lip
    ],
  },
  {
    id: 'can', r: 90, mat: MAT.paint, lead: 0.58, dir: [-0.10, 0.06, -1], spin: 200,
    ghost: () => [ring(88, 0, 32)],
    solids: () => [
      ...surface(P_FRAME_SOLID, 20),
      ...disc(0, 82, -98, 20), ...disc(0, 82, 98, 20),
      ...plate(38, 24, 0, -92, 13),                // nameplate
    ],
    polys: () => [
      ...revolve(P_FRAME, 3, [[-98, 78], [98, 78], [0, 88]]),
      // nameplate on the flank, with its engraved lines
      rect(38, 24, 0, -92, 0),
      [[-13, -92, 5], [13, -92, 5]], [[-13, -92, -1], [13, -92, -1]],
    ],
    detail: () => [
      ...[-4, 1, 6].map(dz => [[-14, -92, dz], [14, -92, dz]]),   // engraved lines
      rect(30, 17, 0, -92, 0),
      // drain plugs, and the machined faces at each end of the frame
      ...radial(3, a => [ringAt(3.6, 84 * Math.cos(a), 84 * Math.sin(a), -86, 10)]),
      ring(82, -98, 30), ring(82, 98, 30),
      // NOT longitudinal ribs: twelve of them turned the body into a fence,
      // which is the failure mode this file already records for slatted
      // cylinders. Circumferential detail follows the perspective ellipse and
      // reads as a turned body instead.
      ring(86, -60, 30), ring(86, 0, 30), ring(86, 60, 30),
    ],
  },
  {
    // The propeller goes on last, onto a shaft that is already turning.
    id: 'prop', r: 130, mat: MAT.steel, lead: 0.70, dir: [0.04, -0.08, 1], spin: 340, spins: true,
    ghost: () => [ring(128, 176, 24)],
    solids: () => PROP.solids,
    polys: () => PROP.polys,
    detail: () => PROP.detail,    ghost: () => [ring(128, 176, 24)],
    solids: () => PROP.solids,
    polys: () => PROP.polys,
  },
  {
    // The terminal box is a RADIAL feature — it bolts onto the flank of the
    // frame — so it is the one part that leaves sideways rather than along the
    // axis. `side` is how far out it goes, in local units.
    id: 'tbox', r: 40, mat: MAT.poly, lead: 0.62, dir: [0, 0, 0], spin: 0, side: 300,
    ghost: () => [ringAt(6, 0, 142, 0, 12)],
    solids: () => [...boxFaces(30, 40, 26, 0, 100, 0)],
    polys: () => [
      ...boxWire(30, 40, 26, 0, 100, 0),
      ...radial(4, a => [ringAt(2, 11 * Math.cos(a), 100 + 11 * Math.sin(a), 13, 6)]),
      [[-5, 120, 0], [-5, 142, 0]], [[5, 120, 0], [5, 142, 0]],
      ringAt(6, 0, 142, 0, 12),
    ],
    detail: () => [
      ...boxWire(24, 33, 20, 0, 100, 0),                          // recessed lid
      ringAt(7.5, 0, 133, 0, 12), ringAt(7.5, 0, 138, 0, 12),      // cable gland nut
      [[-9, 120, 6], [9, 120, 6]],
    ],
  },
];
// built once — the geometry never changes, only its placement
const MOTOR = MOTOR_SPEC.map(p => ({ ...p, polys: p.polys(), ghost: p.ghost(), solids: p.solids ? p.solids() : [], detail: p.detail ? p.detail() : null }));
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

/* ══════════════════════════════════════════════════════════════════════════
   LEFT — the camera
   ══════════════════════════════════════════════════════════════════════════ */

// A mirrorless body and lens, assembled, in three-quarter view. It is formed
// from the left half of the hero's waves and then holds, the way the motor
// does on the right. (It used to tear itself down into a vision-transformer
// pipeline over the whole page; the owner asked for the camera alone.)
const CAM_SIL = [
  [-51, 2], [-51, -14], [-37, -16], [-31, -30], [-8, -34], [0, -18], [28, -18],
  [38, -12], [48, -10], [48, 36], [38, 46], [19, 50], [-27, 52], [-46, 44], [-51, 24],
];
const P_LENS = [[10, 33], [16, 33], [18, 26], [30, 26], [32, 29], [48, 29], [50, 25], [62, 25], [64, 27], [70, 27], [72, 20], [74, 0]];
const CAM_FRONT_SOLID = extrude(CAM_SIL, 2, 19);
const CAM_BACK_SOLID = extrude(CAM_SIL, -19, -2);
const LENS_E1 = [...surface([[44, 27], [50, 25], [52, 22]], 18), ...disc(0, 27, 44, 18)];
const LENS_E2 = [...surface([[62, 25], [68, 23], [70, 19]], 18), ...disc(0, 25, 62, 18)];
const LENS_SOLID = [...surface(P_LENS, 20), ...disc(0, 20, 72, 20)];
const CAM_TOP = [...boxFaces(22, 10, 16, 24, -30, 4), ...boxFaces(16, 9, 14, -32, -26, 4)];
// Each piece carries its OWN wireframe. Deriving one from the face list wires
// every triangle of a lathe's end-cap fan and the lens front comes out as a
// sunburst; a shell comes out as a ladder of coincident quad edges.
const shellWire = (z0, z1) => [
  [...CAM_SIL.map(([x, y]) => [x, y, z0]), [CAM_SIL[0][0], CAM_SIL[0][1], z0]],
  [...CAM_SIL.map(([x, y]) => [x, y, z1]), [CAM_SIL[0][0], CAM_SIL[0][1], z1]],
  ...CAM_SIL.filter((_, i) => i % 3 === 0).map(([x, y]) => [[x, y, z0], [x, y, z1]]),
];
// Materials as on the motor: no two neighbours share one, the big shells get
// the lightest dose. The two glass elements are drawn in the accent — gold
// means the optical path.
const CAMERA = [
  { id: 'lens-front', mat: MAT.neutral, glass: true, solid: LENS_E2, wire: [ring(25, 62, 20), ring(19, 70, 20)] },
  { id: 'lens-rear', mat: MAT.neutral, glass: true, solid: LENS_E1, wire: [ring(27, 44, 20), ring(22, 52, 20)] },
  { id: 'barrel', mat: MAT.alu, solid: LENS_SOLID,
    wire: [...revolve(P_LENS, 3, [[16, 33], [30, 26], [48, 29], [62, 25], [70, 27]]),
           ...radial(10, a2 => [[at(a2, 29, 36), at(a2, 29, 46)]])] },     // focus-ring knurling
  { id: 'front-shell', mat: MAT.paint, solid: CAM_FRONT_SOLID, wire: shellWire(2, 19) },
  { id: 'top-plate', mat: MAT.steel, solid: CAM_TOP,
    wire: [...boxWire(22, 10, 16, 24, -30, 4), ...boxWire(16, 9, 14, -32, -26, 4)],
    detail: [ringAt(7, 24, -30, 20, 12), ringAt(9, -32, -26, 20, 12)] },   // shutter, dial
  { id: 'back-shell', mat: MAT.paint, solid: CAM_BACK_SOLID, wire: shellWire(-19, -2) },
];
// Sized and placed to pair with the motor across the page; checked by the ink
// bounding box, like everything else in this file.
const CAM_SCALE = 2.25;
const CAM_X = -22;
const CAM_Y = -10;
const CAM_TURN = mul(rotY(74 * DEG), scaleM(CAM_SCALE));

// ── act two, left: the camera explodes down to its sensor ──────────────────
// How each piece leaves, in assembly order along the camera's own optical
// axis: glass forward, shells back, the top plate straight up. `at` is the
// station along the axis (+ out the front), `rise` lifts a piece clear.
const CAM_EXPLODE = {
  'lens-front': { at: 1.00, rise: 0, order: 0 },
  'lens-rear': { at: 0.72, rise: 0, order: 1 },
  'barrel': { at: 0.44, rise: 0, order: 2 },
  'front-shell': { at: 0.20, rise: 0, order: 3 },
  'top-plate': { at: 0.00, rise: -1, order: 4 },
  'back-shell': { at: -0.34, rise: 0, order: 5 },
};
// The sensor left behind: a die in its package, then 8x6 photosites that
// light to their own values, so the grid IS an image (a soft bright blob
// off-centre), not graph paper.
const PX_C = 8, PX_R = 6, PX = 13;
const pxPos = i => [((i % PX_C) - (PX_C - 1) / 2) * PX, (Math.floor(i / PX_C) - (PX_R - 1) / 2) * PX];
const pxVal = (i, frame = 0) => {
  const [x, y] = pxPos(i);
  const d = Math.hypot((x - 13) / 38, (y + 7) / 29);
  // the blob drifts a little from capture to capture, so consecutive frames
  // read as consecutive PICTURES rather than one frozen one
  const wob = frame ? 6 * Math.sin(frame * 1.7) : 0;
  const d2 = Math.hypot((x - 13 - wob) / 38, (y + 7 + wob * 0.4) / 29);
  return clamp(1.15 - (frame ? d2 : d), 0.05, 1) * (0.75 + 0.25 * hash(i * 3.7 + frame * 5.9));
};
const SENSOR_SCALE = 1.75;
// bond pads round the package edge: what makes a rectangle read as a chip
const SENSOR_PADS = (() => {
  const out = [];
  for (let i = 0; i < 12; i++) { const x = -55 + i * 10; out.push([[x, -50, 0], [x, -56, 0]], [[x, 50, 0], [x, 56, 0]]); }
  for (let i = 0; i < 9; i++) { const y = -40 + i * 10; out.push([[-63, y, 0], [-69, y, 0]], [[63, y, 0], [69, y, 0]]); }
  return out;
})();

// ── act two, right: the motor becomes a 2R arm ─────────────────────────────
// A planar two-link arm in the plane facing the viewer. The motor turns its
// axis toward the viewer and settles in as the SHOULDER actuator; a base
// rises under it; link 1 grows off its output shaft, the elbow joint appears
// at its end, link 2 grows from that, and a gripper closes the chain.
// Angles are screen-style (y down): -52 deg is up and to the right.
const ARM = {
  SH: [-94, 24],           // shoulder, in stage units from the centre
  K: 0.40,                 // motor scale as the shoulder actuator
  L1: 150, R1: 17,         // link 1 length and half-width
  L2: 108, R2: 13,
  TH1: -58, TH2: 80,       // final joint angles
  Z1: 72,                  // link 1 sits on the output shaft, in front of the motor
};
// a link's outline: a stadium from the joint at the origin out along +x.
// Wound like CAM_SIL, so extrude() culls it the same way.
function stadium(L, r, n = 8) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = (90 + (180 * i) / n) * DEG; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  for (let i = 0; i <= n; i++) { const a = (-90 + (180 * i) / n) * DEG; pts.push([L + r * Math.cos(a), r * Math.sin(a)]); }
  return pts;
}
const silWire = (sil, z0, z1, every = 4) => [
  [...sil.map(([x, y]) => [x, y, z0]), [sil[0][0], sil[0][1], z0]],
  [...sil.map(([x, y]) => [x, y, z1]), [sil[0][0], sil[0][1], z1]],
  ...sil.filter((_, i) => i % every === 0).map(([x, y]) => [[x, y, z0], [x, y, z1]]),
];
// a joint drum along z, radius r, from z0 to z1
const drum = (r, z0, z1) => [...surface([[z0, r], [z1, r]], 18), ...disc(0, r, z1, 18), ...disc(0, r, z0, 18)];
const drumWire = (r, z0, z1) => [ring(r, z0, 22), ring(r, z1, 22), ring(r * 0.45, z1, 14)];
const ELBOW = { solid: drum(24, -16, 30), wire: drumWire(24, -16, 30) };
const WRIST = { solid: drum(15, -10, 18), wire: drumWire(15, -10, 18) };
const BASE_PLINTH = { solid: boxFaces(96, 20, 90, 0, 0, 0), wire: boxWire(96, 20, 90, 0, 0, 0) };
const finger = (y) => ({ solid: boxFaces(26, 6, 12, 13, y, 4), wire: boxWire(26, 6, 12, 13, y, 4) });


export default function Flourish3D({ side = 'right' }) {
  const hostRef = useRef(null);
  const isLeft = side === 'left';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const canvas = host.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    // W/H are the DRAWING coordinate system and never change — every fit, every
    // camera constant and every LOD threshold in this file is expressed in
    // them. What changes with the viewport is how large that system is painted,
    // which is `fit`: CSS sizes the host, and the context is scaled to match.
    // Doing it this way means a phone gets a smaller, cheaper canvas without
    // any of the composition tuning having to be redone for it.
    const W = 340, H = 660;
    const CX = W / 2, CY = H / 2;
    let fit = 1, dpr = 1;
    const sizeCanvas = () => {
      const cssW = host.clientWidth || W;
      fit = cssW / W;
      // Line art does not need a full 2x buffer: every fill and stroke costs in
      // proportion to the pixels it touches, so a cap of 2 is four times the
      // rasterising of a cap of 1. Phones are both denser and slower, so they
      // get less. (Invisible from here — this box reports a ratio of 1.)
      const cap = window.innerWidth < 992 ? 1.25 : 1.5;
      dpr = Math.min(window.devicePixelRatio || 1, cap);
      const bw = Math.max(1, Math.round(W * fit * dpr));
      const bh = Math.max(1, Math.round(H * fit * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh;
      }
    };
    sizeCanvas();

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastY = -1;                // scroll position of the last paint
    let morph = null;              // the wave->motor morph, built lazily, rebuilt on theme change
    let hostA = 0.95;
    const readHostA = () => { hostA = parseFloat(getComputedStyle(host).opacity) || 1; };
    readHostA();

    // theme colours, read once and refreshed when the theme attribute changes
    let ink = '#C5A35C', copper = '#A85A2A';
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
      // Pulled a little toward the accent. Dead-neutral grey linework on a page
      // built out of warm off-white, warm near-black and gold read as foreign.
      {
        const l = hexToRgb(LINE), a2 = hexToRgb(ink), w = 0.18;
        LINE = `rgb(${Math.round(l[0] + (a2[0] - l[0]) * w)},${Math.round(l[1] + (a2[1] - l[1]) * w)},${Math.round(l[2] + (a2[2] - l[2]) * w)})`;
      }
      ink = cs.getPropertyValue('--accent-color').trim() || ink;
      copper = cs.getPropertyValue('--f3d-copper').trim() || copper;
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
    // Below this many pixels of part radius the fine geometry is a smudge, so
    // it is not submitted at all.
    const LOD_PX = 44;
    const LOOK = {
      surface: 1,        // the fill is opaque page colour: it HIDES what is behind
      shadeRange: 0.20,  // how much a face's tone may drift with its normal
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
    let matRGB = MAT_HEX.map(h => (h ? hexToRgb(h) : null));
    let matLine = MAT_HEX.map(() => LINE);
    const WARM_HI = [246, 244, 242];      // warm white
    const WARM_LO = [37, 36, 35];         // warm near-black
    const toneCache = new Map();
    // `tint` is the material: 0 = plain page-coloured body, 1 = the winding,
    // which keeps a little of its own colour so copper still means copper.
    // `lit` is 0..1. Levels cost draw calls — flush() can only merge entries
    // that share a colour — but since flush() started grouping by style within
    // a depth slab, more levels are much cheaper than they were, and a
    // fourteen-step ramp is the difference between a body that turns and a
    // body that steps.
    const TONE_STEPS = 14;
    const paperTone = (lit, mat) => {
      const q = Math.max(0, Math.min(TONE_STEPS, Math.round(lit * TONE_STEPS)));
      const key = q * 8 + mat;
      let c = toneCache.get(key);
      if (c) return c;
      // dark theme: lift toward ink.  light theme: sink away from it.
      // Bodies sit OFF the page, not on it. A fill of exactly
      // --background-color reads as a hole on the dark theme, because the page
      // carries its own gradient and is lighter than its own token where the
      // art sits. And the tone has to actually MOVE across a body: at a range
      // of 0.05 a cylinder came out one flat value and the piece had no
      // shading at all, just a silhouette with a wire around it.
      const lift = dark ? 0.19 : -0.08;
      const k = lift + (q / TONE_STEPS - 0.5) * 2 * LOOK.shadeRange;
      // Warm, not neutral. The page is a warm off-white over a warm near-black
      // with a gold accent; mixing toward pure #fff / #000 left the pieces a
      // dead grey that did not belong to the rest of the site. These are the
      // ends of the ramp the reference uses too.
      const tgt = k >= 0 ? WARM_HI : WARM_LO;
      const mix = (a1, i) => Math.max(0, Math.min(255, Math.round(a1 + (tgt[i] - a1) * Math.abs(k))));
      let r = mix(paperRGB[0], 0), g = mix(paperRGB[1], 1), b2 = mix(paperRGB[2], 2);
      // The light theme needs a heavier dose: its bodies sit near white, and a
      // pale tint mixed into near-white barely moves. The dark theme's bodies
      // are already dark, so the same weight reads much more strongly there.
      const tint = matRGB[mat], w = MAT_W[mat] * (dark ? 1 : 1.55);
      if (tint && w) {
        r = Math.round(r + (tint[0] - r) * w);
        g = Math.round(g + (tint[1] - g) * w);
        b2 = Math.round(b2 + (tint[2] - b2) * w);
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
      paperRGB = hexToRgb(paper); inkRGB = hexToRgb(ink); cuRGB = hexToRgb(copper);
      // copper and the housing paint come from the theme tokens; the rest are
      // fixed, because "steel" and "aluminium" mean the same thing in both
      // themes and only their contrast against the page changes.
      matRGB = MAT_HEX.map(h => (h ? hexToRgb(h) : null));
      matRGB[MAT.copper] = hexToRgb(copper);
      // The housing is a warm painted grey, NOT the gold accent — the accent on
      // a surface that size reads as decoration rather than as a machine.

      // Each material's linework carries a lighter dose of the same tint, so
      // the wireframe separates the parts too and not just the fills.
      const L = hexToRgb(LINE.startsWith('#') ? LINE : rgbStrToHex(LINE));
      matLine = matRGB.map(t => (t
        ? `rgb(${Math.round(L[0] + (t[0] - L[0]) * MAT_LINE_W)},${Math.round(L[1] + (t[1] - L[1]) * MAT_LINE_W)},${Math.round(L[2] + (t[2] - L[2]) * MAT_LINE_W)})`
        : LINE));
      toneCache.clear();
    };
    readMaterials();
    // Repaint at the CURRENT progress. This used to call the piece's own
    // scroll handler, which stopped existing when the listener moved to the
    // shared driver — the observer then threw `onScroll is not defined` on
    // every theme toggle and the canvas kept the previous theme's colours
    // until something else happened to scroll the page.
    const repaint = () => {
      lastY = -1;
      draw();
    };
    // The host is sized by CSS, so a breakpoint change or a rotation resizes it
    // without React re-mounting anything. Re-derive the backing store and
    // repaint rather than leaving a stretched canvas behind.
    let sizeRO = null;
    if (typeof ResizeObserver !== 'undefined') {
      let lastW = host.clientWidth;
      sizeRO = new ResizeObserver(() => {
        if (host.clientWidth === lastW) return;
        lastW = host.clientWidth;
        sizeCanvas();
        readHostA();
        publish();
        repaint();
      });
      sizeRO.observe(host);
    }

    const themeWatch = new MutationObserver(() => { readTheme(); readMaterials(); publish(); repaint(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });



    // ── camera ──────────────────────────────────────────────────────────
    const PERSP = 600;
    let cam = null;
    // Reused, not allocated. cam() runs once per vertex — five thousand times a
    // frame — and returning a fresh [x,y,z] each time was five thousand short
    // lived arrays a frame of pure GC pressure. Callers read the three values
    // immediately, so one shared triple is safe.
    const _c = [0, 0, 0];
    const setCam = (yaw, pitch, dolly) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
      cam = (x, y, z) => {
        const X = x * cy + z * sy, Z0 = -x * sy + z * cy;
        const Y = y * cx - Z0 * sx, Z = y * sx + Z0 * cx + dolly;
        const k = PERSP / (PERSP - Z);
        _c[0] = CX + X * k; _c[1] = CY + Y * k; _c[2] = Z;
        return _c;
      };
    };

    // ── drawing ─────────────────────────────────────────────────────────
    // One beginPath/stroke per style group, so the draw-call count stays in the
    // dozens no matter how many segments there are.
    let segs = 0;
    // CAPTURE MODE. While `cap` is an array, nothing is drawn: every polyline
    // that would have been stroked is projected and recorded instead, with
    // its colour, alpha and width. The prelude uses one such capture — the
    // piece's first frame — as the target the arriving sine rows gather into.
    let cap = null;
    let capId = '';                // which part a captured line belongs to
    const record = (poly, m, t, color, alpha, width) => {
      const pts = new Float64Array(poly.length * 2);
      for (let i = 0; i < poly.length; i++) {
        const q = poly[i];
        const sc = cam(
          m[0] * q[0] + m[1] * q[1] + m[2] * q[2] + t[0],
          m[3] * q[0] + m[4] * q[1] + m[5] * q[2] + t[1],
          m[6] * q[0] + m[7] * q[1] + m[8] * q[2] + t[2],
        );
        pts[i * 2] = sc[0]; pts[i * 2 + 1] = sc[1];
      }
      cap.push({ pts, c: color, a: alpha, w: width, id: capId });
    };
    function stroke(polys, T, color, alpha, width) {
      if (alpha <= 0.004 || !polys.length) return;
      const m = T.m, t = T.t;
      if (cap) { for (let pi = 0; pi < polys.length; pi++) if (polys[pi].length > 1) record(polys[pi], m, t, color, alpha, width); return; }
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
      if (alpha <= 0.004 || !polys.length || cap) return;
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
    // Key light, upper-left-front.
    const KEY = (() => { const v = [-0.45, -0.62, 0.64]; const L = Math.hypot(v[0], v[1], v[2]); return [v[0] / L, v[1] / L, v[2] / L]; })();
    let bucket = [];
    // Style keys are interned to integers so the sort can order by them.
    // Fills sort before lines within a slab, which keeps a line on top of its
    // own body the way LINE_BIAS intends.
    // ONE buffer for every projected point in the frame. Each face and each
    // polyline used to allocate its own array; this hands out slices of a
    // Float64Array instead and resets the cursor once per frame.
    let PTS = new Float64Array(1 << 14);
    let ptsN = 0;
    const ptsRoom = need => {
      if (ptsN + need <= PTS.length) return;
      let cap = PTS.length; while (cap < ptsN + need) cap *= 2;
      const next = new Float64Array(cap); next.set(PTS.subarray(0, ptsN)); PTS = next;
    };

    const styleIds = new Map();
    const styleId = (isLine, colour, width) => {
      const k = (isLine ? 'L' : 'F') + colour + (isLine ? '|' + width : '');
      let v = styleIds.get(k);
      if (v === undefined) { v = styleIds.size + 1; styleIds.set(k, v); }
      return (isLine ? 100000 : 0) + v;
    };
    function submit(faces, T, base, alpha) {          // `base` is a MAT slot
      if (alpha <= 0.02 || !faces.length || cap) return;
      const m = T.m, t = T.t;
      for (let fi = 0; fi < faces.length; fi++) {
        const f = faces[fi], v = f.v, n = f.n;
        const nx = m[0] * n[0] + m[1] * n[1] + m[2] * n[2];
        const ny = m[3] * n[0] + m[4] * n[1] + m[5] * n[2];
        const nz = m[6] * n[0] + m[7] * n[1] + m[8] * n[2];
        const nl = Math.hypot(nx, ny, nz) || 1;

        ptsRoom(v.length * 2);
        const o = ptsN;
        let zsum = 0;
        for (let i = 0; i < v.length; i++) {
          const q = v[i];
          const sc = cam(
            m[0] * q[0] + m[1] * q[1] + m[2] * q[2] + t[0],
            m[3] * q[0] + m[4] * q[1] + m[5] * q[2] + t[1],
            m[6] * q[0] + m[7] * q[1] + m[8] * q[2] + t[2],
          );
          PTS[o + i * 2] = sc[0]; PTS[o + i * 2 + 1] = sc[1]; zsum += sc[2];
        }
        // back-face cull by screen winding — no view-space normal needed
        let area = 0;
        for (let i = 0; i < v.length; i++) {
          const j = (i + 1) % v.length;
          area += PTS[o + i * 2] * PTS[o + j * 2 + 1] - PTS[o + j * 2] * PTS[o + i * 2 + 1];
        }
        if (area <= 0) continue;                 // cursor not advanced: slot reused
        ptsN += v.length * 2;

        // THREE cheap terms, still no specular and no environment map — the
        // thing that made the old version look like photographed metal was
        // gloss, not shading. What is here is what a technical illustrator
        // would use:
        //   key      a directional light, the main read of the form
        //   sky      hemispheric ambient, so a face pointing up is never as
        //            dark as one pointing down. A single directional term
        //            leaves the unlit side of a cylinder a flat slab.
        //   grazing  faces turning away from the viewer lift slightly, which
        //            is what separates a curved body from a flat one at its
        //            silhouette
        const inx = nx / nl, iny = ny / nl, inz = nz / nl;
        const key = inx * KEY[0] + iny * KEY[1] + inz * KEY[2];
        const sky = -iny;                                  // +1 = faces up
        const grazing = 1 - Math.abs(inz);
        let lit = 0.5 + 0.40 * key + 0.15 * sky + 0.16 * grazing * grazing;
        lit = lit < 0 ? 0 : lit > 1 ? 1 : lit;
        const zc = zsum / v.length;
        const col = paperTone(lit, base);
        bucket.push({ o, n: v.length, z: zc, a: alpha * LOOK.surface, c: col, k: styleId(0, col, 0) });
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
      if (cap) { for (let pi = 0; pi < polys.length; pi++) if (polys[pi].length > 1) record(polys[pi], m, t, color, alpha, width); return; }
      for (let pi = 0; pi < polys.length; pi++) {
        const poly = polys[pi];
        if (poly.length < 2) continue;
        ptsRoom(poly.length * 2);
        const o = ptsN;
        let zsum = 0;
        for (let i = 0; i < poly.length; i++) {
          const q = poly[i];
          const sc = cam(
            m[0] * q[0] + m[1] * q[1] + m[2] * q[2] + t[0],
            m[3] * q[0] + m[4] * q[1] + m[5] * q[2] + t[1],
            m[6] * q[0] + m[7] * q[1] + m[8] * q[2] + t[2],
          );
          PTS[o + i * 2] = sc[0]; PTS[o + i * 2 + 1] = sc[1]; zsum += sc[2];
        }
        ptsN += poly.length * 2;
        // nudged toward the viewer so a line ON a surface wins against it
        bucket.push({ line: 1, o, n: poly.length, z: zsum / poly.length + LINE_BIAS,
                      a: alpha, c: color, w: width, k: styleId(1, color, width) });
        segs += poly.length - 1;
      }
    }

    // Draw the sorted bucket in RUNS. Entries that are adjacent in depth order
    // and share a style go into one path and one fill/stroke, which leaves the
    // painter's order exactly as it was while collapsing the draw-call count:
    // ~680 calls a frame down to a few dozen. This matters because the line-art
    // rewrite gave every polyline its own beginPath+stroke — about 200 strokes
    // a frame where the shaded version had a dozen batched ones — and each
    // stroke carries fixed rasteriser setup.
    function flush() {
      if (cap) { bucket.length = 0; ptsN = 0; return; }
      if (!bucket.length) return;
      // Sort by depth SLAB first, then by style. Ordering strictly by depth is
      // correct but interleaves styles, so almost nothing merges — and giving
      // each part its own material made that worse, +20% draw calls. Within one
      // thin slab the parts are at the same depth anyway, so grouping by style
      // there is invisible and lets whole runs collapse into one call.
      let zLo = Infinity, zHi = -Infinity;
      for (let i = 0; i < bucket.length; i++) {
        const z = bucket[i].z; if (z < zLo) zLo = z; if (z > zHi) zHi = z;
      }
      const slab = Math.max(1e-6, (zHi - zLo) / 56);
      for (let i = 0; i < bucket.length; i++) bucket[i].s = ((bucket[i].z - zLo) / slab) | 0;
      bucket.sort((A, B) => (A.s - B.s) || (A.k - B.k));
      let i = 0;
      while (i < bucket.length) {
        const f = bucket[i];
        let end = i + 1;
        while (end < bucket.length) {
          const g = bucket[end];
          if (g.line !== f.line || g.c !== f.c || g.a !== f.a) break;
          if (f.line && g.w !== f.w) break;
          end++;
        }
        ctx.beginPath();
        for (let k = i; k < end; k++) {
          const e = bucket[k], o = e.o, last = o + e.n * 2;
          ctx.moveTo(PTS[o], PTS[o + 1]);
          for (let q = o + 2; q < last; q += 2) ctx.lineTo(PTS[q], PTS[q + 1]);
          if (!e.line) ctx.closePath();
        }
        ctx.globalAlpha = f.a;
        if (f.line) {
          ctx.strokeStyle = f.c;
          ctx.lineWidth = f.w;
          ctx.stroke();
        } else {
          ctx.fillStyle = f.c;
          ctx.fill();
        }
        i = end;
      }
      bucket.length = 0;
      ptsN = 0;                      // the whole frame's points are done with
    }

    // ── the pieces ──────────────────────────────────────────────────────
    // Each is ONE frame, assembled, held. The motor's is the last frame of
    // its old page-long run, so the fit measured for it still holds: camera
    // yaw 16, pitch 14, dolly 30; module scale at MOTOR_K_MAX; the shaft's
    // rotation where the old run left it.
    // ── what runs while the page is SETTLED on a page ───────────────────
    // The one thing here that animates without the scroll driving it, so it
    // is fenced: only while `scrollSnap` says the page is sitting still on a
    // section, only in a held state (the finished pieces, or the finished act
    // two), 20fps on a desktop and 10fps on a phone, never under reduced
    // motion, and stopped dead when the tab is hidden.
    //   motor  — spins its fan (and the rest of the shaft line)
    //   camera — takes a picture: the iris shuts and the rim flashes
    //   arm    — works: the joints sweep and the gripper opens and closes
    //   sensor — reads out: a band sweeps the grid and the picture changes
    let idleT = 0;                         // seconds of idle animation, kept across stops
    let idleOn = false;
    const SHUTTER = 2.6;                   // seconds between pictures
    const SPIN = 2600 * DEG;
    const ROLL = (90 + 250) * DEG;
    let partA = null;                      // per-part alpha while a part materialises
    function drawMotor() {
      setCam(16 * DEG, 14 * DEG, 30);
      const runK = MOTOR_K_MAX;
      const base = chain(motorModule(runK), place(rotZ(ROLL), [0, 0, 0]));
      for (let k = 0; k < MOTOR.length; k++) {
        const part = MOTOR[k];
        const pa = partA ? (partA[part.id] ?? 0) : 1;
        if (pa <= 0.004) continue;
        capId = part.id;
        const T = chain(base, place(rotZ(part.spins ? SPIN + idleT * 150 * DEG : 0), [0, 0, 0]));
        const oc = cam(T.t[0], T.t[1], T.t[2]);
        const screenR = (part.r || 60) * runK * (PERSP / (PERSP - oc[2]));
        const mat = part.mat || MAT.neutral;
        submit(part.solids, T, mat, pa);
        submitLines(part.polys, T, matLine[mat], LOOK.line * pa, LOOK.width);
        // LEVEL OF DETAIL, and not captured for the morph: fine detail
        // arrives with its part's drawing rather than as a strand
        if (screenR > LOD_PX && part.detail && !cap) submitLines(part.detail, T, matLine[mat], LOOK.line * 0.8 * pa, LOOK.width);
      }
      // COPPER: bars in the stator slots, end turns bulging past the r=62 core
      const pc = partA ? (partA.copper ?? 0) : 1;
      if (pc > 0.004) {
        capId = 'copper';
        const T = chain(base, place(rotZ(SPIN + idleT * 150 * DEG), [0, 0, 0]));
        for (let k = 0; k < 9; k++) submit(barSolid((k / 9) * TAU, 46, -52, 52, 7), T, MAT.copper, pc);
        submit(surface([[-76, 42], [-68, 60], [-56, 64], [-45, 50]], 20), T, MAT.copper, pc);
        submit(surface([[45, 50], [56, 64], [68, 60], [76, 42]], 20), T, MAT.copper, pc);
        submitLines([ring(64, -58, 28), ring(64, 58, 28)], T, copper, LOOK.line * pc, LOOK.width);
      }
      flush();     // ONE sorted pass over the whole machine: masses and lines
    }
    function drawCamera() {
      setCam(-26 * DEG, 15 * DEG, -70);
      const T = place(CAM_TURN, [CAM_X, CAM_Y, 0]);
      for (const piece of CAMERA) {
        const pa = partA ? (partA[piece.id] ?? 0) : 1;
        if (pa <= 0.004) continue;
        capId = piece.id;
        submit(piece.solid, T, piece.mat, pa);
        submitLines(piece.wire, T, piece.glass ? ink : matLine[piece.mat], LOOK.line * pa, LOOK.width);
        if (piece.detail && !cap) submitLines(piece.detail, T, matLine[piece.mat], LOOK.line * 0.8 * pa, LOOK.width);
      }
      flush();
      // TAKING PICTURES: the iris shuts and opens over ~0.34s, and the rim
      // flashes with it. Drawn after the flush, on top of the glass, and only
      // while the page is settled — a shutter frozen half-shut looks broken,
      // so it rests fully open.
      if (!idleOn || cap) return;
      const u = idleT % SHUTTER;
      if (u > 0.42) return;
      const k = u / 0.42;
      const shut = Math.sin(Math.PI * k);                  // 0 open -> 1 shut -> 0 open
      // The iris STARTS at the rim and at zero alpha, or it pops on as a dark
      // disc over the glass. It closes to a point and opens again.
      const r = 27 - 23 * shut;
      fill([ring(r, 74.6, 6)], T, LINE, 0.6 * Math.pow(shut, 0.45));   // six blades, near enough
      // and the rim flashes as it fires
      stroke([ring(27.5, 74.2, 24)], T, ink, 0.95 * shut, 1.6);
      stroke([ring(30.5, 73.8, 24)], T, ink, 0.5 * Math.max(0, shut - 0.3), 1.2);
    }
    const art = () => { if (isLeft) drawCamera(); else drawMotor(); };

    // ── act two ─────────────────────────────────────────────────────────
    // Scrolling from Experience to Research (`actT`, 0..1): the camera
    // explodes down to its sensor and the sensor resolves into pixels; the
    // motor becomes the shoulder of a 2R arm. Both then hold.
    function drawCameraAct(t) {
      // the view squares up to the sensor as the camera leaves
      const q = smooth(win(t, 0.16, 0.44));
      setCam(-26 * (1 - q) * DEG, 15 * (1 - q) * DEG, -70 + 70 * q);
      const home = place(CAM_TURN, [CAM_X, CAM_Y, 0]);
      const EX_D = 440;
      // 1 · the camera comes apart along its own optical axis, each piece
      // holding its orientation, and fades as it leaves the stage — soon
      // enough that the shells are gone before the sensor needs the room
      for (const piece of CAMERA) {
        const ex = CAM_EXPLODE[piece.id];
        const mv = smooth(win(t, 0.02 + ex.order * 0.03, 0.30));
        const a = 1 - win(t, 0.10 + ex.order * 0.03, 0.14);
        if (a <= 0.01) continue;
        const T = chain(home, place(IDENT, [0, ex.rise * EX_D * 0.62 * mv, ex.at * EX_D * mv]));
        submit(piece.solid, T, piece.mat, a);
        submitLines(piece.wire, T, piece.glass ? ink : matLine[piece.mat], LOOK.line * a, LOOK.width);
      }
      flush();
      // 2 · the sensor is what is left: it turns from the camera's
      // three-quarter view to face the viewer, comes forward and grows
      const sens = smooth(win(t, 0.14, 0.30));
      if (sens <= 0) return;
      const sc = 1 + (SENSOR_SCALE - 1) * smooth(win(t, 0.2, 0.4));
      const T = place(mul(rotY(74 * (1 - sens) * DEG), scaleM(sc)), [CAM_X * (1 - sens), CAM_Y * (1 - sens), -30 + 46 * sens]);
      // the die, solid, until the photosites take it over
      const dieFade = 1 - win(t, 0.58, 0.22);
      if (dieFade > 0.01) { submit(plate(112, 86, 0, 0, 0), T, MAT.neutral, 0.85 * sens * dieFade); flush(); }
      stroke([rect(112, 86, 0, 0, 0), rect(126, 100, 0, 0, -3)], T, ink, 0.55 * sens, 1);
      stroke(SENSOR_PADS, T, LINE, 0.5 * sens, 1);
      // 3 · pixels: each photosite lights to its own value, so the grid IS
      // an image. Bucketed by brightness so 48 cells cost 4 fills, not 48.
      // Once it is finished, the sensor KEEPS TAKING PICTURES while the page
      // is settled: a readout band sweeps the grid and each sweep leaves a
      // slightly different picture behind.
      const frame = idleOn && t >= 1 ? Math.floor(idleT / SHUTTER) + 1 : 0;
      const buckets = [[], [], [], []];
      for (let i = 0; i < PX_C * PX_R; i++) {
        const a = smooth(win(t, 0.46 + (i / (PX_C * PX_R)) * 0.30, 0.10));
        if (a <= 0.02) continue;
        const [x, y] = pxPos(i);
        const v = pxVal(i, frame) * a;
        const sz = PX * 0.76 * (0.30 + 0.70 * a);
        buckets[clamp(Math.ceil(v * 4) - 1, 0, 3)].push(rect(sz, sz, x * a + x * 0.86 * (1 - a), y * a + y * 0.86 * (1 - a), 1.5));
      }
      for (let b = 0; b < 4; b++) fill(buckets[b], T, ink, 0.12 + 0.72 * ((b + 1) / 4));
      if (frame) {
        const u = (idleT % SHUTTER) / SHUTTER;
        if (u < 0.55) {
          const gh = PX_R * PX, y = -gh / 2 + (u / 0.55) * gh;
          fill([rect(PX_C * PX + 8, 11, 0, y, 2.5)], T, ink, 0.22);
        }
      }
    }

    // ── the arm, one parametric drawing ─────────────────────────────────
    // Every state of the right-hand piece after the motor is this function
    // with different numbers: the 2R planar arm (no yaw, no wrist cluster),
    // the 6-DOF arm (a base that yaws, a third link and two wrist joints),
    // and each half of the bimanual pair. Acts interpolate the PARAMETERS
    // rather than swapping drawings, so consecutive acts meet exactly.
    //
    //   root   where the shoulder sits, in stage units
    //   k      overall scale
    //   yaw    the base joint (about the vertical), which is what makes the
    //          6-DOF arm read as three-dimensional rather than planar
    //   q      shoulder, elbow and wrist pitches, in degrees
    //   roll   wrist roll about the forearm axis
    //   L/grow link lengths and how much of each has grown
    //   motor  the motor still standing in as the shoulder housing
    const ARM_T = { l1: 9, l2: 7 };          // link half-thicknesses
    function armChain(P) {
      const k = P.k;
      const M = mul(rotY(P.yaw * DEG), scaleM(k));
      const B = place(M, [P.root[0], P.root[1], 0]);          // base frame, yawed
      // the pedestal: plinth on the ground, column up to the shoulder. It does
      // not yaw with the arm.
      if (P.base > 0.01) {
        const b = P.base;
        const rMot = 86 * ARM.K * k;
        const top = P.root[1] + rMot, plinthY = P.root[1] + rMot + 46 * k;
        const colH = (plinthY - top) * b;
        const F = place(IDENT, [0, 0, 0]);
        submit(boxFaces(44 * k, colH, 56 * k, P.root[0], top + colH / 2, 0), F, MAT.alu, b * P.alpha);
        submitLines(boxWire(44 * k, colH, 56 * k, P.root[0], top + colH / 2, 0), F, matLine[MAT.alu], LOOK.line * b * P.alpha, LOOK.width);
        const Pl = place(scaleM(k), [P.root[0], plinthY + (10 + 30 * (1 - b)) * k, 0]);
        submit(BASE_PLINTH.solid, Pl, MAT.iron, b * P.alpha);
        submitLines(BASE_PLINTH.wire, Pl, matLine[MAT.iron], LOOK.line * b * P.alpha, LOOK.width);
      }
      // the base joint: a drum on the vertical axis, which appears with the
      // sixth degree of freedom
      if (P.yawJoint > 0.01) {
        const Y = chain(B, place(mul(rotX(90 * DEG), scaleM(P.yawJoint)), [0, 46, 0]));
        submit(ELBOW.solid, Y, MAT.steel, P.alpha);
        submitLines(ELBOW.wire, Y, matLine[MAT.steel], LOOK.line * P.alpha, LOOK.width);
      }
      // the shoulder housing: the motor itself, shrinking as the arm takes over
      if (P.motor > 0.01) {
        const mk = ARM.K * k * P.motorK;
        const S = chain(B, place(mul(rotZ(ROLL), scaleM(mk / k)), [0, 0, 0]));
        for (let i = 0; i < MOTOR.length; i++) {
          const part = MOTOR[i];
          if (part.id === 'prop') continue;
          const mat = part.mat || MAT.neutral;
          submit(part.solids, S, mat, P.motor * P.alpha);
          submitLines(part.polys, S, matLine[mat], LOOK.line * P.motor * P.alpha, LOOK.width);
        }
        submit(surface([[-76, 42], [-68, 60], [-56, 64], [-45, 50]], 20), S, MAT.copper, P.motor * P.alpha);
        submit(surface([[45, 50], [56, 64], [68, 60], [76, 42]], 20), S, MAT.copper, P.motor * P.alpha);
      }
      // link 1 off the output shaft
      const zOff = ARM.Z1 * ARM.K / 0.4;
      const J1 = chain(B, place(rotZ(P.q[0] * DEG), [0, 0, zOff]));
      const g1 = P.grow[0];
      if (g1 > 0.01) {
        const sil = stadium(P.L[0] * g1, ARM.R1);
        submit(extrude(sil, -ARM_T.l1, ARM_T.l1), J1, MAT.paint, P.alpha);
        submitLines(silWire(sil, -ARM_T.l1, ARM_T.l1), J1, matLine[MAT.paint], LOOK.line * P.alpha, LOOK.width);
        submitLines([ring(ARM.R1 * 0.55, ARM_T.l1, 16)], J1, matLine[MAT.steel], LOOK.line * P.alpha, LOOK.width);
      }
      // the elbow, then link 2
      const J2 = chain(J1, place(IDENT, [P.L[0] * g1, 0, 0]));
      if (P.elbow > 0.01) {
        const E = chain(J2, place(scaleM(P.elbow), [0, 0, 6]));
        submit(ELBOW.solid, E, MAT.steel, P.alpha);
        submitLines(ELBOW.wire, E, matLine[MAT.steel], LOOK.line * P.alpha, LOOK.width);
      }
      const g2 = P.grow[1];
      const L2p = chain(J2, place(rotZ(P.q[1] * DEG), [0, 0, 26]));
      if (g2 > 0.01) {
        const sil = stadium(P.L[1] * g2, ARM.R2);
        submit(extrude(sil, -ARM_T.l2, ARM_T.l2), L2p, MAT.paint, P.alpha);
        submitLines(silWire(sil, -ARM_T.l2, ARM_T.l2), L2p, matLine[MAT.paint], LOOK.line * P.alpha, LOOK.width);
      }
      // the wrist cluster: pitch joint, a short third link, then a roll joint.
      // At `wrist` 0 this is the 2R arm's bare wrist; at 1 it is two more axes.
      const W0 = chain(L2p, place(IDENT, [P.L[1] * g2, 0, 0]));
      const g3 = P.grow[2] * P.wrist;
      let flange = W0;
      if (P.wrist > 0.01) {
        const W = chain(W0, place(scaleM(0.8 * P.wrist), [0, 0, 6]));
        submit(ELBOW.solid, W, MAT.steel, P.alpha);
        submitLines(ELBOW.wire, W, matLine[MAT.steel], LOOK.line * P.alpha, LOOK.width);
      }
      if (g3 > 0.01 && P.L[2] > 0.5) {
        const J3 = chain(W0, place(rotZ(P.q[2] * DEG), [0, 0, 18]));
        const sil = stadium(P.L[2] * g3, ARM.R2 * 0.85);
        submit(extrude(sil, -6, 6), J3, MAT.paint, P.alpha);
        submitLines(silWire(sil, -6, 6), J3, matLine[MAT.paint], LOOK.line * P.alpha, LOOK.width);
        flange = chain(J3, place(rotX(P.roll * DEG), [P.L[2] * g3, 0, 0]));
      }
      // the wrist flange and a two-finger gripper close the chain
      if (P.grip > 0.01) {
        const Wr = chain(flange, place(scaleM(P.grip), [0, 0, 0]));
        submit(WRIST.solid, Wr, MAT.steel, P.alpha);
        submitLines(WRIST.wire, Wr, matLine[MAT.steel], LOOK.line * P.alpha, LOOK.width);
        for (const y of [-P.open, P.open]) {
          const f = finger(y);
          submit(f.solid, Wr, MAT.neutral, P.alpha);
          submitLines(f.wire, Wr, matLine[MAT.neutral], LOOK.line * P.alpha, LOOK.width);
        }
      }
    }

    // The three states the arm passes through. Act 1 interpolates 2R -> 6-DOF,
    // act 2 interpolates 6-DOF -> one half of the bimanual pair (and grows the
    // torso and the other arm). Fitted to the 340x660 stage by ink box.
    const P_2R = { root: ARM.SH, k: 1, yaw: 0, q: [ARM.TH1, ARM.TH2, 0], roll: 0,
                   L: [ARM.L1, ARM.L2, 0], grow: [1, 1, 0], elbow: 1, wrist: 0, yawJoint: 0,
                   motor: 1, motorK: 1, base: 1, grip: 1, open: 10, alpha: 1 };
    const P_6D = { root: [-66, 34], k: 0.92, yaw: 34, q: [-64, 62, 34], roll: 22,
                   L: [ARM.L1, ARM.L2 * 0.92, 44], grow: [1, 1, 1], elbow: 1, wrist: 1, yawJoint: 1,
                   motor: 1, motorK: 0.82, base: 1, grip: 1, open: 9, alpha: 1 };
    const P_BI_R = { root: [26, 12], k: 0.56, yaw: 28, q: [-46, 64, 28], roll: 16,
                     L: [ARM.L1, ARM.L2 * 0.92, 44], grow: [1, 1, 1], elbow: 1, wrist: 1, yawJoint: 1,
                     motor: 1, motorK: 0.8, base: 0, grip: 1, open: 9, alpha: 1 };
    const P_BI_L = { root: [-54, 12], k: 0.56, yaw: -40, q: [-118, 52, 22], roll: -14,
                     L: [ARM.L1, ARM.L2 * 0.92, 44], grow: [1, 1, 1], elbow: 1, wrist: 1, yawJoint: 1,
                     motor: 1, motorK: 0.8, base: 0, grip: 1, open: 6, alpha: 1 };
    const lerpP = (A, B, u) => ({
      root: [A.root[0] + (B.root[0] - A.root[0]) * u, A.root[1] + (B.root[1] - A.root[1]) * u],
      k: A.k + (B.k - A.k) * u,
      yaw: A.yaw + (B.yaw - A.yaw) * u,
      q: [0, 1, 2].map(i => A.q[i] + (B.q[i] - A.q[i]) * u),
      roll: A.roll + (B.roll - A.roll) * u,
      L: [0, 1, 2].map(i => A.L[i] + (B.L[i] - A.L[i]) * u),
      grow: [0, 1, 2].map(i => A.grow[i] + (B.grow[i] - A.grow[i]) * u),
      elbow: A.elbow + (B.elbow - A.elbow) * u,
      wrist: A.wrist + (B.wrist - A.wrist) * u,
      yawJoint: A.yawJoint + (B.yawJoint - A.yawJoint) * u,
      motor: A.motor + (B.motor - A.motor) * u,
      motorK: A.motorK + (B.motorK - A.motorK) * u,
      base: A.base + (B.base - A.base) * u,
      grip: A.grip + (B.grip - A.grip) * u,
      open: A.open + (B.open - A.open) * u,
      alpha: A.alpha + (B.alpha - A.alpha) * u,
    });
    // While the page is settled the arm WORKS: the joints sweep and the
    // gripper opens. `ph` offsets the second arm so the pair is not in lockstep.
    const workP = (P, ph = 0) => {
      if (!idleOn) return P;
      const w = Math.sin(idleT * 0.85 + ph), w2 = Math.sin(idleT * 0.85 + ph + 1.1);
      return { ...P, q: [P.q[0] + w * 5, P.q[1] + w2 * 8, P.q[2] + w * 6], open: P.open + 3.5 * w2 };
    };

    // The torso the bimanual pair stands on, with a sensor head — the camera
    // side of the page, in miniature, which is what is looking at the work.
    const TORSO_AT = [-14, 72];
    function drawTorso(u, alpha) {
      if (u <= 0.01) return;
      // A torso narrow enough to read as a body between two arms rather than
      // a slab behind them, with a panel line down it, and a head on a neck
      // carrying two lenses — the camera side of the page in miniature, which
      // is what is looking at the work.
      const sil = [[-42, -40], [-28, -52], [28, -52], [42, -40], [36, 52], [-36, 52]];
      const T = place(scaleM(u), [TORSO_AT[0], TORSO_AT[1], -10]);
      submit(extrude(sil, -22, 22), T, MAT.paint, alpha);
      submitLines(silWire(sil, -22, 22, 2), T, matLine[MAT.paint], LOOK.line * alpha, LOOK.width);
      submitLines([[[-30, -16, 22], [30, -16, 22]], [[0, -16, 22], [0, 40, 22]]], T, matLine[MAT.paint], LOOK.line * 0.8 * alpha, LOOK.width);
      // neck and head
      const N = chain(T, place(IDENT, [0, -62, 0]));
      submit(boxFaces(20, 22, 20, 0, 0, 0), N, MAT.steel, alpha);
      submitLines(boxWire(20, 22, 20, 0, 0, 0), N, matLine[MAT.steel], LOOK.line * alpha, LOOK.width);
      const H = chain(T, place(IDENT, [0, -88, 2]));
      submit(boxFaces(62, 32, 36, 0, 0, 0), H, MAT.poly, alpha);
      submitLines(boxWire(62, 32, 36, 0, 0, 0), H, matLine[MAT.poly], LOOK.line * alpha, LOOK.width);
      for (const x of [-15, 15]) {
        submitLines([ringAt(8, x, 0, 19, 16), ringAt(11, x, 0, 18.4, 16)], H, ink, LOOK.line * alpha, LOOK.width);
      }
      // shoulder mounts, where the two arms meet the body
      for (const x of [-38, 38]) {
        const S = chain(T, place(mul(rotY(90 * DEG), scaleM(0.7)), [x, -34, 0]));
        submit(ELBOW.solid, S, MAT.steel, alpha);
        submitLines(ELBOW.wire, S, matLine[MAT.steel], LOOK.line * alpha, LOOK.width);
      }
      // the pedestal it stands on
      const Pl = place(scaleM(0.8), [TORSO_AT[0], TORSO_AT[1] + 96, 0]);
      submit(BASE_PLINTH.solid, Pl, MAT.iron, alpha);
      submitLines(BASE_PLINTH.wire, Pl, matLine[MAT.iron], LOOK.line * alpha, LOOK.width);
      const colH = 44;
      submit(boxFaces(42, colH, 52, TORSO_AT[0], TORSO_AT[1] + 74, 0), place(IDENT, [0, 0, 0]), MAT.alu, alpha);
      submitLines(boxWire(42, colH, 52, TORSO_AT[0], TORSO_AT[1] + 74, 0), place(IDENT, [0, 0, 0]), matLine[MAT.alu], LOOK.line * alpha, LOOK.width);
    }

    // ── the targets the waves fly to ────────────────────────────────────
    // The strands themselves are drawn by WaveField.jsx, from the big hero
    // field straight to their lines — it is the one canvas that spans both
    // the field and the stages. What this piece supplies is WHERE they land:
    // its finished frame, CAPTURED once (`cap`: submitLines records projected
    // polylines, tagged with their part, instead of drawing), filtered to the
    // lines long enough to be worth a strand, and ranked by part, top to
    // bottom. Published to the shared module; rebuilt on a theme change,
    // which recolours the lines.
    //
    // Alphas are multiplied by the host's own opacity: the strands are drawn
    // on a canvas without it, and have to land looking exactly like the lines
    // that replace them.
    const toRGB = c => (c.startsWith('#') ? hexToRgb(c) : hexToRgb(rgbStrToHex(c)));
    function publish() {
      cap = [];
      const spun = idleT; idleT = 0;        // capture the piece at rest
      art();
      idleT = spun;
      const recs = [];
      for (const r of cap) {
        const n = r.pts.length / 2;
        let L = 0, sx = 0, sy = 0, x0 = Infinity, x1 = -Infinity;
        for (let i = 0; i < n; i++) {
          const x = r.pts[i * 2], y = r.pts[i * 2 + 1];
          sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (i) L += Math.hypot(x - r.pts[i * 2 - 2], y - r.pts[i * 2 - 1]);
        }
        // short lines arrive with their part's drawing instead
        if (L < 18) continue;
        recs.push({ pts: r.pts, id: r.id, rgb: toRGB(r.c), a: r.a * hostA, w: r.w, cx: sx / n, cy: sy / n, bw: Math.max(6, x1 - x0) });
      }
      cap = null;
      const parts = new Map();
      for (const r of recs) { const P = parts.get(r.id) || { sy: 0, n: 0 }; P.sy += r.cy; P.n++; parts.set(r.id, P); }
      const order = [...parts.keys()].sort((a, b) => parts.get(a).sy / parts.get(a).n - parts.get(b).sy / parts.get(b).n);
      morph = { order };
      canvas.dataset.morph = String(recs.length);
      publishTargets(isLeft ? 'left' : 'right', { recs, order });
    }

    // While the morph runs, each part's real drawing — fills, hidden lines
    // removed — fades in as its own strands land, on the same schedule the
    // field uses to move them.
    function prelude(s) {
      if (!morph) publish();
      const m = win(s, S_MORPH[0], S_MORPH[1]);
      const n = morph.order.length;
      const pa = {};
      let any = false;
      morph.order.forEach((id, r) => { const v = partArtA(partT(m, r, n)); pa[id] = v; if (v > 0.004) any = true; });
      if (any) { partA = pa; art(); partA = null; }
    }

    // ── act 1: the motor becomes a 2R arm ───────────────────────────────
    function drawMotorAct(t) {
      const a = smooth(win(t, 0.0, 0.36));            // the motor turns and settles
      setCam(16 * DEG, (14 - 4 * a) * DEG, 30 * (1 - a));
      // Up to `a` the motor is still a motor, swinging its axis round to point
      // at the viewer — the joint axis of a planar arm — and shrinking into
      // the shoulder. After that the parametric arm takes over, which is what
      // makes this act meet the next one exactly.
      if (a < 1) {
        const k = MOTOR_K_MAX + (ARM.K - MOTOR_K_MAX) * a;
        const tilt = mul(rotX(66 * (1 - a) * DEG), rotY(30 * (1 - a) * DEG));
        const pos = [ARM.SH[0] * a, 10 + (ARM.SH[1] - 10) * a, 0];
        const base = chain(place(IDENT, pos), place(mul(tilt, scaleM(k)), [0, 0, 0]));
        const roll = chain(base, place(rotZ(ROLL * (1 - a)), [0, 0, 0]));
        const propA = 1 - win(t, 0.03, 0.18);        // the propeller goes; the shaft stays
        for (let i = 0; i < MOTOR.length; i++) {
          const part = MOTOR[i];
          const pa = part.id === 'prop' ? propA : 1;
          if (pa <= 0.01) continue;
          const T = chain(roll, place(rotZ(part.spins ? SPIN : 0), [0, 0, 0]));
          const mat = part.mat || MAT.neutral;
          submit(part.solids, T, mat, pa);
          submitLines(part.polys, T, matLine[mat], LOOK.line * pa, LOOK.width);
        }
        const C = chain(roll, place(rotZ(SPIN), [0, 0, 0]));
        submit(surface([[-76, 42], [-68, 60], [-56, 64], [-45, 50]], 20), C, MAT.copper, 1);
        submit(surface([[45, 50], [56, 64], [68, 60], [76, 42]], 20), C, MAT.copper, 1);
      }
      // the arm grows out of it: base, link 1 swinging down from vertical,
      // the elbow, link 2, then the gripper
      const P = { ...P_2R,
        base: smooth(win(t, 0.24, 0.26)),
        motor: a,
        q: [-90 + (ARM.TH1 + 90) * smooth(win(t, 0.32, 0.45)), ARM.TH2 * smooth(win(t, 0.56, 0.40)), 0],
        grow: [smooth(win(t, 0.32, 0.26)), smooth(win(t, 0.56, 0.26)), 0],
        elbow: smooth(win(t, 0.52, 0.14)),
        grip: smooth(win(t, 0.78, 0.16)),
        open: 5 + 5 * smooth(win(t, 0.88, 0.12)),
      };
      armChain(t >= 1 ? workP(P_2R) : P);
      flush();
    }

    // ── act 2: the 2R arm becomes a 6-DOF arm ───────────────────────────
    // The base gains a joint it can yaw on, the wrist gains two more, and the
    // whole thing turns out of the plane — which is the difference between a
    // 2R drawing and a six-axis one.
    function drawArm6Act(t) {
      const u = smooth(t);
      setCam((16 + 6 * u) * DEG, (10 + 4 * u) * DEG, 0);
      const P = lerpP(P_2R, P_6D, u);
      // the third link and the wrist joints arrive over the second half
      P.wrist = smooth(win(t, 0.34, 0.4));
      P.grow[2] = smooth(win(t, 0.46, 0.4));
      P.yawJoint = smooth(win(t, 0.2, 0.3));
      armChain(t >= 1 ? workP(P_6D) : P);
      flush();
    }

    // ── act 3: the 6-DOF arm becomes a bimanual robot ───────────────────
    // A torso rises under it with a sensor head, the arm moves onto the right
    // shoulder, and a second arm grows on the left. They work out of phase.
    function drawBimanualAct(t) {
      const u = smooth(t);
      setCam((22 - 2 * u) * DEG, (14 - 2 * u) * DEG, 0);
      const torso = smooth(win(t, 0.12, 0.36));
      drawTorso(torso, 1);
      const R = lerpP(P_6D, P_BI_R, u);
      armChain(t >= 1 ? workP(P_BI_R) : R);
      const grow = smooth(win(t, 0.42, 0.45));
      if (grow > 0.01) {
        const L = { ...(t >= 1 ? workP(P_BI_L, 2.2) : P_BI_L) };
        L.k = P_BI_L.k * grow;
        L.alpha = grow;
        L.grow = [grow, grow, grow];
        L.grip = grow;
        armChain(L);
      }
      flush();
    }

    // The HELD states, where scrolling redraws nothing: the finished pieces
    // (after the morph, before the first act) and the end of each act. Mid-act
    // is not held — that is the animation.
    const held = y => {
      if (reduce || heroPhase(y) < S_ART) return null;
      const { i, t } = actAt(y);
      return i < 0 ? 'pieces' : t >= 1 ? `act${i}` : null;
    };
    function draw(y = window.scrollY) {
      ctx.setTransform(dpr * fit, 0, 0, dpr * fit, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      segs = 0;
      const s = reduce ? Infinity : heroPhase(y);
      if (s < S_ART) prelude(s);
      else if (reduce) art();
      else {
        const { i, t } = actAt(y);
        if (i < 0) art();
        else if (isLeft) {
          // the camera has one act — it explodes down to its sensor, and the
          // sensor holds, taking pictures, through the acts that follow
          drawCameraAct(i === 0 ? t : 1);
        } else if (i === 0) drawMotorAct(t);
        else if (i === 1) drawArm6Act(t);
        else drawBimanualAct(t);
      }
      ctx.globalAlpha = 1;
      // A debug read-out, and a DOM write: skipped while the settled loop is
      // running so "hold still and count mutations" still measures the page
      // rather than this attribute.
      if (!idleOn) canvas.dataset.segs = String(segs);
    }

    // ── scroll driver ───────────────────────────────────────────────────
    // Shared listener and rAF (src/scrollDriver.js). Past the morph the
    // piece is one fixed frame, so scrolling there redraws NOTHING — only the
    // first frame past the line does, to land exactly on the finished piece.
    let stopScroll = null;
    let trailing = 0;
    publish();                             // the field needs the targets before the morph starts
    if (reduce) {
      draw();                              // the finished piece, no morph
    } else {
      // ADAPTIVE RATE: time each draw and back off when it is expensive.
      let MIN_MS = 32;
      let lastDraw = -1e9, pendingY = 0;
      const paint = yy => {
        lastY = yy;
        const t0 = performance.now();
        draw(yy);
        MIN_MS = clamp((performance.now() - t0) * 8, 32, 120);
        lastDraw = performance.now();
      };
      stopScroll = onPageScroll(y => {
        if (lastY >= 0 && (Math.abs(y - lastY) < 0.5 || (held(y) && held(y) === held(lastY)))) return;
        pendingY = y;
        if (performance.now() - lastDraw >= MIN_MS) {
          if (trailing) { cancelAnimationFrame(trailing); trailing = 0; }
          paint(y);
        } else if (!trailing) {
          const again = () => {
            if (performance.now() - lastDraw >= MIN_MS) { trailing = 0; paint(pendingY); }
            else trailing = requestAnimationFrame(again);
          };
          trailing = requestAnimationFrame(again);
        }
      });
    }

    // ── the settled loop ────────────────────────────────────────────────
    // Runs only while the page is sitting still on a section AND this piece is
    // in a held state; 20fps desktop, 10fps phone; rAF stops it dead when the
    // tab is hidden, and it is never started under reduced motion.
    const IDLE_MS = window.innerWidth < 992 ? 100 : 50;
    let idleRAF = 0, idleTimer = 0, idlePrev = 0;
    const idleStep = () => {
      idleRAF = 0;
      if (!idleOn) return;
      const now = performance.now();
      const dt = idlePrev ? Math.min(0.25, (now - idlePrev) / 1000) : 0;
      idlePrev = now;
      idleT += dt;
      if (held(lastY)) draw(lastY);
      idleSchedule();
    };
    const idleSchedule = () => {
      idleTimer = setTimeout(() => { idleRAF = requestAnimationFrame(idleStep); }, IDLE_MS);
    };
    const stopIdle = () => {
      idleOn = false; idlePrev = 0;
      if (idleRAF) { cancelAnimationFrame(idleRAF); idleRAF = 0; }
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
    };
    const stopSettle = reduce ? null : onSettle(on => {
      if (on === idleOn) return;
      if (on) {
        if (!held(lastY)) return;           // mid-morph or mid-act: nothing to idle
        idleOn = true; idlePrev = 0; idleSchedule();
      } else {
        stopIdle();
        // back to the piece's resting frame, so a half-shut shutter or a
        // mid-sweep readout does not freeze on screen
        if (lastY >= 0) draw(lastY);
      }
    });

    return () => {
      stopScroll?.();
      stopSettle?.();
      stopIdle();
      if (trailing) cancelAnimationFrame(trailing);
      sizeRO?.disconnect();
      themeWatch.disconnect();
    };
  }, [isLeft]);

  return (
    <div className={`f3d f3d--${side}`} ref={hostRef} aria-hidden="true">
      <canvas />
    </div>
  );
}
