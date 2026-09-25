import React, { useEffect, useRef } from 'react';
import { onScroll as onPageScroll } from '../scrollDriver';
import { heroPhase, S_MORPH, S_ART, partT, partArtA, publishTargets, actAt } from '../waveField';
import { onSettle } from '../scrollSnap';
import { loadRobots, standing, facing, bodyPlacements, axisM } from '../robots/index.js';

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
  // 3D-printed PLA: the SO-ARM101's shell. WHITE, unlike every other
  // material here — a pale off-page body rather than a page-coloured one —
  // because the arm did not read as the robot when its printed parts came out
  // the same near-black as everything else on the dark theme.
  pla: 7,
  urblue: 8,          // the UR5e's joint caps
  ochre: 9,           // Generalist's yellow 3D-printed gripper fingers
  orange: 10,         // Ultra's gripper tips and logo
  red: 11, green: 12, blue: 13,   // the cubes the robots handle
};
// hex per slot; `copper` and `paint` are filled in from theme tokens
const MAT_HEX = ['', '', '#8FA6B8', '#7A6A55', '#C9CED4', '#3C4046', '#8A7F6B', '#EEEAE2', '#7DADCC', '#D9B23F', '#E8792A', '#C9473F', '#4E9A5C', '#3F6FB8'];
// Weight is inversely related to how much of the frame the part covers. A tint
// worth 0.3 on the shaft is invisible; the same 0.3 on the housing turns the
// assembled machine into a coloured blob and throws away the line art. So the
// big masses stay near the page colour and the small parts carry the colour —
// and most of the separation is done by the LINEWORK, which costs no area.
const MAT_W   = [0, 0.46, 0.26, 0.30, 0.22, 0.42, 0.13, 0.78, 0.55, 0.62, 0.62, 0.72, 0.72, 0.72];
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

// ── the RealSense D435i, DRAWN (after drum/silWire: it uses them at module scope) ──────────────────────────────────────────
// From Intel's dimensional drawing: a 90 x 25 x 25 mm bar whose front profile
// is a stadium (fully rounded ends), an aluminium body, a dark front plate
// carrying four apertures left to right — IR imager, IR projector, IR imager
// (the 50 mm stereo baseline), RGB — and inside, the stereo module board
// with its three barrels and the main PCB behind it. Units are mm, +z out of
// the front. It replaced Intel's CAD mesh: that export is open B-rep patches
// (see "Baked meshes"), and after two rounds of orienting, sealing and
// budgeting it still read as "a little broken". Big clean shapes read as a
// sim render; the owner asked for exactly that ("larger shapes like
// cylinders"). The module is the part that COMES OUT and becomes the pixel
// array (drawCameraAct), so it is its own part with its own frame.
const D435_W = 90, D435_H = 25, D435_D = 25;
const d435Sil = (L, r, n) => stadium(L, r, n).map(([x, y]) => [x - L / 2, y]);
const D435_BODY_SIL = d435Sil(D435_W - D435_H, D435_H / 2, 12);
const D435_PLATE_SIL = d435Sil(D435_W - D435_H - 2, D435_H / 2 - 1, 12);
const D435_APERTURES = [[-32, 5.5], [-11, 4.5], [18, 5.5], [36, 6.2]];   // x, radius: IR-L, projector, IR-R, RGB
const D435_RGB_X = 36;
const D435 = [
  // id, material, solid faces, wire polylines, explode station (mm along +z), explode order
  { id: 'body', mat: MAT.alu, solid: extrude(D435_BODY_SIL, -D435_D / 2, 9), wire: silWire(D435_BODY_SIL, -D435_D / 2, 9, 6), out: -16, order: 3 },
  { id: 'plate', mat: MAT.poly, solid: extrude(D435_PLATE_SIL, 9, 12.5), wire: [...silWire(D435_PLATE_SIL, 9, 12.5, 99), ...D435_APERTURES.map(([x, r]) => ringAt(r + 1.2, x, 0, 12.6, 20))], out: 32, order: 1 },
  ...D435_APERTURES.map(([x, r], i) => ({ id: `lens${i}`, mat: MAT.poly, glass: true,
    solid: [...surface([[12.6, r], [15, r]], 16).map(f => ({ v: f.v.map(([px, py, pz]) => [px + x, py, pz]), n: f.n })), ...disc(0, r, 15, 16).map(f => ({ v: f.v.map(([px, py, pz]) => [px + x, py, pz]), n: f.n }))],
    wire: [ringAt(r, x, 0, 15.05, 20), ringAt(r * 0.55, x, 0, 15.1, 14)], out: 48, order: 0 })),
  { id: 'module', mat: MAT.steel, solid: [...boxFaces(84, 20, 6, 0, 0, 4), ...[-32, 18, 36].flatMap(x => drum(3.6, 7, 8.8).map(f => ({ v: f.v.map(([px, py, pz]) => [px + x, py, pz]), n: f.n })))],
    wire: [...boxWire(84, 20, 6, 0, 0, 4), ...[-32, 18, 36].map(x => ringAt(3.6, x, 0, 8.9, 14))], out: 14, order: 2 },
  { id: 'pcb', mat: MAT.iron, solid: boxFaces(82, 20, 2, 0, -1, -2), wire: boxWire(82, 20, 2, 0, -1, -2), out: -30, order: 3 },
];
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
    // gold is the optical path and the picture; slate is compute (the model's
    // layers); rust is a result the model is less sure of
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
      // Pulled a little toward the accent. Dead-neutral grey linework on a page
      // built out of warm off-white, warm near-black and gold read as foreign.
      {
        const l = hexToRgb(LINE), a2 = hexToRgb(ink), w = 0.18;
        LINE = `rgb(${Math.round(l[0] + (a2[0] - l[0]) * w)},${Math.round(l[1] + (a2[1] - l[1]) * w)},${Math.round(l[2] + (a2[2] - l[2]) * w)})`;
      }
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
      const key = q * 16 + mat;
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
      const tint = matRGB[mat], w = Math.min(1, MAT_W[mat] * (dark ? 1 : 1.55));
      if (tint && w) {
        r = Math.round(r + (tint[0] - r) * w);
        g = Math.round(g + (tint[1] - g) * w);
        b2 = Math.round(b2 + (tint[2] - b2) * w);
      }
      c = `rgb(${r},${g},${b2})`;
      toneCache.set(key, c);
      return c;
    };
    // The same ramp at four times the resolution and TWICE the range, for the
    // smooth-shaded meshes: 14 steps band visibly across a curved surface; 56
    // do not. And a sim render carries its form in the SHADING, not in lines
    // — at the line art's ±0.20 the bodies were flat and the outline had to
    // do everything, ragged where it hugged the facets. At ±0.42 the turn of
    // a tube reads on its own and the lines can fade back.
    const MESH_STEPS = 56;
    const MESH_RANGE = 0.30;
    // BANDED shading. A flat-filled triangle is one tone, so on a 56-step ramp
    // every neighbouring pair of facets differs a little and a curved surface
    // reads as a mosaic — "I can still see the little triangles". With the
    // lighting quantised to a few bands, whole regions of a surface share one
    // tone, the triangle edges inside a band vanish, and what remains is a
    // few contour bands following the light: the look of a cel-shaded sim
    // render. `?bands=N` overrides for comparison (0 = the full ramp).
    const MESH_BANDS = typeof location !== 'undefined' && new URLSearchParams(location.search).has('bands') ? +new URLSearchParams(location.search).get('bands') : 6;
    const bandLit = lit => (MESH_BANDS > 1 ? Math.round(lit * (MESH_BANDS - 1)) / (MESH_BANDS - 1) : lit);
    const meshToneCache = new Map();
    const PLA_LIGHT = [227, 222, 213];
    const meshTone = (lit, mat) => {
      const q = Math.max(0, Math.min(MESH_STEPS, Math.round(lit * MESH_STEPS)));
      const key = q * 16 + mat;
      let c = meshToneCache.get(key);
      if (c) return c;
      const lift = dark ? 0.19 : -0.08;
      // tint FIRST, then shade the tinted body — a white robot goes from
      // white to grey in the shadow, not from page colour toward white.
      // On the light theme white PLA lit full-on came out AT the page colour
      // (tint #EEEAE2 pushed toward WARM_HI), so the lit side of the SO-ARM
      // and the Franka vanished and only their shadow bands and lines were
      // left — a hollow, wireframe look. A slightly greyer white keeps the
      // body a body: ~9 levels under the page at its brightest.
      const tint = !dark && mat === MAT.pla ? PLA_LIGHT : matRGB[mat], w = Math.min(1, MAT_W[mat] * (dark ? 1 : 1.55));
      let r = paperRGB[0], g = paperRGB[1], b2 = paperRGB[2];
      if (tint && w) { r = r + (tint[0] - r) * w; g = g + (tint[1] - g) * w; b2 = b2 + (tint[2] - b2) * w; }
      const k = (q / MESH_STEPS - 0.5) * 2 * MESH_RANGE + lift * 0.5;
      const rr = Math.max(0, Math.min(255, Math.round(r + ((k >= 0 ? WARM_HI : WARM_LO)[0] - r) * Math.abs(k))));
      const gg = Math.max(0, Math.min(255, Math.round(g + ((k >= 0 ? WARM_HI : WARM_LO)[1] - g) * Math.abs(k))));
      const bb = Math.max(0, Math.min(255, Math.round(b2 + ((k >= 0 ? WARM_HI : WARM_LO)[2] - b2) * Math.abs(k))));
      c = `rgb(${rr},${gg},${bb})`;
      meshToneCache.set(key, c);
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
      meshToneCache.clear();
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
    // ZOOM scales everything on BOTH stages about the stage centre — the
    // robots, the camera, the sensor, the stacks, the props, the captions'
    // anchors — in one place. 0.85 at the owner's request ("15% smaller"),
    // which is also 28% fewer pixels to fill per frame. Every ink box in
    // this file's history was measured at 1.0; multiply.
    const ZOOM = 0.85;
    const setCam = (yaw, pitch, dolly) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
      cam = (x, y, z) => {
        const X = x * cy + z * sy, Z0 = -x * sy + z * cy;
        const Y = y * cx - Z0 * sx, Z = y * sx + Z0 * cx + dolly;
        const k = PERSP / (PERSP - Z) * ZOOM;
        _c[0] = CX + X * k; _c[1] = CY + Y * k; _c[2] = Z;
        return _c;
      };
    };

    // ── drawing ─────────────────────────────────────────────────────────
    // One beginPath/stroke per style group, so the draw-call count stays in the
    // dozens no matter how many segments there are.
    let segs = 0;
    let calls = 0;                 // fill/stroke calls this frame (the draw-call count)
    // ?perf writes each frame's cost to the canvas dataset — draw ms, draw
    // calls, segments — for the profiling harness. A DOM write per frame, so
    // dev only: with it on, "hold still and count mutations" measures this.
    const PERF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');
    const EXACT = typeof location !== 'undefined' && new URLSearchParams(location.search).has('exact');   // dev: exact-depth sort, no slabs
    let flushMs = 0;
    // ?idledt=16 advances the settled animation by a FIXED step per drawn frame
    // instead of wall-clock time, so a harness that only manages 5fps still
    // sees consecutive frames 16ms of motion apart (the pop detector needs
    // motion that takes several frames to cross a pixel).
    const IDLE_DT = typeof location !== 'undefined' && new URLSearchParams(location.search).has('idledt') ? +new URLSearchParams(location.search).get('idledt') / 1000 : 0;
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
      const tf = PERF ? performance.now() : 0;
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
      if (EXACT) bucket.sort((A, B) => (A.z - B.z) || (A.k - B.k));
      else bucket.sort((A, B) => (A.s - B.s) || (A.k - B.k));
      let i = 0;
      while (i < bucket.length) {
        const f = bucket[i];
        let end = i + 1;
        while (end < bucket.length) {
          const g = bucket[end];
          if (g.line !== f.line || g.c !== f.c || g.a !== f.a || g.m !== f.m) break;
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
        calls++;
        if (f.line) {
          ctx.strokeStyle = f.c;
          ctx.lineWidth = f.w;
          ctx.stroke();
        } else {
          ctx.fillStyle = f.c;
          ctx.fill();
          // Mesh fills are SEALED: the same path stroked thinly in its own
          // colour. Adjacent triangles of different tones land in different
          // fill calls, and where two anti-aliased edges meet the page shows
          // through as a hairline — on the dark theme, a pale robot came out
          // wearing its whole wireframe in dark lines. The stroke covers the
          // seam; on a silhouette it adds a third of a pixel nobody can see.
          // (`m` is set per fill in submitMesh: dark theme, or a dark material
          // on the light one — the light theme's black joint rings and servos
          // showed every seam as a pale hairline, "each individual triangle".)
          if (f.m) { ctx.strokeStyle = f.c; ctx.lineWidth = 0.7; ctx.stroke(); }
        }
        i = end;
      }
      bucket.length = 0;
      ptsN = 0;                      // the whole frame's points are done with
      if (PERF) flushMs += performance.now() - tf;
    }

    // ── the pieces ──────────────────────────────────────────────────────
    // Each is ONE frame, assembled, held. The motor's is the last frame of
    // its old page-long run, so the fit measured for it still holds: camera
    // yaw 16, pitch 14, dolly 30; module scale at MOTOR_K_MAX; the shaft's
    // rotation where the old run left it.
    // ── baked meshes: the real machines ─────────────────────────────────
    // The robots and the camera are decimated meshes from their MuJoCo
    // Menagerie models (see scripts/bake-robots.mjs), drawn as this renderer
    // draws everything else: front faces as page-coloured occluders, and lines
    // on top. The lines are the mesh's FEATURE EDGES (baked) plus its
    // SILHOUETTE, which is view-dependent and found here per frame: an edge
    // whose two faces face opposite ways. That is what makes a smooth tube or
    // casing read as a drawn outline rather than a shaded blob.
    //   part  a prepared part from src/robots (shared vertices, faces, edges)
    //   T     its placement (from bodyPlacements)
    //   mat   MAT slot;  a  alpha;  lineCol  line colour
    let MESH_SCR = new Float64Array(1 << 12);       // projected vertices, x y z per vertex
    let MESH_FRONT = new Uint8Array(1 << 10);       // culling: by screen winding
    let MESH_FACE = new Float32Array(1 << 10);      // silhouette: by SMOOTH normal, toward the viewer
    // Which screen winding is a FRONT face. The bake orients every shell
    // outward — the normal from (b-a)x(c-a) points away from the body — and
    // the stage frame keeps that handedness (every placement is a proper
    // rotation), so a face toward the viewer projects with POSITIVE signed
    // area under the formula below. This was `true` for two releases, on the
    // reasoning that a y-down stage is left-handed: it culled every front face
    // and drew every back one. On closed tubes that is nearly invisible — you
    // see the inside of the far wall through the same silhouette — which is
    // why the arms looked "fine" while the SO-ARM's servos showed through its
    // arm and the camera's front plate was missing. Checked by counting: 573
    // of the plate's 900 faces had smooth normals toward the viewer; 41 of
    // those passed the old test.
    const MESH_FLIP = false;
    const MESH_MIN_AREA = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noskip') ? 0 : 1.3;
    const SIL_EPS = typeof location !== 'undefined' && new URLSearchParams(location.search).has('sileps') ? +new URLSearchParams(location.search).get('sileps') : 0;
    const NOLINES = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nolines');
    // BAND HYSTERESIS. A triangle's tone is its lighting quantised to a band,
    // and as the arm turns, a triangle whose lighting sits near a band
    // boundary hops between two greys from frame to frame. Measured at a
    // 16ms step (`?perf` → dataset.flips): 4-16 faces a frame flipped on the
    // settled SO-ARM and Franka, halved with hysteresis — a small sparkle,
    // not the glitch, but free to remove. Each face keeps its band until its
    // lighting has crossed the boundary by HYST of a band; ?hyst=N overrides
    // (0 = off).
    const HYST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('hyst') ? +new URLSearchParams(location.search).get('hyst') : 0.2;
    let flips = 0;                 // faces that changed band this frame (dev read-out)
    function submitMesh(part, T, mat, a, lineCol, lineA) {
      if (a <= 0.004) return;
      const m = T.m, t = T.t;
      const nv = part.nv, nf = part.nf, v = part.v, f = part.f, vn = part.vn;
      const bands = part.bands || (part.bands = new Uint8Array(nf).fill(255));   // last frame's band per face
      if (MESH_SCR.length < nv * 3) MESH_SCR = new Float64Array(nv * 3 * 2);
      if (MESH_FRONT.length < nf) { MESH_FRONT = new Uint8Array(nf * 2); MESH_FACE = new Float32Array(nf * 2); }
      // project every vertex once
      let cxs = 0, cys = 0, rmax = 0;
      for (let i = 0; i < nv; i++) {
        const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
        const sc = cam(m[0] * x + m[1] * y + m[2] * z + t[0], m[3] * x + m[4] * y + m[5] * z + t[1], m[6] * x + m[7] * y + m[8] * z + t[2]);
        MESH_SCR[i * 3] = sc[0]; MESH_SCR[i * 3 + 1] = sc[1]; MESH_SCR[i * 3 + 2] = sc[2];
      }
      // off-stage parts cost nothing
      for (let i = 0; i < nv; i++) { cxs += MESH_SCR[i * 3]; cys += MESH_SCR[i * 3 + 1]; }
      cxs /= nv; cys /= nv;
      for (let i = 0; i < nv; i++) { const d = Math.abs(MESH_SCR[i * 3] - cxs) + Math.abs(MESH_SCR[i * 3 + 1] - cys); if (d > rmax) rmax = d; }
      if (cxs + rmax < 0 || cxs - rmax > W || cys + rmax < 0 || cys - rmax > H) return;
      // faces: cull by screen winding, light by rotated normal, bucket as fills
      // (in capture mode only the facing is computed, for the lines below)
      for (let i = 0; i < nf; i++) {
        const ia = f[i * 3], ib = f[i * 3 + 1], ic = f[i * 3 + 2];
        const ax = MESH_SCR[ia * 3], ay = MESH_SCR[ia * 3 + 1], bx = MESH_SCR[ib * 3], by = MESH_SCR[ib * 3 + 1], cx = MESH_SCR[ic * 3], cy = MESH_SCR[ic * 3 + 1];
        let area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
        if (MESH_FLIP) area = -area;
        const front = area > 0;
        MESH_FRONT[i] = front ? 1 : 0;
        // a triangle under two thirds of a pixel is not drawn: at 0.2-0.33
        // px/mm a third of a decimated arm's faces are that small, each one a
        // bucket entry, a sort key and a path segment for nothing visible
        // (its neighbours' seals cover the hole). It stays FRONT for the
        // lines below: this used to clear MESH_FRONT for a skipped face, so
        // every crease and silhouette edge beside one blinked out and back as
        // the arm moved and the face crossed the size threshold — half of the
        // one-frame pops on the settled SO-ARM (3330 → 1682 per 90 frames,
        // measured with the size test off). The silhouette test needs the
        // face's facing, not whether it was worth filling.
        if (front && area < MESH_MIN_AREA) continue;
        // SMOOTH shading: the mean of the three vertex normals, not the face's
        // own — adjacent facets then shade continuously and the surface reads
        // as curved. (Per-face normals are what made it look like a mesh.)
        const nx0 = (vn[ia * 3] + vn[ib * 3] + vn[ic * 3]) / 3, ny0 = (vn[ia * 3 + 1] + vn[ib * 3 + 1] + vn[ic * 3 + 1]) / 3, nz0 = (vn[ia * 3 + 2] + vn[ib * 3 + 2] + vn[ic * 3 + 2]) / 3;
        const nx = m[0] * nx0 + m[1] * ny0 + m[2] * nz0, ny = m[3] * nx0 + m[4] * ny0 + m[5] * nz0, nz = m[6] * nx0 + m[7] * ny0 + m[8] * nz0;
        // The silhouette is found from this SMOOTH normal's z, not from the
        // winding: on a decimated curve the winding flips at every wobble and
        // draws a hundred false outline fragments; the smooth normal's sign
        // field changes once, at the real edge of the body.
        MESH_FACE[i] = nz;
        if (!front || cap) continue;
        const nl = Math.hypot(nx, ny, nz) || 1;
        const inx = nx / nl, iny = ny / nl, inz = nz / nl;
        const key = inx * KEY[0] + iny * KEY[1] + inz * KEY[2];
        const grazing = 1 - Math.abs(inz);
        let lit = 0.5 + 0.40 * key + 0.15 * -iny + 0.16 * grazing * grazing;
        lit = lit < 0 ? 0 : lit > 1 ? 1 : lit;
        ptsRoom(6);
        const o = ptsN;
        PTS[o] = ax; PTS[o + 1] = ay; PTS[o + 2] = bx; PTS[o + 3] = by; PTS[o + 4] = cx; PTS[o + 5] = cy;
        ptsN += 6;
        // Black trim (a band, a ring, a cap) sits ON a white body, flush with
        // it, and within one depth slab the two sort by style — so the white
        // shell won half the band's triangles and the band came out as a row
        // of teeth. The trim gets a small bias toward the viewer.
        // (Franka only: on the SO-ARM the black parts are SERVOS inside white
        // printed holders, and the bias pushed them through their housings —
        // the "glitching textures" the owner saw as the arm moved.)
        const zc = (MESH_SCR[ia * 3 + 2] + MESH_SCR[ib * 3 + 2] + MESH_SCR[ic * 3 + 2]) / 3 + (mat === MAT.poly && part.rid === 'fr3' && part.body === 'link0' ? 1.4 : 0);
        let band = lit;
        if (MESH_BANDS > 1) {
          const q = lit * (MESH_BANDS - 1), prev = bands[i];
          let bi = Math.round(q);
          if (prev !== 255 && Math.abs(q - prev) < 0.5 + HYST) bi = prev;
          if (prev !== 255 && bi !== prev) flips++;
          bands[i] = bi;
          band = bi / (MESH_BANDS - 1);
        }
        const col = meshTone(band, mat);
        // sealed (flush) where the seam would show: every fill on the dark
        // theme, the dark materials on the light one. Sealing everything on
        // the light theme doubled p90 (17 → 33ms) for seams no one can see.
        // (and on the dark theme the DARK materials go unsealed in turn: a
        // hairline of near-black page inside a dark-grey servo is invisible,
        // and the seal stroke is a second rasterisation of every fill)
        const darkMat = mat === MAT.poly || mat === MAT.iron || mat === MAT.steel;
        bucket.push({ o, n: 3, z: zc, a: a * LOOK.surface, c: col, k: styleId(0, col, 0), m: dark !== darkMat ? 1 : 0 });
        segs += 3;
      }
      // lines: the SILHOUETTE, and CREASES (real edges of the CAD, dihedral over
      // 62°) faintly. Nothing along facets: that is what a sim render does —
      // smooth surfaces, an outline, the odd hard edge — and drawing every
      // decimation edge is what made these look like meshes.
      const e = part.e, crease = part.crease, ne = e.length / 4;
      // On the dark theme the line is pale on near-black and a dense set of
      // them reads as a wireframe; the meshes take a lighter hand there.
      const la = (lineA == null ? LOOK.line : lineA) * a * (dark ? 0.5 : 0.7);
      if (la <= 0.004 || NOLINES) return;
      const laF = la * 0.3;
      const MIN_PX2 = 16;                                // edges under 4px on screen are noise (was 3px; at ZOOM 0.85 the same edge is 15% shorter)
      for (let i = 0; i < ne; i++) {
        const fa = e[i * 4 + 2], fb = e[i * 4 + 3];
        const fra = MESH_FRONT[fa], frb = fb < 0 ? 0 : MESH_FRONT[fb];
        if (!fra && !frb) continue;                      // wholly on the far side
        // A silhouette edge has to pass BOTH tests: one face toward the viewer
        // and one away by the smooth normal (the real edge of the body), AND
        // by the screen winding (a face actually culled on the far side). The
        // smooth test alone drew every dimple of a decimated printed part —
        // a screw boss, a slot's floor — as a starburst of little outline
        // fragments inside the surface: the "glitching textures". The
        // winding alone hops at every wobble of a curve. Where they agree is
        // the outline.
        const za = MESH_FACE[fa], zb = fb < 0 ? 0 : MESH_FACE[fb];
        const silhouette = fb < 0 ? (fra === 1 && !part.patches) : fra !== frb && (za > SIL_EPS ? zb < -SIL_EPS : za < -SIL_EPS && zb > SIL_EPS);
        if (!silhouette && !crease[i]) continue;
        const ia = e[i * 4], ib = e[i * 4 + 1];
        const dx = MESH_SCR[ia * 3] - MESH_SCR[ib * 3], dy = MESH_SCR[ia * 3 + 1] - MESH_SCR[ib * 3 + 1];
        if (dx * dx + dy * dy < MIN_PX2) continue;
        const alpha = silhouette ? la : laF;
        if (cap) {                            // the morph's targets: mesh lines too
          cap.push({ pts: new Float64Array([MESH_SCR[ia * 3], MESH_SCR[ia * 3 + 1], MESH_SCR[ib * 3], MESH_SCR[ib * 3 + 1]]), c: lineCol, a: alpha, w: LOOK.width, id: capId });
          continue;
        }
        ptsRoom(4);
        const o = ptsN;
        PTS[o] = MESH_SCR[ia * 3]; PTS[o + 1] = MESH_SCR[ia * 3 + 1]; PTS[o + 2] = MESH_SCR[ib * 3]; PTS[o + 3] = MESH_SCR[ib * 3 + 1];
        ptsN += 4;
        const z = (MESH_SCR[ia * 3 + 2] + MESH_SCR[ib * 3 + 2]) / 2 + LINE_BIAS;
        bucket.push({ line: 1, o, n: 2, z, a: alpha, c: lineCol, w: LOOK.width, k: styleId(1, lineCol, LOOK.width) });
        segs += 1;
      }
    }
    // material names from the menagerie -> this renderer's slots
    const MESH_MAT = { white: MAT.pla, black: MAT.poly, gray: MAT.steel, jointgray: MAT.steel, linkgray: MAT.alu, urblue: MAT.urblue, green: MAT.steel };
    // Draw a whole robot at joint angles q (radians), with an optional
    // per-body alpha (for parts arriving or leaving) and a global alpha.
    // A robot's parts never FADE: a half-transparent mesh shows its own far
    // side and whatever stands behind it, and a body fading in before its
    // neighbour read as parts floating loose — the "disappearing parts /
    // discontinuities" the owner saw in every act. Arriving and leaving are
    // SCALE instead: `grow` (0..1 per body) scales a body about its own joint,
    // and a body's scale carries into its children's placements, so a chain
    // grows out of its base still connected, and every part is opaque.
    // `alpha` below 1 shrinks the whole robot into its base the same way.
    const scaleT = (T, s) => place(T.m.map(x => x * s), T.t);
    const scaleAbout = (T, s, p) => place(T.m.map(x => x * s), [p[0] + (T.t[0] - p[0]) * s, p[1] + (T.t[1] - p[1]) * s, p[2] + (T.t[2] - p[2]) * s]);
    function growPlacements(robot, base, q, grow) {
      if (!grow) return bodyPlacements(robot, base, q);
      const out = new Array(robot.bodies.length);
      let qi = 0;
      for (let i = 0; i < robot.bodies.length; i++) {
        const b = robot.bodies[i];
        const parent = b.parent == null ? base : out[robot.index.get(b.parent)];
        let T = chain(parent, place(b.m, b.pos));
        if (b.axis) {
          const a = q[qi++] || 0;
          T = b.slide ? chain(T, place(IDENT, [b.axis[0] * a * 1000, b.axis[1] * a * 1000, b.axis[2] * a * 1000])) : chain(T, place(axisM(b.axis, a), [0, 0, 0]));
        }
        const g = grow[b.name];
        out[i] = g == null || g >= 1 ? T : scaleT(T, Math.max(0, g));
      }
      return out;
    }
    const growScale = (T, base) => detScale(T.m) / (detScale(base.m) || 1);
    function drawRobot(robot, base, q, alpha, grow) {
      if (!robot) return;
      if (alpha <= 0.03) return;
      const B = alpha < 1 ? scaleT(base, alpha) : base;
      const T = growPlacements(robot, B, q, grow);
      for (const part of robot.parts) {
        const bi = robot.index.get(part.body);
        if (growScale(T[bi], B) < 0.04) continue;          // not arrived yet (or gone)
        const mat = MESH_MAT[part.mat] ?? MAT.neutral;
        submitMesh(part, T[bi], mat, 1, matLine[mat]);
      }
    }

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
    let ROBOTS = null;                     // the baked machines, once loaded
    loadRobots().then(r => { ROBOTS = r; if (lastY >= 0) draw(lastY); }).catch(() => {});
    let idleT = 0;                         // seconds of idle animation, from the settle
    let idleOn = false;
    let settleU = 0;                       // the settle blend: 1 live, 0 at rest (see the settled loop)
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
    // The camera on the stage: faces into the page (its front is +z, turned
    // toward the page's centre), three-quarter view, mm to px by CAM2.k.
    // `t` > 0 explodes it (see drawCameraAct); returns the module's frame
    // for the hand-over to the sensor.
    const CAM2 = { k: 2.55, x: -14, y: -10, yaw: 34, pitch: 8 };
    const CAM2_EX = 1.0;                                    // explode stations are in mm, scaled by k
    function drawD435(alpha, t) {
      // at rest this piece sets its own view (the acts set theirs): the hero's
      // capture pass draws it before anything else has, and cam() was null
      if (t <= 0 && (!DEV || !cam)) setCam(26 * DEG, 15 * DEG, -70);   // (?dev=<robot> on the right leaves the left with no view at all)
      // as it opens the assembly drifts toward the outer edge, where the
      // stage overhangs the screen, so the fan of parts stays on the stage
      const drift = t > 0 ? -20 * smooth(win(t, 0.03, 0.42)) : 0;     // the lenses fan toward the INNER edge (+x); the assembly drifts out
      const home = place(mul(mul(rotY(CAM2.yaw * DEG), rotX(-CAM2.pitch * DEG)), scaleM(CAM2.k)), [CAM2.x + drift, CAM2.y, 0]);
      let moduleT = null;
      for (const part of D435) {
        const pa = partA ? (partA[part.id] ?? 0) : 1;
        const mv = t > 0 ? smooth(win(t, 0.03 + part.order * 0.03, 0.42)) : 0;
        const isModule = part.id === 'module';
        const a = alpha * pa * (t > 0 ? 1 - smooth(isModule ? win(t, 0.78, 0.12) : win(t, 0.44 + part.order * 0.02, 0.18)) : 1);
        let T = chain(home, place(IDENT, [0, 0, part.out * CAM2_EX * mv]));
        if (isModule && t > 0) {
          // THE SENSOR COMES OUT. Once the view is apart the module leaves its
          // station: it travels to the centre of the stage, turning to face
          // the viewer and shrinking to the die's size, its front face
          // landing on the die plane (z 16), and the drawn package forms
          // around it while its photosites light as it fades
          const s = smooth(win(t, 0.46, 0.3));
          const kB = 2.0;
          const TB = { m: scaleM(kB), t: [0, 0, 16 - 7 * kB] };
          if (s > 0) T = lerpT(T, TB, s, CAM2.k, kB);
          moduleT = { T, c: [0, 0, 7] };                      // the front face's centre, in the module's frame
        }
        if (a <= 0.004) continue;
        capId = part.id;
        submit(part.solid, T, part.mat, a);
        submitLines(part.wire, T, part.glass ? ink : matLine[part.mat], LOOK.line * a, LOOK.width);
      }
      flush();
      // TAKING PICTURES: the RGB aperture's iris shuts and opens over ~0.34s
      // and its rim flashes. Drawn after the flush, on top; only while the
      // page is settled — a shutter frozen half-shut looks broken.
      if (!idleOn || cap || t > 0) return moduleT;
      const u = idleT % SHUTTER;
      if (u > 0.42) return moduleT;
      const kf = u / 0.42, shut = Math.sin(Math.PI * kf);
      const L = chain(home, place(IDENT, [D435_RGB_X, 0, 0]));
      fill([ring(6 - 5 * shut, 15.2, 6)], L, LINE, 0.6 * Math.pow(shut, 0.45));
      stroke([ring(7.2, 15.25, 24)], L, ink, 0.95 * shut, 1.6);
      stroke([ring(9, 15.3, 24)], L, ink, 0.5 * Math.max(0, shut - 0.3), 1.2);
      return moduleT;
    }
    // Dev hook (kept — it has paid for itself three times): ?dev=<robot>:q1,q2,..;k;yaw;x;y
    // shows one baked machine at that pose on the right, the camera on the left.
    const DEV = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('dev') : null;
    // ?part=0,5 draws only those camera parts (with ?dev), to see which is which
    const DEV_PARTS = DEV && new URLSearchParams(location.search).get('part') ? new Set(new URLSearchParams(location.search).get('part').split(',').map(Number)) : null;
    const art = () => {
      if (DEV && ROBOTS) {
        const [spec, k = '0.6', yaw = '30', x = '0', y = '260', tilt = '0'] = DEV.split(';');
        const [id, qs = ''] = spec.split(':');
        setCam(20 * DEG, 12 * DEG, 0);
        // on the left, ?dev=d435i;k;yaw;pitch overrides the camera's framing
        if (isLeft && id === 'd435i' && DEV.includes(';')) { CAM2.k = +k; CAM2.yaw = +yaw; CAM2.pitch = +x; }
        if (isLeft) drawD435(1, 0);
        else if (id === 'ultra' && ROBOTS.ultra) {
          drawCart(1, 1);
          const base = standing([+x, +y], +k, +yaw), qq = qs.split(',').filter(Boolean).map(Number);
          const TU = drawUltraRobot(base, qq, RB.ul.unit.R[0], RB.ul.unit.L[0], 1);
          drawUnitProps(TU, unitTaskState(TU, 0), 1);
        } else if (id === 'ur5e' && +tilt === 180 && ROBOTS.ur5e) {
          drawFrame(1, 1);
          const base = leaning([+x, +y, MOUNT_Z], +k, +yaw), qq = qs.split(',').filter(Boolean).map(Number);
          drawUR(base, qq.length ? qq : RB.ur.restR, 1);
          const st = taskState(ROBOTS.ur5e, base, RB.ur.taskR, 0); drawCubes(st, 1); drawPackBox(base, 1);
        } else if (ROBOTS[id]) {
          const base = shouldered([+x, +y], +k, +yaw, +tilt), qq = qs.split(',').filter(Boolean).map(Number);
          const task = id === 'soarm' ? RB.so.task : id === 'fr3' ? RB.fr.task : null;
          drawRobot(ROBOTS[id], base, qq.length ? qq : task ? task.W[0] : [], 1);
          if (task) drawCubes(taskState(ROBOTS[id], base, task, 0), 1);
        }
        flush();
        return;
      }
      if (isLeft) drawD435(1, 0); else drawMotor();
    };

    // ── act two ─────────────────────────────────────────────────────────
    // Scrolling from Experience to Research (`actT`, 0..1): the camera
    // explodes down to its sensor and the sensor resolves into pixels; the
    // motor becomes the shoulder of a 2R arm. Both then hold.
    function drawCameraAct(t) {
      // the view holds its three-quarter angle while the camera comes apart
      // (an exploded view needs the angle to read), then squares up to the
      // sensor once the parts have gone
      const q = smooth(win(t, 0.44, 0.3));
      // ...pulling back a little as it opens (dolly -70 -> -115), so the fan
      // of parts stays on the stage. The view's yaw has the SAME sign as the
      // camera's own (CAM2.yaw): with opposite signs they cancelled and the
      // parts slid straight at the viewer, foreshortened to nothing.
      const e = smooth(win(t, 0.03, 0.42));
      setCam(26 * (1 - q) * DEG, 15 * (1 - q) * DEG, (-70 - 45 * e) * (1 - q));
      // 1 · the camera comes apart along its own optical axis, each piece
      // holding its orientation, to its own station (see drawD435)
      const board = drawD435(1, Math.max(0.001, t));
      // 2 · the sensor is the module that came out of the camera: the drawn
      // package forms AROUND it, in ITS frame — unflipped (facing() turned
      // it a half turn about z, and the die must end at SENSOR_HOME's
      // identity for the next act to start where this one ends), at the
      // die's own scale, its plane on the module's front face
      const sens = smooth(win(t, 0.56, 0.24));
      if (sens <= 0 || !board) return;
      // the die's frame is the module's — at the die's scale, its plane on the
      // module's front face — and at t = 1 it is exactly SENSOR_HOME
      const k = detScale(board.T.m) || 1;
      const Rm = board.T.m.map(x => x / k);
      const T = place(Rm.map(x => x * SENSOR_SCALE), tpOf(board.T, board.c));
      stroke([rect(112, 86, 0, 0, 0), rect(126, 100, 0, 0, -3)], T, ink, 0.55 * sens, 1);
      stroke(SENSOR_PADS, T, LINE, 0.5 * sens, 1);
      // 3 · pixels: each photosite lights to its own value, so the grid IS
      // an image. Bucketed by brightness so 48 cells cost 4 fills, not 48.
      // Once it is finished, the sensor KEEPS TAKING PICTURES while the page
      // is settled: a readout band sweeps the grid and each sweep leaves a
      // slightly different picture behind.
      const frame = idleOn && t >= 1 ? Math.floor(idleT / SHUTTER) + 1 : 0;
      const buckets = [[], [], [], []];
      // the photosites sit a little in front of the module while it is still
      // there (a depth slab clear of its front face), and settle onto the die
      // plane as it goes, so the next act's z 1.5 is where they end
      const pz = 1.5 + 2.5 * (1 - smooth(win(t, 0.86, 0.12)));
      for (let i = 0; i < PX_C * PX_R; i++) {
        const a = smooth(win(t, 0.66 + (i / (PX_C * PX_R)) * 0.24, 0.10));
        if (a <= 0.02) continue;
        const [x, y] = pxPos(i);
        const v = pxVal(i, frame) * a;
        const sz = PX * 0.76 * (0.30 + 0.70 * a);
        buckets[clamp(Math.ceil(v * 4) - 1, 0, 3)].push(rect(sz, sz, x * a + x * 0.86 * (1 - a), y * a + y * 0.86 * (1 - a), pz));
      }
      for (let b = 0; b < 4; b++) fill(buckets[b], T, pxColor(b), 0.12 + 0.72 * ((b + 1) / 4));
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
    // ── three robots, one chain ─────────────────────────────────────────
    // The kinematics are the same throughout — base yaw, shoulder, elbow,
    // wrist pitch, wrist roll — and what changes between acts is the SKIN
    // over it, crossfaded while the pose interpolates. That is what lets one
    // machine become another without the chain jumping.
    //
    //   soarm  the SO-ARM101: a small printed arm, visible servos with horn
    //          discs, flat printed brackets, a little two-finger gripper
    //   fr3    a Franka Research 3: pale rounded tube links, a dark band at
    //          every joint, a long parallel-finger hand
    //   ur     a Universal Robots arm: constant-diameter tubes and short
    //          cylindrical joint housings, the wrist a compact cluster
    const tubeX = (L, r, segs = 14) => ({
      solid: [...surface([[0, r], [L, r]], segs), ...disc(0, r, L, segs), ...disc(0, r, 0, segs)],
      wire: [ring(r, 0, 16), ring(r, L, 16), [[r, 0, 0], [r, 0, L]], [[-r, 0, 0], [-r, 0, L]]],
    });
    const ALONG_X = rotY(90 * DEG);
    function drawTube(F, L, r, mat, a, lineCol) {
      if (L < 1) return;
      const T = chain(F, place(ALONG_X, [0, 0, 0]));
      const g = tubeX(L, r);
      submit(g.solid, T, mat, a);
      submitLines(g.wire, T, lineCol || matLine[mat], LOOK.line * a, LOOK.width);
    }
    function drawDrum(F, r, z0, z1, mat, a, ringCol) {
      submit(drum(r, z0, z1), F, mat, a);
      submitLines(drumWire(r, z0, z1), F, ringCol || matLine[mat], LOOK.line * a, LOOK.width);
    }
    // a servo: the SO-ARM101's signature part, a block with a horn disc
    function drawServo(F, a, s = 1) {
      const S = chain(F, place(scaleM(s), [0, 0, 0]));
      submit(boxFaces(34, 22, 20, 4, 0, 0), S, MAT.poly, a);
      submitLines(boxWire(34, 22, 20, 4, 0, 0), S, matLine[MAT.poly], LOOK.line * a, LOOK.width);
      submitLines([ring(7, 10.5, 14), ring(3, 10.8, 10)], S, matLine[MAT.alu], LOOK.line * a, LOOK.width);
    }
    function skinSoarm(F, P, a) {
      if (a <= 0.01) return;
      // The SO-ARM101 is SHORT and CHUNKY: the servos dominate it. Its
      // signature is the upper arm — two printed plates either side of the
      // elbow servo — and a boxy printed forearm with the wrist servo in its
      // end. Proportions from the real thing, roughly: links barely longer
      // than three servos.
      drawServo(F.J1, a, 1.3);                          // shoulder servo, horn to the viewer
      const L1 = P.L[0] * P.grow[0];
      if (L1 > 2) {
        const sil = stadium(L1, 15);
        for (const z of [-17, 17]) {
          const Pz = chain(F.J1, place(IDENT, [0, 0, z]));
          submit(extrude(sil, -3.5, 3.5), Pz, MAT.pla, a);
          submitLines(silWire(sil, -3.5, 3.5, 6), Pz, matLine[MAT.pla], LOOK.line * a, LOOK.width);
          submitLines([rect(L1 * 0.42, 7, L1 * 0.55, 0, z > 0 ? 3.9 : -3.9)], Pz, matLine[MAT.pla], LOOK.line * 0.7 * a, LOOK.width);
        }
        // the cross-tie that holds the two plates apart
        submit(boxFaces(16, 24, 30, L1 * 0.5, 0, 0), F.J1, MAT.pla, a);
        submitLines(boxWire(16, 24, 30, L1 * 0.5, 0, 0), F.J1, matLine[MAT.pla], LOOK.line * a, LOOK.width);
      }
      if (P.elbow > 0.01) drawServo(F.J2, a, 1.15);      // elbow servo, between the plates
      const L2 = P.L[1] * P.grow[1];
      if (L2 > 2) {
        // the forearm: one printed housing, boxy with rounded ends
        const sil = stadium(L2, 13);
        submit(extrude(sil, -11, 11), F.L2p, MAT.pla, a);
        submitLines(silWire(sil, -11, 11, 5), F.L2p, matLine[MAT.pla], LOOK.line * a, LOOK.width);
        submitLines([rect(L2 * 0.45, 9, L2 * 0.45, 0, 11.4)], F.L2p, matLine[MAT.pla], LOOK.line * 0.7 * a, LOOK.width);
      }
      // wrist servo in the forearm's end, driving the gripper
      drawServo(F.W0, a, 1.0);
    }
    function skinFR3(F, P, a) {
      if (a <= 0.01) return;
      // pale rounded links, a dark band at each joint
      drawDrum(F.J1, 19, -15, 15, MAT.neutral, a);
      submitLines([ring(19.4, 7, 20), ring(19.4, -7, 20)], F.J1, matLine[MAT.poly], LOOK.line * a, LOOK.width);
      drawTube(F.J1, P.L[0] * P.grow[0], 15, MAT.neutral, a);
      if (P.elbow > 0.01) {
        drawDrum(F.J2, 17, -14, 14, MAT.neutral, a);
        submitLines([ring(17.4, 6, 20), ring(17.4, -6, 20)], F.J2, matLine[MAT.poly], LOOK.line * a, LOOK.width);
      }
      drawTube(F.L2p, P.L[1] * P.grow[1], 12.5, MAT.neutral, a);
      if (P.wrist > 0.01) {
        drawDrum(F.W0, 13, -11, 11, MAT.neutral, a * P.wrist);
        submitLines([ring(13.4, 5, 16)], F.W0, matLine[MAT.poly], LOOK.line * a * P.wrist, LOOK.width);
        drawTube(F.J3, P.L[2] * P.grow[2], 10.5, MAT.neutral, a * P.wrist);
      }
    }
    function skinUR(F, P, a) {
      if (a <= 0.01) return;
      // constant-diameter tubes, short cylindrical joints with caps
      drawDrum(F.J1, 16, -16, 16, MAT.steel, a);
      drawTube(F.J1, P.L[0] * P.grow[0], 12.5, MAT.alu, a);
      if (P.elbow > 0.01) drawDrum(F.J2, 14, -14, 14, MAT.steel, a);
      drawTube(F.L2p, P.L[1] * P.grow[1], 11, MAT.alu, a);
      if (P.wrist > 0.01) {
        drawDrum(F.W0, 11.5, -12, 12, MAT.steel, a * P.wrist);
        drawTube(F.J3, P.L[2] * P.grow[2], 9.5, MAT.alu, a * P.wrist);
        const R = chain(F.flange, place(ALONG_X, [0, 0, 0]));
        drawDrum(R, 9.5, -8, 8, MAT.steel, a * P.wrist);
      }
    }
    const SKIN = { soarm: skinSoarm, fr3: skinFR3, ur: skinUR };
    // The base under each: the SO-ARM101 bolts to a flat plate through its
    // base servo; the Franka stands on a round pedestal; a UR in the bimanual
    // pair is mounted on the stand (drawStand), so its own base is empty.
    function drawBase(style, P, a) {
      if (a <= 0.01) return;
      const k = P.k;
      const rMot = 86 * ARM.K * k;
      const groundY = P.root[1] + rMot + 56 * k;
      if (style === 'soarm') {
        // a round base plate, the base servo standing in a printed housing on
        // it, and the shoulder close above — the whole base is about two
        // servos tall
        const gY = P.root[1] + 64 * k;
        const Pl = place(mul(rotX(90 * DEG), scaleM(k)), [P.root[0], gY, 0]);
        drawDrum(Pl, 44, -3, 3, MAT.pla, a);
        const H = place(scaleM(k), [P.root[0], gY - 20 * k, 0]);
        submit(boxFaces(40, 34, 40, 0, 0, 0), H, MAT.pla, a);
        submitLines(boxWire(40, 34, 40, 0, 0, 0), H, matLine[MAT.pla], LOOK.line * a, LOOK.width);
        const Sv = place(mul(rotX(90 * DEG), scaleM(k * 1.1)), [P.root[0], gY - 40 * k, 0]);
        drawServo(Sv, a);                              // base servo, horn up
      } else if (style === 'fr3') {
        // round pedestal, the Franka's own shape, with a foot ring
        const h = (groundY - P.root[1]) / k;
        const Pd = place(mul(rotX(90 * DEG), scaleM(k)), [P.root[0], P.root[1] + h / 2 * k, 0]);
        drawDrum(Pd, 24, -h / 2, h / 2, MAT.neutral, a);
        submitLines([ring(24.4, -h / 2 + 8, 24), ring(24.4, h / 2 - 8, 24)], Pd, matLine[MAT.poly], LOOK.line * a, LOOK.width);
        const Ft = place(mul(rotX(90 * DEG), scaleM(k)), [P.root[0], groundY - 3 * k, 0]);
        drawDrum(Ft, 34, -3, 3, MAT.steel, a);
      }
    }

    const ARM_T = { l1: 9, l2: 7 };          // link half-thicknesses
    function armChain(P) {
      const k = P.k;
      const M = mul(rotY(P.yaw * DEG), scaleM(k));
      const B = place(M, [P.root[0], P.root[1], 0]);          // base frame, yawed
      // Each robot stands on its own kind of base, which does not yaw with
      // the arm, and crossfades with the skin.
      const blendB = P.blend || 0;
      if (P.base > 0.01) {
        drawBase(P.style, P, P.base * P.alpha * (1 - blendB));
        if (P.style2 && blendB > 0.001) drawBase(P.style2, P, P.base * P.alpha * blendB);
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
      // the chain: shoulder, elbow, wrist pitch, wrist roll
      const zOff = ARM.Z1 * ARM.K / 0.4;
      const J1 = chain(B, place(rotZ(P.q[0] * DEG), [0, 0, zOff]));
      const J2 = chain(J1, place(IDENT, [P.L[0] * P.grow[0], 0, 0]));
      const L2p = chain(J2, place(rotZ(P.q[1] * DEG), [0, 0, 26 * (P.style === 'soarm' ? 1 : 0.4)]));
      const W0 = chain(L2p, place(IDENT, [P.L[1] * P.grow[1], 0, 0]));
      const J3 = chain(W0, place(rotZ(P.q[2] * DEG), [0, 0, 18 * (P.style === 'soarm' ? 1 : 0.4)]));
      const flange = P.wrist > 0.01 && P.L[2] > 0.5
        ? chain(J3, place(rotX(P.roll * DEG), [P.L[2] * P.grow[2], 0, 0]))
        : W0;
      const F = { B, J1, J2, L2p, W0, J3, flange };
      // the skin, or two of them crossfading while one robot becomes another
      const blend = P.blend || 0;
      const skinA = P.skinA == null ? 1 : P.skinA;
      SKIN[P.style](F, P, P.alpha * (1 - blend) * skinA);
      if (P.style2 && blend > 0.001) SKIN[P.style2](F, P, P.alpha * blend);
      // the wrist flange and a two-finger gripper close the chain
      if (P.grip > 0.01) {
        const Wr = chain(F.flange, place(scaleM(P.grip), [0, 0, 0]));
        submit(WRIST.solid, Wr, MAT.steel, P.alpha);
        submitLines(WRIST.wire, Wr, matLine[MAT.steel], LOOK.line * P.alpha, LOOK.width);
        const long = P.style2 === 'fr3' ? (P.blend || 0) : P.style === 'fr3' ? 1 - (P.blend || 0) : 0;
        const chunky = P.style === 'soarm' ? 1 - (P.blend || 0) : 0;
        // Franka fingers are long and thin; the SO-ARM101's jaws are short and boxy
        const fl = 26 + 16 * long - 4 * chunky, ft = 6 - 2.5 * long + 4 * chunky;
        const jawMat = chunky > 0.5 ? MAT.pla : MAT.neutral;
        for (const y of [-P.open, P.open]) {
          submit(boxFaces(fl, ft, 12, fl / 2, y, 4), Wr, jawMat, P.alpha);
          submitLines(boxWire(fl, ft, 12, fl / 2, y, 4), Wr, matLine[jawMat], LOOK.line * P.alpha, LOOK.width);
        }
      }
    }

    // The three states the arm passes through. Act 1 interpolates 2R -> 6-DOF,
    // act 2 interpolates 6-DOF -> one half of the bimanual pair (and grows the
    // torso and the other arm). Fitted to the 340x660 stage by ink box.
    const P_2R = { style: 'soarm', root: [-70, 30], k: 1, yaw: 0, q: [-56, 92, 0], roll: 0,
                   L: [98, 84, 0], grow: [1, 1, 0], elbow: 1, wrist: 0, yawJoint: 0,
                   motor: 0, motorK: 0.3, base: 1, grip: 1, open: 10, alpha: 1, skinA: 1 };
    const P_6D = { style: 'fr3', root: [-66, 34], k: 0.92, yaw: 34, q: [-64, 62, 34], roll: 22,
                   L: [ARM.L1, ARM.L2 * 0.92, 44], grow: [1, 1, 1], elbow: 1, wrist: 1, yawJoint: 1,
                   motor: 0, motorK: 0.82, base: 1, grip: 1, open: 9, alpha: 1 };
    // The pair, Generalist-style: two UR arms side by side on a stand, both
    // turned toward the viewer and reaching down to the work in front.
    const P_BI_R = { style: 'ur', root: [34, -8], k: 0.56, yaw: 24, q: [-62, 112, 34], roll: 18,
                     L: [ARM.L1, ARM.L2 * 0.92, 44], grow: [1, 1, 1], elbow: 1, wrist: 1, yawJoint: 1,
                     motor: 0, motorK: 0.8, base: 0, grip: 1, open: 8, alpha: 1 };
    const P_BI_L = { style: 'ur', root: [-62, -8], k: 0.56, yaw: -24, q: [-118, 112, 34], roll: -18,
                     L: [ARM.L1, ARM.L2 * 0.92, 44], grow: [1, 1, 1], elbow: 1, wrist: 1, yawJoint: 1,
                     motor: 0, motorK: 0.8, base: 0, grip: 1, open: 8, alpha: 1 };
    const lerpP = (A, B, u) => ({
      style: A.style, style2: B.style, blend: 0,
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
      skinA: 1,
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
    // The stand the pair is mounted on, Generalist-style: a column up to a
    // beam, a UR base at each end of the beam, a camera bar above looking down
    // at a work surface in front. No torso, no head — a workcell, not a
    // humanoid.
    // ── the Generalist workcell ─────────────────────────────────────────
    // Generalist's demos (generalistai.com, GEN-0/GEN-1): two UR e-series
    // arms HANGING from a frame over a dark table, black wrists, yellow
    // 3D-printed parallel fingers, packing things into boxes. So: two posts,
    // a crossbar, the UR bases bolted to its underside, a table below.
    const STAND_X = 12, FRAME_X = 0, BAR_Y = -104, UR_DX = 82, UR_K = 0.22, POST_X = 124;
    const MOUNT_Z = -46, LEAN = 28, TABLE_Y = 80;                    // the arms hang from a bar set back, leaning in
    function drawFrame(u, alpha) {
      if (u <= 0.01 || alpha <= 0.01) return;
      const F = place(IDENT, [0, 0, 0]);
      const a = alpha;
      // it grows and shrinks as ONE piece about the table's centre: each box
      // scaled about its own centre made the frame fall apart into floating
      // bars mid-act
      const ax = FRAME_X, ay = TABLE_Y, az = 18;
      const box = (w, h, d, x, y, z, mat) => {
        const X = ax + (x - ax) * u, Y = ay + (y - ay) * u, Z = az + (z - az) * u;
        submit(boxFaces(w * u, h * u, d * u, X, Y, Z), F, mat, a);
        submitLines(boxWire(w * u, h * u, d * u, X, Y, Z), F, matLine[mat], LOOK.line * a, LOOK.width);
      };
      // a heavy black frame: posts up from the table's back corners, the
      // crossbar, a canted mount block under it for each arm
      box(14, TABLE_Y - BAR_Y + 10, 14, FRAME_X - POST_X, (TABLE_Y + BAR_Y) / 2, MOUNT_Z, MAT.poly);
      box(14, TABLE_Y - BAR_Y + 10, 14, FRAME_X + POST_X, (TABLE_Y + BAR_Y) / 2, MOUNT_Z, MAT.poly);
      box(2 * POST_X + 14, 14, 14, FRAME_X, BAR_Y, MOUNT_Z, MAT.poly);
      for (const x of [FRAME_X - UR_DX, FRAME_X + UR_DX]) {
        const M = place(mul(rotX(LEAN * DEG), scaleM(u)), [ax + (x - ax) * u, ay + (BAR_Y + 8 - ay) * u, az + (MOUNT_Z - az) * u]);
        submit(boxFaces(36, 10, 36, 0, 3, 0), M, MAT.poly, a);
        submitLines(boxWire(36, 10, 36, 0, 3, 0), M, matLine[MAT.poly], LOOK.line * a, LOOK.width);
      }
      // the table: a dark top on a black frame, its back edge under the bar.
      // Narrower than the frame: its near edge grows ~15% in perspective.
      // ONE slab. It was a dark top over a slightly larger steel slab whose
      // top face sat half a millimetre below the dark top's underside: the
      // two big faces sorted by centroid depth traded places as the camera
      // moved, and the table flickered grey / pale blue through the act.
      box(2 * POST_X - 24, 11, 150, FRAME_X, TABLE_Y + 5.5, 18, MAT.poly);
    }
    const drawStand = (u, alpha) => drawFrame(u, alpha);   // the procedural fallback still calls it by this name
    // The UR's gripper is Generalist's: a black body on the flange, two long
    // yellow printed fingers. In the wrist_3 frame the flange is 100 mm along
    // y and the tool axis is +y (the MJCF's attachment_site); the tool point
    // is 130 beyond the flange, between the fingertips. `gap` in mm.
    function drawURGripper(Tw, gap, a) {
      if (a <= 0.01) return;
      const G = chain(Tw, place(rotX(-90 * DEG), [0, 100, 0]));           // local z along the tool axis
      drawDrum(G, 34, 0, 46, MAT.poly, a);
      submit(boxFaces(100, 34, 14, 0, 0, 53), G, MAT.poly, a);
      submitLines(boxWire(100, 34, 14, 0, 0, 53), G, matLine[MAT.poly], LOOK.line * a, LOOK.width);
      // the wrist camera on the body's side, looking down the fingers
      submit(boxFaces(26, 20, 30, 0, 32, 40), G, MAT.poly, a);
      submitLines(boxWire(26, 20, 30, 0, 32, 40), G, matLine[MAT.poly], LOOK.line * a, LOOK.width);
      submitLines([ringAt(5, 0, 32, 55.5, 12)], G, ink, LOOK.line * a, LOOK.width);
      // the fingers: long, wide, yellow — the printed ones in every Generalist clip
      for (const sg of [-1, 1]) {
        const x = sg * (gap / 2 + 8);
        submit(boxFaces(14, 26, 82, x, 0, 101), G, MAT.ochre, a);
        submitLines(boxWire(14, 26, 82, x, 0, 101), G, matLine[MAT.ochre], LOOK.line * a, LOOK.width);
      }
    }
    // An arm hanging from the frame's bar and LEANING in toward the viewer
    // (Generalist's come down over the table at an angle): standing, turned
    // over (a half turn about the stage's z; the yaw is measured after the
    // turn), then tilted about the stage's x. The root has a z.
    const leaning = (root, k, yaw, lean = LEAN) => { const B = standing(root, k, yaw); return place(mul(rotX(lean * DEG), mul(rotZ(Math.PI), B.m)), [root[0], root[1], root[2] || 0]); };
    const hanging = (root, k, yaw) => leaning(root, k, yaw, 0);
    // a UR with its gripper; the gap rides in q[6] (mm), 90 when absent
    function drawUR(base, q, a, ga = a) {
      if (a <= 0.03) return;
      drawRobot(ROBOTS.ur5e, base, q, a);
      const B = a < 1 ? scaleT(base, a) : base;
      const Tw = bodyPlacements(ROBOTS.ur5e, B, q)[ROBOTS.ur5e.index.get('wrist3')];
      if (ga > 0.03) drawURGripper(ga < a ? scaleT(Tw, ga / a) : Tw, q[6] ?? 90, 1);   // the gripper grows on its flange, opaque
    }
    // the cardboard box the pair packs, on the table between them: an open
    // box under the right arm's drop point, world-upright
    const R_UP = rotX(90 * DEG);                                      // Z-up geometry, screen-up
    function drawOpenBox(c, w, d, h, R, k, mat, a) {
      if (a <= 0.01) return;
      const T = place(R.map(x => x * k), c);
      const wall = (bw, bd, bh, x, y, z) => { submit(boxFaces(bw, bd, bh, x, y, z), T, mat, a); submitLines(boxWire(bw, bd, bh, x, y, z), T, matLine[mat], LOOK.line * a, LOOK.width); };
      wall(w, d, 6, 0, 0, -h / 2 + 3);
      wall(6, d, h, -w / 2 + 3, 0, 0); wall(6, d, h, w / 2 - 3, 0, 0);
      wall(w, 6, h, 0, -d / 2 + 3, 0); wall(w, 6, h, 0, d / 2 - 3, 0);
    }

    // ── the Ultra OP1's cart, and its bimanual unit ─────────────────────
    // From Ultra's photos (ultra.tech): a black steel cart on four casters
    // carrying the electronics and a black pedestal the white Fairino rises
    // from, a tall thin signal pole with a lamp; on the Fairino's flange a
    // black upright torso (orange logo) with a ZED on a short mast on top,
    // and two black arms off the torso's top corners — shoulder, upper arm,
    // elbow, forearm, wrist — ending in parallel grippers with orange tips.
    const CART_X = STAND_X + 24, FLOOR_Y = 158;
    const ULTRA_ROOT = [CART_X + 46, FLOOR_Y - 66];
    function drawCart(u, alpha) {
      if (u <= 0.01 || alpha <= 0.01) return;
      const F = place(IDENT, [0, 0, 0]); const a = alpha;
      const ax = ULTRA_ROOT[0], ay = FLOOR_Y, az = 0;       // one piece, about the pedestal's foot (see drawFrame)
      const box = (w, h, d, x, y, z, mat) => { const X = ax + (x - ax) * u, Y = ay + (y - ay) * u, Z = az + (z - az) * u; submit(boxFaces(w * u, h * u, d * u, X, Y, Z), F, mat, a); submitLines(boxWire(w * u, h * u, d * u, X, Y, Z), F, matLine[mat], LOOK.line * a, LOOK.width); };
      // the base frame: two rails and two cross members, casters at the corners
      box(170, 10, 12, CART_X, FLOOR_Y - 8, -46, MAT.poly); box(170, 10, 12, CART_X, FLOOR_Y - 8, 46, MAT.poly);
      box(12, 10, 104, CART_X - 79, FLOOR_Y - 8, 0, MAT.poly); box(12, 10, 104, CART_X + 79, FLOOR_Y - 8, 0, MAT.poly);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) drawDrum(place(mul(rotY(90 * DEG), scaleM(u)), [ax + (CART_X + sx * 74 - ax) * u, ay + (FLOOR_Y + 2 - ay) * u, az + (sz * 46 - az) * u]), 6, -4, 4, MAT.poly, a);
      // the pedestal the arm stands on, the electronics box beside it
      box(48, 56, 48, ULTRA_ROOT[0], FLOOR_Y - 41, -2, MAT.poly);
      box(54, 42, 44, CART_X - 44, FLOOR_Y - 34, 8, MAT.poly);
      // the signal pole and its lamp
      box(3, 260, 3, CART_X - 64, FLOOR_Y - 143, -32, MAT.steel);
      box(8, 16, 8, CART_X - 64, FLOOR_Y - 280, -32, MAT.alu);
    }
    // The unit, drawn in its own frame: x forward (where the ZED looks), y
    // across the shoulders, z UP, origin at the torso's bottom centre; mm,
    // the scale carried by the placement.
    const UNIT = { W: 200, D: 150, H: 330, SY: 170, SZ: 300, L1: 260, L2: 250, L3: 120 };
    // The frame the unit hangs in: upright, its back on the Fairino's flange,
    // facing the way the flange points (projected flat — the torso is a
    // payload that stays level however the wrist is turned).
    function unitFrame(Tf, k) {
      let fx = Tf.m[2], fz = Tf.m[8];                       // the flange normal, flattened
      let L = Math.hypot(fx, fz);
      if (L < 0.2 * k) { fx = Tf.m[0]; fz = Tf.m[6]; L = Math.hypot(fx, fz) || 1; }
      fx /= L; fz /= L;
      const f = [fx, 0, fz], up = [0, -1, 0];
      const sd = [up[1] * f[2] - up[2] * f[1], up[2] * f[0] - up[0] * f[2], up[0] * f[1] - up[1] * f[0]];   // up × f
      const m = [f[0] * k, sd[0] * k, up[0] * k, f[1] * k, sd[1] * k, up[1] * k, f[2] * k, sd[2] * k, up[2] * k];
      // the torso's bottom centre: half a torso plus a 12 mm coupling in
      // front of the flange (the torso's back face used to sit ON the
      // flange face, and the coupling drum reached back INTO the wrist mesh
      // — coplanar and intersecting solids z-fight as the arm moves, which
      // is the "glitching" the owner saw) and 210 mm below it
      const g = (UNIT.D / 2 + 12) * k;
      return { m, t: [Tf.t[0] + f[0] * g, Tf.t[1] + 210 * k, Tf.t[2] + f[2] * g] };
    }
    // one of the unit's arms: frames of shoulder, elbow, wrist, and the tool
    // point between the fingertips. `P` = { pitch, roll, elbow, wrist, open }:
    // the upper arm hangs at pitch 0, pitch swings it forward about y, roll
    // swings it outward about x, elbow and wrist turn about the arm's own y.
    function smallArmFrames(TU, P, side) {
      const S = chain(TU, place(mul(rotX(-side * P.roll), rotY(P.pitch)), [0, side * UNIT.SY, UNIT.SZ]));
      const E = chain(S, place(rotY(P.elbow), [0, 0, -UNIT.L1]));
      const Wr = chain(E, place(rotY(P.wrist), [0, 0, -UNIT.L2]));
      const tcp = [Wr.m[2] * -UNIT.L3 + Wr.t[0], Wr.m[5] * -UNIT.L3 + Wr.t[1], Wr.m[8] * -UNIT.L3 + Wr.t[2]];
      return { S, E, Wr, tcp };
    }
    function drawSmallArm(TU, P, side, a) {
      if (a <= 0.01) return;
      const { S, E, Wr } = smallArmFrames(TU, P, side);
      const line = (polys, F, mat, w = LOOK.width) => submitLines(polys, F, matLine[mat], LOOK.line * a, w);
      const box = (F, w, d, h, x, y, z, mat) => { submit(boxFaces(w, d, h, x, y, z), F, mat, a); line(boxWire(w, d, h, x, y, z), F, mat); };
      // The shoulder: a block hung OFF the torso's top corner — outside it; a
      // block inside the torso's top shared its volume and the two z-fought,
      // flickering as the arm moved — with a yaw drum on top and the pitch
      // drum outboard, ringed in the orange of Ultra's joints.
      const sy = side * (UNIT.W / 2 + 25);
      box(TU, 70, 50, 60, 0, sy, UNIT.H - 30, MAT.poly);
      drawDrum(chain(TU, place(IDENT, [0, sy, UNIT.H])), 20, 0, 26, MAT.poly, a);
      drawDrum(chain(TU, place(rotX(90 * DEG), [0, side * UNIT.SY, UNIT.SZ])), 34, -20, 20, MAT.poly, a, matLine[MAT.orange]);
      // the cable from the torso's back to the shoulder, sagging
      const cable = [];
      for (let i = 0; i <= 6; i++) { const u = i / 6; cable.push([-UNIT.D / 2 - 6 + 6 * u, side * (70 + (UNIT.SY - 70) * u), UNIT.H - 60 + 84 * u - Math.sin(Math.PI * u) * 34]); }
      submitLines([cable], TU, matLine[MAT.poly], LOOK.line * a * 0.8, 1.3);
      // the arm: joint modules as drums, links as thinner drums between them
      drawDrum(S, 28, -UNIT.L1 + 14, -12, MAT.poly, a);                                                  // upper arm
      line([ring(28.5, -UNIT.L1 / 2, 18)], S, MAT.steel);                                                // its module seam
      drawDrum(chain(E, place(rotX(90 * DEG), [0, 0, 0])), 32, -28, 28, MAT.poly, a, matLine[MAT.orange]);   // elbow
      drawDrum(E, 24, -UNIT.L2 + 14, -12, MAT.poly, a);                                                  // forearm
      drawDrum(chain(Wr, place(rotX(90 * DEG), [0, 0, 0])), 28, -24, 24, MAT.poly, a, matLine[MAT.orange]);  // wrist pitch
      drawDrum(Wr, 21, -30, -2, MAT.poly, a);                                                             // wrist roll, down the tool axis
      // the gripper: a body, its camera on the front, two fingers with pads
      // on their inner faces, orange tips — the parallel grippers in the photos
      box(Wr, 62, 38, 34, 0, 0, -47, MAT.poly);
      box(Wr, 20, 18, 22, 40, 0, -47, MAT.poly);
      line([ringAt(5, 0, 0, 0.5, 12), ringAt(2.5, 0, 0, 0.8, 8)], chain(Wr, place(rotY(90 * DEG), [50.5, 0, -47])), MAT.steel);
      for (const sg of [-1, 1]) {
        const x = sg * (P.open / 2 + 6);
        box(Wr, 10, 30, 44, x, 0, -86, MAT.poly);
        box(Wr, 2, 26, 36, x - sg * 6, 0, -92, MAT.steel);
        box(Wr, 10, 30, 18, x, 0, -117, MAT.orange);
      }
    }
    function drawUnit(TU, PR, PL, a, ga = 1) {
      if (a <= 0.01) return;
      const line = (polys, F, mat, w = LOOK.width) => submitLines(polys, F, matLine[mat], LOOK.line * a, w);
      // the torso: the box, a top plate, a panel seam across its face, the
      // orange logo, an e-stop on the plate
      submit(boxFaces(UNIT.D, UNIT.W, UNIT.H, 0, 0, UNIT.H / 2), TU, MAT.poly, a);
      line(boxWire(UNIT.D, UNIT.W, UNIT.H, 0, 0, UNIT.H / 2), TU, MAT.poly);
      submit(boxFaces(UNIT.D + 8, UNIT.W + 8, 6, 0, 0, UNIT.H + 3), TU, MAT.poly, a);
      line(boxWire(UNIT.D + 8, UNIT.W + 8, 6, 0, 0, UNIT.H + 3), TU, MAT.poly);
      line([[[UNIT.D / 2 + 0.4, -UNIT.W / 2 + 10, UNIT.H * 0.66], [UNIT.D / 2 + 0.4, UNIT.W / 2 - 10, UNIT.H * 0.66]]], TU, MAT.steel);
      submit(plate(64, 64, 0, 0, 0), chain(TU, place(rotY(90 * DEG), [UNIT.D / 2 + 0.6, 0, UNIT.H * 0.42])), MAT.orange, a * 0.9);
      drawDrum(chain(TU, place(IDENT, [-40, -70, UNIT.H + 6])), 9, 0, 10, MAT.orange, a);
      // the mast, and the ZED 2i on it (a real mesh), looking forward
      submit(boxFaces(24, 24, 60, 0, 0, UNIT.H + 36), TU, MAT.poly, a);
      line(boxWire(24, 24, 60, 0, 0, UNIT.H + 36), TU, MAT.poly);
      const zed = ROBOTS.ultra.parts.find(p => p.body === 'zed');
      if (zed) submitMesh(zed, chain(TU, place(IDENT, [12, 0, UNIT.H + 84])), MAT.poly, a, matLine[MAT.poly]);
      // the coupling to the Fairino's flange: the 12 mm between the torso's
      // back and the flange face, orange-ringed, touching both and inside neither
      drawDrum(chain(TU, place(rotY(90 * DEG), [-UNIT.D / 2, 0, 210])), 44, -12, 0, MAT.alu, a, matLine[MAT.orange]);
      // arms arriving grow out of their shoulders rather than fading in
      if (ga > 0.03) for (const [P, sd] of [[PR, 1], [PL, -1]]) {
        const sh = [TU.m[1] * sd * UNIT.SY + TU.m[2] * UNIT.SZ + TU.t[0], TU.m[4] * sd * UNIT.SY + TU.m[5] * UNIT.SZ + TU.t[1], TU.m[7] * sd * UNIT.SY + TU.m[8] * UNIT.SZ + TU.t[2]];
        drawSmallArm(ga < 1 ? scaleAbout(TU, ga, sh) : TU, P, sd, a);
      }
    }
    // the whole machine: the Fairino (mesh) with the unit hanging from its
    // flange; returns the unit's frame
    function drawUltraRobot(base, q, PR, PL, alpha, bodyAlpha, armAlpha = 1) {
      const robot = ROBOTS.ultra;
      const grow = { ...(bodyAlpha || {}), zed: 0 };
      drawRobot(robot, base, q, alpha, grow);
      const B = alpha < 1 ? scaleT(base, alpha) : base;
      const Tf = bodyPlacements(robot, B, q)[robot.index.get('wrist3_link')];
      const TU = unitFrame(chain(Tf, place(IDENT, [0, 0, 120])), detScale(B.m));
      // the unit grows out of the flange, its arms out of its shoulders — opaque
      const gu = bodyAlpha ? (bodyAlpha.unit ?? 1) : 1;
      if (gu > 0.03) drawUnit(gu < 1 ? scaleAbout(TU, gu, Tf.t) : TU, PR, PL, 1, armAlpha);
      return TU;
    }
    const UL_ORDER = ['base_link', 'shoulder_link', 'upperarm_link', 'forearm_link', 'wrist1_link', 'wrist2_link', 'wrist3_link', 'unit', 'zed'];

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

// ── the left side after the sensor: inference, detections, a world model
    // The sensor's own 8x6 grid is the thread through all three: it is the
    // input the model runs on, the image the boxes sit on, and the ground the
    // world is built on.
    const GRID_W = PX_C * PX, GRID_H = PX_R * PX;
    // where the sensor sits at the end of act one, and where it goes next
    const SENSOR_HOME = { x: 0, y: 0, z: 16, s: SENSOR_SCALE, ry: 0, rx: 0 };
    const SENSOR_INFER = { x: -74, y: -6, z: 10, s: 1.12, ry: -34, rx: 0 };
    const SENSOR_DET = { x: -6, y: -10, z: 20, s: 1.5, ry: 0, rx: 0 };
    const SENSOR_WORLD = { x: -4, y: 54, z: -10, s: 1.62, ry: -22, rx: 66 };
    const lerpS = (A, B, u) => ({
      x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, z: A.z + (B.z - A.z) * u,
      s: A.s + (B.s - A.s) * u, ry: A.ry + (B.ry - A.ry) * u, rx: A.rx + (B.rx - A.rx) * u,
    });
    const sensorPlace = S => place(mul(mul(rotY(S.ry * DEG), rotX(S.rx * DEG)), scaleM(S.s)), [S.x, S.y, S.z]);
    // the photosite grid, drawn wherever the sensor currently is
    // The bright object in the picture is the RED CUBE the robots handle on
    // the right (the owner: "have the object detector detect a red cube"):
    // the two brightest photosite buckets are red, the rest the page's ink.
    const RED = MAT_HEX[MAT.red];
    const pxColor = b => (b >= 2 ? RED : ink);
    function drawPixels(T, alpha, frame, band) {
      const buckets = [[], [], [], []];
      for (let i = 0; i < PX_C * PX_R; i++) {
        const [x, y] = pxPos(i);
        const v = pxVal(i, frame);
        buckets[clamp(Math.ceil(v * 4) - 1, 0, 3)].push(rect(PX * 0.76, PX * 0.76, x, y, 1.5));
      }
      for (let b = 0; b < 4; b++) fill(buckets[b], T, pxColor(b), (0.12 + 0.72 * ((b + 1) / 4)) * alpha);
      if (band != null) fill([rect(GRID_W + 8, 11, 0, -GRID_H / 2 + band * GRID_H, 2.5)], T, ink, 0.22 * alpha);
    }
    // three things the model found in the picture: where, and how sure
    const DETS = [
      { x: 13, y: -7, w: 40, h: 32, conf: 0.94 },      // the red cube — ON the bright blob (pxVal's centre), where it was not
      { x: 24, y: 10, w: 34, h: 26, conf: 0.81 },
      { x: -34, y: 18, w: 26, h: 18, conf: 0.66 },
    ];
    function drawDetections(T, alpha, jitter) {
      for (let i = 0; i < DETS.length; i++) {
        const d = DETS[i];
        const j = jitter ? Math.sin(jitter * 1.7 + i * 2.1) * 0.9 : 0;
        const x = d.x + j, y = d.y - j * 0.6;
        const a = alpha * (0.55 + 0.45 * d.conf);
        stroke([rect(d.w, d.h, x, y, 3)], T, i === 0 ? ink : err, a, 1.3);
        // corner ticks, the way a detector's overlay draws them
        const cx = d.w / 2, cy = d.h / 2, t = 5;
        stroke([
          [[x - cx, y - cy + t, 3], [x - cx, y - cy, 3], [x - cx + t, y - cy, 3]],
          [[x + cx - t, y - cy, 3], [x + cx, y - cy, 3], [x + cx, y - cy + t, 3]],
          [[x - cx, y + cy - t, 3], [x - cx, y + cy, 3], [x - cx + t, y + cy, 3]],
          [[x + cx - t, y + cy, 3], [x + cx, y + cy, 3], [x + cx, y + cy - t, 3]],
        ], T, i === 0 ? ink : err, a, 1.6);
        // a label tab, and a confidence bar under it
        fill([rect(d.w * 0.52, 5, x - cx + d.w * 0.26, y - cy - 5, 3)], T, i === 0 ? ink : err, a * 0.8);
        stroke([[[x - cx, y - cy - 1.5, 3], [x - cx + d.w * d.conf, y - cy - 1.5, 3]]], T, i === 0 ? ink : err, a, 2.2);
      }
    }

    // ── act 2 (left): a VLA runs on the pixels ──────────────────────────
    // The left half is the LEARNING half now (the owner's targets: RL, world
    // models, simulation, VLAs, embodied AI). The picture is cut into patches
    // and fed, with the INSTRUCTION as a row of language tokens, into a stack
    // of layers; out the far end come ACTION tokens — seven bars, the joints
    // of the Franka on the right, read from the same task at the same clock
    // (RB.fr.task; both pieces reset their clocks on the settle), so what the
    // left emits is literally what the right does.
    const LAYERS = 4;
    // The stack the picture is fed into. ONE function, because the act that
    // builds it and the act that folds it away both draw it — and if they
    // draw it differently the boundary between them jumps (measured: 9,000
    // pixels, when one drew fills and cells and the other only outlines).
    //   growOf  how much of layer i exists
    //   fold    1 out at the stack's full depth, 0 collapsed onto the picture
    //   run     where the activation is, 0..1 through the stack
    function drawLayerStack(growOf, fold, run, alpha) {
      for (let i = 0; i < LAYERS; i++) {
        const g = growOf(i) * fold;
        if (g <= 0.01) continue;
        const z = (26 - i * 30) * fold, w = (96 - i * 9) * g, h = (74 - i * 7) * g;
        const L = place(IDENT, [(54 + i * 11) * fold, -4 * fold, z]);
        const hot = clamp(1 - Math.abs(run * (LAYERS + 0.6) - i) * 1.6, 0, 1);
        submit(plate(w, h, 0, 0, 0), L, MAT.neutral, 0.6 * g * alpha);
        flush();
        stroke([rect(w, h, 0, 0, 0)], L, slate, (0.6 + 0.4 * hot) * g * alpha, 1.1 + hot);
        // a few cells, so a layer reads as a feature map rather than a card
        const cells = [];
        for (let cx = 0; cx < 3; cx++) for (let cy = 0; cy < 2; cy++) {
          cells.push(rect(w / 4.4, h / 3.4, (cx - 1) * w / 3.2, (cy - 0.5) * h / 2.4, 1));
        }
        fill(cells, L, slate, (0.10 + 0.22 * hot) * g * alpha);
        if (i > 0) {
          const prev = place(IDENT, [(54 + (i - 1) * 11) * fold, -4 * fold, (26 - (i - 1) * 30) * fold]);
          for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            stroke([[[dx * (w + 24) / 2.2, dy * (h + 18) / 2.2, z], [dx * w / 2, dy * h / 2, z]]], prev, slate, 0.35 * g * alpha, 1);
          }
        }
      }
    }
    // CAPTIONS. The left half tells a story a recruiter should be able to
    // read, so its stages are named in small monospace type — projected
    // through the same camera as the geometry, drawn straight to the context
    // after it (text is not depth-sorted; nothing here sits behind a mass).
    // Skipped in capture mode: the hero's strands have no text to fly into.
    function caption(text, x, y, z, alpha, align = 'left') {
      if (cap || alpha <= 0.01) return;
      const p = cam(x, y, z);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ink;
      // the type scales with the stage (ZOOM): the token chips are geometry
      // and shrank with everything else, and 9.5px words overran them
      ctx.font = `600 ${(9.5 * ZOOM).toFixed(2)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
      ctx.textAlign = align; ctx.textBaseline = 'middle';
      ctx.fillText(text, p[0], p[1]);
      ctx.restore();
    }
    // the instruction, as a row of language tokens under the picture; `hot`
    // is the token being attended to (-1 for none)
    const WORDS = ['stack', 'the', 'red', 'cube', 'first'];
    const TOKENS = WORDS.map(w => 6 + w.length * 4.6);
    function drawTokens(T, alpha, hot) {
      if (alpha <= 0.01) return;
      const y = GRID_H / 2 + 15;
      let x = -GRID_W / 2;
      TOKENS.forEach((w, i) => {
        const a = alpha * (hot === i ? 1 : 0.6);
        stroke([rect(w, 11, x + w / 2, y, 3)], T, ink, a, hot === i ? 1.6 : 1);
        const c = [x + w / 2, y, 3];
        const p = [T.m[0] * c[0] + T.m[1] * c[1] + T.m[2] * c[2] + T.t[0], T.m[3] * c[0] + T.m[4] * c[1] + T.m[5] * c[2] + T.t[1], T.m[6] * c[0] + T.m[7] * c[1] + T.m[8] * c[2] + T.t[2]];
        caption(WORDS[i], p[0], p[1], p[2], a * 0.9, 'center');
        x += w + 5;
      });
      const e = [-GRID_W / 2, y + 12, 3];
      caption('instruction', T.m[0] * e[0] + T.m[1] * e[1] + T.m[2] * e[2] + T.t[0], T.m[3] * e[0] + T.m[4] * e[1] + T.m[5] * e[2] + T.t[1], T.m[6] * e[0] + T.m[7] * e[1] + T.m[8] * e[2] + T.t[2], alpha * 0.55);
    }
    // the action chunk: seven joints as bars about a zero line, with the
    // gripper's opening as an eighth, narrower, in the accent
    const ACT_AT = place(IDENT, [74, 62, -24]);            // under the stack (beyond it, it ran off the stage's inner edge)
    function drawActionBars(alpha, q) {
      if (alpha <= 0.01) return;
      const n = 7, bw = 6, gap = 4, W0 = n * (bw + gap);
      submit(plate(W0 + 16, 64, 0, 0, -0.5), ACT_AT, MAT.neutral, 0.6 * alpha); flush();
      stroke([rect(W0 + 16, 64, 0, 0, 0)], ACT_AT, slate, 0.5 * alpha, 1);
      stroke([[[-W0 / 2, 0, 0], [W0 / 2, 0, 0]]], ACT_AT, slate, 0.5 * alpha, 1);
      const bars = [];
      for (let i = 0; i < n; i++) { const v = clamp((q[i] || 0) / 3, -1, 1) * 24; bars.push(rect(bw, Math.abs(v) + 0.6, -W0 / 2 + i * (bw + gap) + bw / 2, -v / 2, 0.5)); }
      fill(bars, ACT_AT, ink, 0.75 * alpha);
      const grip = clamp(((q[7] ?? 0.03) - 0.006) / 0.034, 0, 1);
      fill([rect(3, 26 * grip + 0.6, W0 / 2 + 4, -13 * grip, 0.5)], ACT_AT, copper, 0.7 * alpha);
      caption('actions · 7 joints + grip', ACT_AT.t[0], ACT_AT.t[1] + 40, ACT_AT.t[2], alpha * 0.6, 'center');   // centred under the panel: left-aligned it ran off the stage
    }
    // the link from the last layer to the action chunk
    const ACT_LINK = [[[54 + 3 * 11, -4 + 24, 26 - 3 * 30], [74, 62 - 34, -24]]];
    // the Franka's joints right now — the right side's numbers, on the left
    const frankaNow = (t) => {
      const task = RB.fr.task, n = task.W.length;
      const live = t >= 1 && settleU > 0.001 ? taskQ(task, taskPhase(task, idleT, n)) : task.W[0];
      return settleU >= 0.999 || t < 1 ? live : lerpQ(task.W[0], live, settleU);
    };
    function drawInferAct(t) {
      const u = smooth(t);
      setCam(-8 * u * DEG, 6 * u * DEG, 0);            // from (0,0,0), where the camera act ended
      const S = lerpS(SENSOR_HOME, SENSOR_INFER, u);
      const T = sensorPlace(S);
      const frame = idleOn && t >= 1 ? Math.floor(idleT / SHUTTER) + 1 : 0;
      drawPixels(T, 1, frame, null);
      stroke([rect(112, 86, 0, 0, 0)], T, ink, 0.55, 1);
      // the chip it was a moment ago, fading: this act has to START exactly
      // where the last one ended or the package pops off at the boundary
      const pkg = 1 - smooth(win(t, 0, 0.3));
      if (pkg > 0.01) {
        stroke([rect(126, 100, 0, 0, -3)], T, ink, 0.55 * pkg, 1);
        stroke(SENSOR_PADS, T, LINE, 0.5 * pkg, 1);
      }
      // the picture is cut into patches — the move that makes it a sequence
      const patches = smooth(win(t, 0.12, 0.3));
      if (patches > 0.01) {
        const lines = [];
        for (let c = 1; c < 4; c++) lines.push([[-GRID_W / 2 + (c * GRID_W) / 4, -GRID_H / 2, 3], [-GRID_W / 2 + (c * GRID_W) / 4, GRID_H / 2, 3]]);
        for (let r = 1; r < 3; r++) lines.push([[-GRID_W / 2, -GRID_H / 2 + (r * GRID_H) / 3, 3], [GRID_W / 2, -GRID_H / 2 + (r * GRID_H) / 3, 3]]);
        stroke(lines, T, LINE, 0.5 * patches, 1);
      }
      // ...and the instruction arrives under it, a token at a time
      const tok = smooth(win(t, 0.22, 0.3));
      drawTokens(T, tok, idleOn && t >= 1 ? Math.floor(idleT * 1.6) % TOKENS.length : -1);
      // the layers, receding, with an activation running through them
      const run = idleOn && t >= 1 ? (idleT % 2.2) / 2.2 : win(t, 0.5, 0.5);
      drawLayerStack(i => smooth(win(t, 0.28 + i * 0.1, 0.26)), 1, run, 1);
      caption('VLA policy', 54 + 20, -4 - 48, 26, smooth(win(t, 0.4, 0.3)) * 0.6, 'center');   // short: the long name ran off the stage's inner edge
      // the picture and the tokens feeding the first layer
      const feed = smooth(win(t, 0.3, 0.3));
      if (feed > 0.01) {
        for (const dy of [-1, 0, 1]) stroke([[[GRID_W / 2, dy * GRID_H / 3, 3], [GRID_W / 2 + 40 * feed, dy * GRID_H / 4, 3]]], T, slate, 0.45 * feed, 1);
        stroke([[[GRID_W / 2 - 10, GRID_H / 2 + 15, 3], [GRID_W / 2 + 40 * feed, GRID_H / 4, 3]]], T, ink, 0.4 * feed * tok, 1);
      }
      // out the far end: the action chunk, the right side's joints
      const act = smooth(win(t, 0.66, 0.3));
      if (act > 0.01) {
        stroke(ACT_LINK, place(IDENT, [0, 0, 0]), slate, 0.4 * act, 1);
        drawActionBars(act, frankaNow(t));
      }
    }

    // ── act 3 (left): a world model imagines what happens next ──────────
    // The stack folds back into the picture, and the picture spawns GHOST
    // FRAMES receding into the future: three candidate rollouts of the
    // tracked object fan out from where it is, the model keeps one, and each
    // ghost frame shows the object further along it. Settled, a marker runs
    // the chosen rollout and the frames breathe.
    const ROLLS = [-1, 0, 1];                           // three futures; 0 is the one kept
    const rollAt = (r, sv) => {                         // where the object is, sv (0..1) along rollout r
      const d = DETS[0];
      return [d.x + sv * 54, d.y - sv * 16 + r * sv * 22 - Math.sin(sv * 3.1) * 6 * (1 - Math.abs(r) * 0.5)];
    };
    // the futures, drawn on the picture at T; `f` how far out they are, `adv`
    // the marker's position on the kept rollout (0 for none). ONE function:
    // the act that raises them and the act that lays them down both draw it.
    function drawFutures(T, alpha, f, adv) {
      if (alpha <= 0.01 || f <= 0.01) return;
      const d = DETS[0];
      // the detection, as a detector draws it: box, corner ticks, class and score
      stroke([rect(d.w, d.h, d.x, d.y, 3)], T, RED, 0.9 * alpha, 1.3);
      const cx = d.w / 2, cy = d.h / 2, tk = 5;
      stroke([
        [[d.x - cx, d.y - cy + tk, 3], [d.x - cx, d.y - cy, 3], [d.x - cx + tk, d.y - cy, 3]],
        [[d.x + cx - tk, d.y - cy, 3], [d.x + cx, d.y - cy, 3], [d.x + cx, d.y - cy + tk, 3]],
        [[d.x - cx, d.y + cy - tk, 3], [d.x - cx, d.y + cy, 3], [d.x - cx + tk, d.y + cy, 3]],
        [[d.x + cx - tk, d.y + cy, 3], [d.x + cx, d.y + cy, 3], [d.x + cx, d.y + cy - tk, 3]],
      ], T, RED, 0.9 * alpha, 1.6);
      { const c = [d.x - cx, d.y - cy - 7, 3]; caption(`red cube · ${d.conf.toFixed(2)}`, T.m[0] * c[0] + T.m[1] * c[1] + T.m[2] * c[2] + T.t[0], T.m[3] * c[0] + T.m[4] * c[1] + T.m[5] * c[2] + T.t[1], T.m[6] * c[0] + T.m[7] * c[1] + T.m[8] * c[2] + T.t[2], 0.85 * alpha); }
      // the three rollouts, dashed, on the picture — the dashes CRAWL along
      // them while settled (`adv` runs), the way a predicted path is drawn
      // live, so the futures read as being computed rather than printed
      const crawl = adv > 0 ? (adv * 2) % (2 / 12) : 0;
      for (const r of ROLLS) {
        const dashes = [];
        for (let i = -2; i < 12; i += 2) {
          const s0 = clamp(i / 12 + crawl, 0, 1) * f, s1 = clamp((i + 1) / 12 + crawl, 0, 1) * f;
          if (s1 - s0 < 0.005) continue;
          const a = rollAt(r, s0), b = rollAt(r, s1); dashes.push([[a[0], a[1], 3], [b[0], b[1], 3]]);
        }
        stroke(dashes, T, r === 0 ? ink : slate, (r === 0 ? 0.7 : 0.35) * alpha, r === 0 ? 1.5 : 1);
      }
      // the ghost frames: the picture's own frame, repeated back and up, and
      // in each an IMAGINED picture — the sensor's grid re-lit with the bright
      // blob moved along the kept rollout — with the object boxed where the
      // model puts it
      for (let k = 1; k <= 4; k++) {
        const g = smooth(win(f, (k - 1) * 0.18, 0.4));
        if (g <= 0.01) continue;
        const G = chain(T, place(IDENT, [k * 9 * g, -k * 7 * g, -k * 30 * g]));
        submit(plate(112, 86, 0, 0, -0.5), G, MAT.neutral, 0.7 * g * alpha); flush();
        stroke([rect(112, 86, 0, 0, 0)], G, slate, 0.45 * g * alpha, 1);
        const p = rollAt(0, k / 4);
        const dx = p[0] - d.x, dy = p[1] - d.y;
        const buckets = [[], [], [], []];
        for (let i = 0; i < PX_C * PX_R; i++) {
          const [x, y] = pxPos(i);
          const dd = Math.hypot((x - 13 - dx) / 38, (y + 7 - dy) / 29);
          const v = clamp(1.15 - dd, 0.05, 1) * (0.75 + 0.25 * hash(i * 3.7 + k * 2.3));
          buckets[clamp(Math.ceil(v * 4) - 1, 0, 3)].push(rect(PX * 0.76, PX * 0.76, x, y, 1.5));
        }
        for (let b = 0; b < 4; b++) fill(buckets[b], G, pxColor(b), (0.12 + 0.72 * ((b + 1) / 4)) * 0.45 * g * alpha);
        stroke([rect(d.w * (1 - k * 0.06), d.h * (1 - k * 0.06), p[0], p[1], 2)], G, ink, 0.6 * g * alpha, 1.2);
        if (k === 4) { const c = [-56, -52, 0]; caption('t+4 · imagined', G.m[0] * c[0] + G.m[1] * c[1] + G.m[2] * c[2] + G.t[0], G.m[3] * c[0] + G.m[4] * c[1] + G.m[5] * c[2] + G.t[1], G.m[6] * c[0] + G.m[7] * c[1] + G.m[8] * c[2] + G.t[2], 0.6 * g * alpha); }
      }
      { const c = [-56, 52, 3]; caption('world model · 3 rollouts, 1 kept', T.m[0] * c[0] + T.m[1] * c[1] + T.m[2] * c[2] + T.t[0], T.m[3] * c[0] + T.m[4] * c[1] + T.m[5] * c[2] + T.t[1], T.m[6] * c[0] + T.m[7] * c[1] + T.m[8] * c[2] + T.t[2], 0.6 * alpha * f); }
      // the imagined object running the kept rollout: the red cube, fading
      // in at the start and out at the end of each run instead of snapping
      // back (a copper square that jumped to the start every 3.2 s read as
      // a glitch)
      if (adv > 0) {
        const p = rollAt(0, adv);
        const ma = smooth(win(adv, 0, 0.12)) * (1 - smooth(win(adv, 0.84, 0.16)));
        fill([rect(7, 7, p[0], p[1], 4)], T, RED, 0.9 * alpha * ma);
        stroke([rect(7, 7, p[0], p[1], 4)], T, ink, 0.6 * alpha * ma, 1);
      }
    }
    function drawDetectAct(t) {
      const u = smooth(t);
      setCam((-8 + 8 * u) * DEG, (6 - 4 * u) * DEG, 0);  // from (-8, 6, 0)
      const S = lerpS(SENSOR_INFER, SENSOR_DET, u);
      const T = sensorPlace(S);
      const frame = idleOn && t >= 1 ? Math.floor(idleT / SHUTTER) + 1 : 0;
      drawPixels(T, 1, frame, null);
      stroke([rect(112, 86, 0, 0, 0)], T, ink, 0.55, 1);
      // the patch grid, the tokens, the stack and the action chunk it arrived
      // with, going as the futures come
      const was = 1 - smooth(win(t, 0, 0.4));
      if (was > 0.01) {
        const lines = [];
        for (let c = 1; c < 4; c++) lines.push([[-GRID_W / 2 + (c * GRID_W) / 4, -GRID_H / 2, 3], [-GRID_W / 2 + (c * GRID_W) / 4, GRID_H / 2, 3]]);
        for (let r = 1; r < 3; r++) lines.push([[-GRID_W / 2, -GRID_H / 2 + (r * GRID_H) / 3, 3], [GRID_W / 2, -GRID_H / 2 + (r * GRID_H) / 3, 3]]);
        stroke(lines, T, LINE, 0.5 * was, 1);
        drawTokens(T, was, -1);
        drawLayerStack(() => 1, was, 1, was);
        stroke(ACT_LINK, place(IDENT, [0, 0, 0]), slate, 0.4 * was, 1);
        drawActionBars(was, RB.fr.task.W[0]);
        caption('VLA policy', 54 + 20, -4 - 48, 26, was * 0.6, 'center');   // carried in from the last act, or the seam jumps
      }
      const f = smooth(win(t, 0.3, 0.6));
      // the run eases out and in rather than sweeping at one speed
      drawFutures(T, 1, f, idleOn && t >= 1 ? smooth((idleT % 4) / 4) : 0);
    }

    // ── act 4 (left): the world model becomes a SIMULATOR ───────────────
    // The picture lies down into a ground plane and the objects stand up on
    // it — the world model as a scene, with the camera's frustum behind and
    // the kept rollout on the floor. Then the scene is COPIED: two randomised
    // twins beside it, tinted differently and re-arranged, each with its own
    // rollout — domain randomisation — and a return curve climbs over them
    // as training runs. Sim to real.
    function drawWorldAct(t) {
      const u = smooth(t);
      setCam(10 * u * DEG, (2 - 18 * u) * DEG, 0);       // from (0, 2, 0); down to -16 over the ground plane
      const S = lerpS(SENSOR_DET, SENSOR_WORLD, u);
      const T = sensorPlace(S);
      const lay = smooth(win(t, 0.1, 0.5));
      drawPixels(T, 1 - lay * 0.75, idleOn && t >= 1 ? Math.floor(idleT / SHUTTER) + 1 : 0, null);
      // the futures it arrived with, fading as the scene stands up instead
      const flat = 1 - smooth(win(t, 0, 0.4));
      if (flat > 0.01) {
        stroke([rect(112, 86, 0, 0, 0)], T, ink, 0.55 * flat, 1);
        drawFutures(T, flat, 1, 0);
      }
      // ONE scene: ground, standing objects, rollout — drawn three times
      const scene = (B, gs, rise, tint, roll, alpha, jiggle) => {
        const gw = GRID_W * (1 + 0.7 * gs), gh = GRID_H * (1 + 1.5 * gs);
        if (gs > 0.01) {
          const lines = [rect(gw, gh, 0, 0, 0)];
          for (let i = 1; i < 6; i++) lines.push([[-gw / 2 + (i * gw) / 6, -gh / 2, 0], [-gw / 2 + (i * gw) / 6, gh / 2, 0]]);
          for (let i = 1; i < 6; i++) lines.push([[-gw / 2, -gh / 2 + (i * gh) / 6, 0], [gw / 2, -gh / 2 + (i * gh) / 6, 0]]);
          stroke(lines, B, LINE, 0.4 * gs * alpha, 1);
        }
        if (rise > 0.01) {
          for (let i = 0; i < DETS.length; i++) {
            const d = DETS[i];
            const jx = jiggle ? Math.sin(i * 2.3 + jiggle) * 14 : 0, jy = jiggle ? Math.cos(i * 1.7 + jiggle) * 9 : 0;
            const hgt = (14 + d.conf * 20) * rise;
            const Bx = chain(B, place(rotX(-90 * DEG), [d.x + jx, d.y + jy, 0]));
            submit(boxFaces(d.w * 0.7, hgt, d.h * 0.7, 0, -hgt / 2, 0), Bx, i === 0 ? tint : MAT.paint, rise * alpha);
            submitLines(boxWire(d.w * 0.7, hgt, d.h * 0.7, 0, -hgt / 2, 0), Bx, i === 0 ? ink : matLine[MAT.paint], LOOK.line * rise * alpha, LOOK.width);
          }
          flush();
        }
        if (roll > 0.01) {
          const P0 = chain(B, place(rotX(-90 * DEG), [0, 0, 0]));
          const dashes = [];
          for (let i = 0; i < 12; i += 2) { const a = rollAt(0, i / 12), b = rollAt(0, (i + 1) / 12); dashes.push([[a[0], 0, a[1]], [b[0], 0, b[1]]]); }
          stroke(dashes, P0, ink, 0.5 * roll * alpha, 1.4);
        }
      };
      const g = smooth(win(t, 0.16, 0.4)), rise = smooth(win(t, 0.3, 0.5)), roll = smooth(win(t, 0.55, 0.3));
      scene(T, g, rise, MAT.red, roll, 1, 0);       // the red cube, standing on the ground it was seen on
      // the camera that saw it, as a frustum over the scene
      const fr = smooth(win(t, 0.45, 0.4));
      if (fr > 0.01) {
        const apex = [-GRID_W * 0.75, -78 * fr, GRID_H * 0.6];
        const corners = [[-GRID_W / 2, 0, -GRID_H / 2], [GRID_W / 2, 0, -GRID_H / 2], [GRID_W / 2, 0, GRID_H / 2], [-GRID_W / 2, 0, GRID_H / 2]];
        const F = chain(T, place(rotX(-90 * DEG), [0, 0, 0]));
        stroke(corners.map(c => [apex, c]), F, ink, 0.35 * fr, 1);
        stroke([[...corners, corners[0]]], F, ink, 0.3 * fr, 1);
      }
      // the twins: the same scene, smaller, to either side, tinted and
      // re-arranged — and while settled, re-randomised every couple of seconds
      const sim = smooth(win(t, 0.62, 0.38));
      if (sim > 0.01) {
        // every 2.4 s a new randomisation — reached by GLIDING over the last
        // 0.6 s of the epoch (the jiggle phase is continuous through sin/cos),
        // not by popping; the pop read as a glitch on the settled page
        const ep = idleOn && t >= 1 ? idleT / 2.4 : 0;
        const epoch = Math.floor(ep) + smooth(clamp((ep - Math.floor(ep) - 0.75) / 0.25, 0, 1));
        [[-1, MAT.urblue], [1, MAT.copper]].forEach(([side, tint], k) => {
          const C = chain(T, place(scaleM(0.34 + 0.04 * sim), [side * 64 * sim, -50 * sim, -46 * sim]));
          scene(C, sim, sim, tint, sim, 0.85 * sim, 1.3 + epoch * 2.1 + k * 4.2);
        });
        // the return curve, climbing as training runs
        const P = place(IDENT, [-84, -158, 0]);
        submit(plate(96, 54, 48, 0, -0.5), P, MAT.neutral, 0.6 * sim); flush();
        stroke([rect(96, 54, 48, 0, 0)], P, slate, 0.45 * sim, 1);
        stroke([[[0, 24, 0], [96, 24, 0]], [[0, 24, 0], [0, -24, 0]]], P, slate, 0.5 * sim, 1);
        // the curve climbs over the first six seconds and then HOLDS, its
        // tail flickering the way a converged return does (it used to run
        // 0 → 1 and snap back every seven seconds, a thousand episodes a
        // cycle); the counter ticks at a rate a real run might
        const live = idleOn && t >= 1;
        const N = 24, upto = live ? clamp(idleT / 6, 0, 1) : 0.55;
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const x = i / N; if (x > upto) break;
          const tail = live ? Math.sin(idleT * 5 + x * 40) * 1.4 * smooth(win(x, 0.6, 0.4)) * smooth(win(upto, 0.9, 0.1)) : 0;
          pts.push([2 + x * 92, 22 - 42 * (1 - Math.exp(-x * 3.2)) - Math.sin(x * 21) * 2.5 * (1 - x) + tail, 0.5]);
        }
        if (pts.length > 1) stroke([pts], P, copper, 0.85 * sim, 1.6);
        caption('return · training in sim', P.t[0] + 2, P.t[1] - 34, 0, 0.6 * sim);
        caption(`episode ${1000 + (live ? Math.floor(idleT * 14) : 0)}`, P.t[0] + 2, P.t[1] + 34, 0, 0.5 * sim);
        caption('domain randomisation', T.t[0] - 92 * sim, T.t[1] - 116 * sim, T.t[2], 0.55 * sim);   // above the ground plane's far edge, not on it
      }
    }

    // ── the machines, from their real models ────────────────────────────
    // Once the baked meshes have loaded (ROBOTS), every state on the right
    // is one of three real robots posed by forward kinematics, and the left's
    // camera is the RealSense D435i. Until then the procedural drawings above
    // stand in. Poses are joint angles in radians, in each MJCF's joint order.
    // Task waypoints, solved by IK in scripts/ik-poses.mjs from where the
    // props are in each robot's frame (see "TASKS" below). `g(q, v)` sets the
    // gripper's value on a copy of a pose.
    const g = (q, i, v) => { const o = q.slice(); o[i] = v; return o; };
    // SO-ARM101: A and B on the table, 200 forward and 70 to either side of
    // the base; "up" 90 mm above them. Gripper joint 5: 0.7 open, 0.3 closed.
    const SO_A = [0.341, 0.135, 0.324, 1.012, 0, 0.7], SO_AU = [0.341, 0.039, -0.136, 1.568, 0, 0.7];
    const SO_B = [-0.341, 0.135, 0.325, 1.012, 0, 0.7], SO_BU = [-0.341, 0.039, -0.136, 1.568, 0, 0.7];
    const SO_W = [SO_AU, SO_A, g(SO_A, 5, 0.3), g(SO_AU, 5, 0.3), g(SO_BU, 5, 0.3), g(SO_B, 5, 0.3), SO_B, SO_BU,
                  SO_BU, SO_B, g(SO_B, 5, 0.3), g(SO_BU, 5, 0.3), g(SO_AU, 5, 0.3), g(SO_A, 5, 0.3), SO_A, SO_AU];
    // Franka: three 50 mm cubes at P1, P2, P3 in front of the base; S1, S2 the
    // stack on P1; HI the travel pose over the work. Fingers (7, 8): 0.04
    // open, 0.025 closed on a 50 mm cube.
    const FR_HI = [0, -0.322, 0, -2.492, 0, 2.17, 0.785, 0.04, 0.04];
    const FR_P1 = [-0.268, 0.348, 0, -2.637, 0, 2.985, 0.785, 0.04, 0.04], FR_P2 = [0.268, 0.348, 0, -2.637, 0, 2.985, 0.785, 0.04, 0.04];
    const FR_P3 = [0, 0.489, 0, -2.328, 0, 2.817, 0.785, 0.04, 0.04];
    const FR_S1 = [-0.268, 0.178, 0, -2.672, 0, 2.849, 0.785, 0.04, 0.04], FR_S2 = [-0.268, 0.017, 0, -2.683, 0, 2.7, 0.785, 0.04, 0.04];
    const fc = q => { const o = q.slice(); o[7] = 0.025; o[8] = 0.025; return o; };
    const FR_W = [FR_HI, FR_P2, fc(FR_P2), fc(FR_HI), fc(FR_S1), FR_S1, FR_HI, FR_P3, fc(FR_P3), fc(FR_HI), fc(FR_S2), FR_S2, FR_HI,
                  FR_S2, fc(FR_S2), fc(FR_HI), fc(FR_P3), FR_P3, FR_HI, FR_S1, fc(FR_S1), fc(FR_HI), fc(FR_P2), FR_P2, FR_HI];
    // UR5e, hanging: the item on the table beside the arm, the box 360 mm
    // toward the pair's centre. Gripper gap in q[6]: 90 open, 60 closed.
    // ...solved per arm, in stage coordinates, for the LEANING mounts (the
    // left arm is not the right one's mirror once the mounts lean)
    const urW = (IT, ITU, BX, BXU) => [ITU, IT, g(IT, 6, 60), g(ITU, 6, 60), g(BXU, 6, 60), g(BX, 6, 60), BX, BXU, ITU];
    const UR_W_R = urW([-0.034, -1.149, -1.626, 1.693, 1.57, 0, 90], [0.201, -1.258, -2.023, 2.19, 1.57, 0, 90], [-1.121, -1.761, -1.562, 1.979, 1.57, 0, 90], [-0.969, -1.869, -1.675, 2.266, 1.57, 0, 90]);
    const UR_W_L = urW([0.034, -0.588, -2.022, 0.551, 1.57, 0, 90], [-0.201, -0.148, -2.473, 0.571, 1.57, 0, 90], [-1.198, -1.568, -1.889, 1.695, 1.57, 0, 90], [-1.369, -1.74, -1.98, 2.043, 1.57, 0, 90]);
    // the OP1's small arms (right; the left is the mirror by construction)
    const op = (P, open) => ({ ...P, open });
    // ...solved in scripts/ik-poses.mjs with the arms kept OUTBOARD (roll,
    // which swings an arm inward in this chain, capped near zero; a little
    // inward only for the drop into the box, when the other arm is at rest),
    // each arm's second flap grabbed on its own side, and a rest pose with
    // the elbow up: hanging, the 630 mm arms put their fingertips 80 mm into
    // the table top
    const OP_REST = { pitch: -1.562, roll: -0.149, elbow: 1.805, wrist: -0.242 };
    const OP_R = { FLAP: { pitch: -1.105, roll: -0.078, elbow: 1.074, wrist: 0.031 }, FLAP_UP: { pitch: -1.555, roll: 0.078, elbow: 1.635, wrist: -0.08 },
                   FLAP2: { pitch: -0.791, roll: 0.08, elbow: 0, wrist: 0.72 }, FLAP2_UP: { pitch: -1.526, roll: 0.08, elbow: 1.291, wrist: 0.235 },
                   ITEM: { pitch: -1.174, roll: -0.181, elbow: 1.294, wrist: -0.119 }, ITEM_UP: { pitch: -1.937, roll: -0.28, elbow: 2.068, wrist: -0.131 },
                   OVER: { pitch: -2.01, roll: 0.225, elbow: 1.991, wrist: 0.019 }, IN: { pitch: -1.315, roll: 0.15, elbow: 1.361, wrist: -0.046 } };
    const OP_L = { FLAP: { pitch: -1.105, roll: -0.078, elbow: 1.074, wrist: 0.031 }, FLAP_UP: { pitch: -1.555, roll: 0.078, elbow: 1.635, wrist: -0.08 }, FLAP2: { pitch: -0.976, roll: 0.08, elbow: 1.456, wrist: -0.48 }, FLAP2_UP: { pitch: -1.477, roll: 0.08, elbow: 1.875, wrist: -0.398 } };
    const OPW_R = [op(OP_REST, 60), op(OP_R.FLAP, 60), op(OP_R.FLAP_UP, 60), op(OP_R.FLAP2, 60), op(OP_R.FLAP2_UP, 60),
                   op(OP_R.ITEM_UP, 100), op(OP_R.ITEM, 100), op(OP_R.ITEM, 76), op(OP_R.ITEM_UP, 76), op(OP_R.OVER, 76), op(OP_R.IN, 76), op(OP_R.IN, 100), op(OP_R.OVER, 100), op(OP_REST, 60)];
    const OPW_L = [op(OP_REST, 60), op(OP_L.FLAP, 60), op(OP_L.FLAP_UP, 60), op(OP_L.FLAP2, 60), op(OP_L.FLAP2_UP, 60),
                   op(OP_REST, 60), op(OP_REST, 60), op(OP_REST, 60), op(OP_REST, 60), op(OP_REST, 60), op(OP_REST, 60), op(OP_REST, 60), op(OP_REST, 60), op(OP_REST, 60)];

    const RB = {
      // SO-ARM101 joints: shoulder_pan, shoulder_lift, elbow_flex, wrist_flex,
      // wrist_roll, gripper. At yaw 195 it reaches into the page, its base
      // servo toward the viewer. Its job: one cube, A to B and back.
      so: { k: 0.66, root: [88, 232], yaw: 195,
            folded: [0, 0.3, 1.2, 0.8, 0, 0],
            // the tool point is between the two jaw tips with the jaw closed
            // on the cube, 12 mm back so the cube sits IN the fingers
            task: { period: 14, W: SO_W, tcp: { body: 'gripper', off: [12.411, 0.531, -92.155] },
                    cubes: [{ size: 30, mat: MAT.red }], events: [{ cube: 0, at: 2, drop: 6 }, { cube: 0, at: 10, drop: 14 }] } },
      // Franka: seven hinges then the hand's two finger slides. Its job:
      // stack the two loose cubes on the third, then unstack them.
      fr: { k: 0.33, root: [24, 262], yaw: 130,
            folded: [0, 0, 0, -0.3, 0, 0.6, 0.785, 0.01, 0.01],
            task: { period: 24, W: FR_W, tcp: { body: 'hand', off: [0, 0, 103.4] },
                    cubes: [{ size: 50, mat: MAT.red, at: FR_P1 }, { size: 50, mat: MAT.green }, { size: 50, mat: MAT.blue }],
                    events: [{ cube: 1, at: 2, drop: 5 }, { cube: 2, at: 8, drop: 11 }, { cube: 2, at: 14, drop: 17 }, { cube: 1, at: 20, drop: 23 }] } },
      // the UR pair hangs from the frame's crossbar, UR_DX either side of the
      // centre, each facing the box between them (the left is the right
      // turned half a turn about the vertical, so one task serves both). The
      // job, Generalist's: pack the item into the box; the loop resets.
      ur: { k: UR_K, rootR: [FRAME_X + UR_DX, BAR_Y + 12, MOUNT_Z], rootL: [FRAME_X - UR_DX, BAR_Y + 12, MOUNT_Z], yawR: 270, yawL: 90,
            folded: [0.03, -1.7, -2.6, 2.4, 1.57, 0, 90],
            taskR: { period: 11, W: UR_W_R, tcp: { body: 'wrist3', off: [0, 230, 0] }, reset: true,
                     cubes: [{ size: 60, mat: MAT.green }], events: [{ cube: 0, at: 2, drop: 6 }] },
            taskL: { period: 11, W: UR_W_L, tcp: { body: 'wrist3', off: [0, 230, 0] }, reset: true,
                     cubes: [{ size: 60, mat: MAT.blue }], events: [{ cube: 0, at: 2, drop: 6 }] } },
      // The Ultra OP1: the Fairino FR20 on the cart's pedestal, holding its
      // flange out level at chest height (j4 -0.9, j5 1.57: solved for a
      // horizontal flange normal) with the unit on it. The Fairino holds
      // still while settled — the unit's arms do the work: fold the box's
      // four flaps up, then put the item in it; the loop resets.
      ul: { k: 0.17, root: ULTRA_ROOT, yaw: 62,
            rest: [0.3, -1.3, 2.2, -0.9, 1.57, 0],
            folded: [0.3, -1.6, 2.7, -0.9, 1.57, 0],
            unit: { period: 18, R: OPW_R, L: OPW_L, item: { at: 7, drop: 11 }, flaps: { R: [1, 2], F: [3, 4], L: [1, 2], B: [3, 4] } } },
    };
    RB.so.rest = SO_W[0]; RB.fr.rest = FR_W[0]; RB.ur.restR = UR_W_R[0]; RB.ur.restL = UR_W_L[0];
    // Atlas joint signs, from rendering poses through ?dev (see CLAUDE.md)
    // (l_arm_shx rolls the left arm in the frontal plane: -1.3 hangs it at
    // the side, +1.3 puts it straight up; l_arm_elx bends the elbow in that
    // same plane, so with the upper arm raised out at 45° the forearm swings
    // toward and away from the head — which IS a wave)
    const HUM_SHX_DOWN = -1.3;       // hanging at the side
    const HUM_ELX_REST = 0.35;       // a little bend at the elbow, hanging
    const HUM_ELX_FOLD = 0.9;        // bent a little more than at rest, packed (at 2.0 the forearms swung out sideways and the crouch was as wide as the stage)
    const HUM_WAVE_SHZ = 0, HUM_WAVE_SHX = 0.75, HUM_WAVE_ELY = 0, HUM_WAVE_ELX = 1.6;   // upper arm out and up, forearm up beside the head
    // ── the humanoid: Boston Dynamics' ATLAS, and its goodbye ───────────
    // The DRC-era Atlas (v5), from Drake's model — thirty revolute joints,
    // consumed by the forward kinematics in the bake's body order. A pose is
    // written by JOINT, keyed by the joint's CHILD LINK (the body that turns):
    // back_bkz → ltorso, back_bky → mtorso, back_bkx → utorso, neck_ay → head;
    // arms shz → clav, shx → scap, ely → uarm, elx → larm, uwy → ufarm,
    // mwx → lfarm, lwy → hand; legs hpz → uglut, hpx → lglut, hpy → uleg,
    // kny → lleg, aky → talus, akx → foot. `humQ` turns a map into q. Its
    // zero pose is a T: arms straight out to the sides; the root body is the
    // PELVIS, 0.93 m above the soles with the legs straight, so the standing
    // placement is lifted by that much off the floor point.
    const HUM = 'atlas', HUM_PELVIS = 930;
    const humQ = (robot, map) => { const q = []; for (const b of robot.bodies) if (b.axis) q.push(map[b.name] ?? 0); return q; };
    const humMap = (legs, torso, L, R) => ({ ...legs, ...torso, ...L, ...R });
    const legs = (hpy, kny, aky) => ({ l_uleg: hpy, r_uleg: hpy, l_lleg: kny, r_lleg: kny, l_talus: aky, r_talus: aky });
    // arms: [shz, shx, ely, elx, uwy, mwx, lwy] for the LEFT; the right mirrors shz, shx and elx
    const armL = ([shz, shx, ely, elx, uwy, mwx, lwy]) => ({ l_clav: shz, l_scap: shx, l_uarm: ely, l_larm: elx, l_ufarm: uwy, l_lfarm: mwx, l_hand: lwy });
    const armR = ([shz, shx, ely, elx, uwy, mwx, lwy]) => ({ r_clav: -shz, r_scap: -shx, r_uarm: ely, r_larm: -elx, r_ufarm: uwy, r_lfarm: -mwx, r_hand: lwy });
    const HUM_LEG = legs(-0.12, 0.25, -0.13);
    const HUM_ARM = [0, HUM_SHX_DOWN, 0, HUM_ELX_REST, 0, 0, 0];
    const HUM_REST = humMap(HUM_LEG, {}, armL(HUM_ARM), armR(HUM_ARM));
    const humWave = (elx, lwy, bkz) => humMap(HUM_LEG, { ltorso: bkz }, armL([HUM_WAVE_SHZ, HUM_WAVE_SHX, HUM_WAVE_ELY, elx, 0, 0, lwy]), armR(HUM_ARM));
    const HUM_UP = humWave(HUM_WAVE_ELX, 0, -0.1), HUM_A = humWave(HUM_WAVE_ELX - 0.45, 0.3, -0.12), HUM_B = humWave(HUM_WAVE_ELX + 0.35, -0.3, -0.12);
    // packed, as it comes out of the unit: crouched, arms folded in
    const HUM_FOLDED = humMap(legs(-1.2, 2.1, -0.9), { mtorso: 0.35 }, armL([0.3, HUM_SHX_DOWN, 0, HUM_ELX_FOLD, 0, 0, 0]), armR([0.3, HUM_SHX_DOWN, 0, HUM_ELX_FOLD, 0, 0, 0]));
    RB.hum = { k: 0.25, root: [10, 236], yaw: 255, restMap: HUM_REST, foldedMap: HUM_FOLDED,
               // stand, raise the hand, three waves, lower it, stand: 8 s
               waveMaps: [HUM_REST, HUM_REST, HUM_UP, HUM_A, HUM_B, HUM_A, HUM_B, HUM_A, HUM_B, HUM_UP, HUM_REST, HUM_REST], period: 8 };
    // the maps become q vectors once the robot is loaded (they need its body order)
    const humPoses = () => {
      if (RB.hum.rest) return RB.hum;
      const R = ROBOTS[HUM];
      RB.hum.rest = humQ(R, RB.hum.restMap); RB.hum.folded = humQ(R, RB.hum.foldedMap);
      RB.hum.wave = { period: RB.hum.period, W: RB.hum.waveMaps.map(m => humQ(R, m)) };
      return RB.hum;
    };
    const humQAt = (t, u) => {
      const H = humPoses(), q = taskQ(H.wave, taskPhase(H.wave, t, H.wave.W.length));
      return u >= 0.999 ? q : u <= 0.001 ? H.rest : lerpQ(H.rest, q, u);
    };
    const humBase = () => standing([RB.hum.root[0], RB.hum.root[1] - HUM_PELVIS * RB.hum.k], RB.hum.k, RB.hum.yaw);
    // the inverse of a placement (rotation x uniform scale, then translation)
    const invT = T => {
      const s2 = detScale(T.m) ** 2, M = T.m;
      const m = [M[0] / s2, M[3] / s2, M[6] / s2, M[1] / s2, M[4] / s2, M[7] / s2, M[2] / s2, M[5] / s2, M[8] / s2];
      return place(m, [-(m[0] * T.t[0] + m[1] * T.t[1] + m[2] * T.t[2]), -(m[3] * T.t[0] + m[4] * T.t[1] + m[5] * T.t[2]), -(m[6] * T.t[0] + m[7] * T.t[1] + m[8] * T.t[2])]);
    };
    // an arm mounted on a shoulder: standing, then tilted outward about the
    // stage's z (positive tilt leans a right-hand arm to the right; 180 hangs it)
    const shouldered = (root, k, yaw, tiltDeg) => { const B = standing(root, k, yaw); return place(mul(rotZ(tiltDeg * DEG), B.m), B.t); };
    const lerpQ = (A, B, u) => A.map((a, i) => a + (B[i] - a) * u);
    // the SO-ARM's bodies, in tree order, for growing it base first
    const SO_ORDER = ['base', 'shoulder', 'upper_arm', 'lower_arm', 'wrist', 'gripper', 'moving_jaw'];
    const growOrder = (order, t, lead, span) => {
      const out = {};
      order.forEach((name, i) => { out[name] = smooth(win(t, lead + (i / order.length) * span, span * 0.7)); });
      return out;
    };

    // ── one machine becoming another ────────────────────────────────────
    // The owner: "don't just have each one shrink away and then the next one
    // reappear". So a transition is a MORPH between two chains: each body of
    // the outgoing robot is paired with a body of the incoming one at the same
    // fraction along the chain, and over the act the outgoing body TRAVELS
    // from its own placement to its partner's (position and rotation
    // interpolated, the rotation re-orthonormalised) while it fades, and the
    // incoming body travels from the outgoing one's placement to its own while
    // it fades in. Base first, tip last. Every part is on screen throughout,
    // moving and turning into the part that replaces it.
    const detScale = A => Math.cbrt(Math.abs(A[0] * (A[4] * A[8] - A[5] * A[7]) - A[1] * (A[3] * A[8] - A[5] * A[6]) + A[2] * (A[3] * A[7] - A[4] * A[6]))) || 1;
    // `s0`/`s1` override the scales interpolated between (see drawMorph)
    const lerpM = (A, B, u, s0, s1) => {
      // interpolate, then pull the columns back to orthonormal, keeping scale
      const sA = detScale(A), sB = detScale(B);
      const M = new Array(9);
      for (let i = 0; i < 9; i++) M[i] = (A[i] / sA) * (1 - u) + (B[i] / sB) * u;
      // Gram-Schmidt on the columns
      let c0 = [M[0], M[3], M[6]], c1 = [M[1], M[4], M[7]];
      const n0 = Math.hypot(...c0) || 1; c0 = c0.map(x => x / n0);
      const d = c1[0] * c0[0] + c1[1] * c0[1] + c1[2] * c0[2];
      c1 = [c1[0] - d * c0[0], c1[1] - d * c0[1], c1[2] - d * c0[2]];
      const n1 = Math.hypot(...c1) || 1; c1 = c1.map(x => x / n1);
      const c2 = [c0[1] * c1[2] - c0[2] * c1[1], c0[2] * c1[0] - c0[0] * c1[2], c0[0] * c1[1] - c0[1] * c1[0]];
      const s = (s0 ?? sA) * (1 - u) + (s1 ?? sB) * u;
      return [c0[0] * s, c1[0] * s, c2[0] * s, c0[1] * s, c1[1] * s, c2[1] * s, c0[2] * s, c1[2] * s, c2[2] * s];
    };
    const lerpT = (A, B, u, s0, s1) => ({ m: lerpM(A.m, B.m, u, s0, s1), t: [A.t[0] + (B.t[0] - A.t[0]) * u, A.t[1] + (B.t[1] - A.t[1]) * u, A.t[2] + (B.t[2] - A.t[2]) * u] });
    // pair bodies by fraction along the chain
    const pairBodies = (from, to) => {
      const nA = from.bodies.length, nB = to.bodies.length;
      return from.bodies.map((b, i) => Math.round((i / Math.max(1, nA - 1)) * (nB - 1)));
    };
    // draw robot A turning into robot B. `u` 0..1 over the act; each body gets
    // its own window, base first (BODY_STAGGER of the act), so the machine
    // changes from the ground up.
    const BODY_STAGGER = 0.12;   // was 0.45: with the base already at B and the tip still at A, links travelled apart and floated loose
    // SIZE is matched on screen, not in the matrix: an SO-ARM servo at 0.66
    // px/mm and a Franka link at 0.33 are a similar size on the stage, so the
    // travelling body starts at the size of the part it replaces and grows or
    // shrinks into its own. Interpolating the matrix scale alone drew the
    // Franka's links at twice their size half way through the morph.
    function drawMorph(A, baseA, qA, B, baseB, qB, u) {
      const TA = bodyPlacements(A, baseA, qA), TB = bodyPlacements(B, baseB, qB);
      const pairAB = pairBodies(A, B), pairBA = pairBodies(B, A);
      const nA = A.bodies.length, nB = B.bodies.length;
      const kA = detScale(baseA.m), kB = detScale(baseB.m);
      const fit = (r0, r1) => clamp(r0 / r1, 0.25, 4);
      // outgoing bodies: travel to their partner, fade out
      for (const part of A.parts) {
        const i = A.index.get(part.body);
        const w = smooth(win(u, (i / Math.max(1, nA - 1)) * BODY_STAGGER, 1 - BODY_STAGGER));
        // the crossfade is SHORT (w 0.35-0.65): while a body is half-way it
        // is drawn twice, and the act with two arms becoming two arms was the
        // page's most expensive frame
        // it SHRINKS away (about its own joint), opaque, as its partner grows
        const a = 1 - smooth(win(w, 0.3, 0.4));
        if (a <= 0.04) continue;
        const j = pairAB[i];
        const T = w > 0 ? lerpT(TA[i], TB[j], w, kA, kB * fit(B.bodyRadius[j], A.bodyRadius[i])) : TA[i];
        const mat = MESH_MAT[part.mat] ?? MAT.neutral;
        submitMesh(part, a < 1 ? scaleT(T, a) : T, mat, 1, matLine[mat]);
      }
      // incoming bodies: arrive from their partner, fade in
      for (const part of B.parts) {
        const j = B.index.get(part.body);
        const w = smooth(win(u, (j / Math.max(1, nB - 1)) * BODY_STAGGER, 1 - BODY_STAGGER));
        const a = smooth(win(w, 0.3, 0.4));
        if (a <= 0.04) continue;
        const i = pairBA[j];
        const T = w < 1 ? lerpT(TA[i], TB[j], w, kA * fit(A.bodyRadius[i], B.bodyRadius[j]), kB) : TB[j];
        const mat = MESH_MAT[part.mat] ?? MAT.neutral;
        submitMesh(part, a < 1 ? scaleT(T, a) : T, mat, 1, matLine[mat]);
      }
    }

    // A HANDOVER, the morph used now (drawMorph above is kept for the record).
    // drawMorph flew each link of A to where a link of B stands; between two
    // different robots the links' ends never agree mid-flight, so the arm
    // came apart into floating pieces for half the act ("disappearing parts
    // / discontinuities"). Here both robots are ALWAYS whole chains drawn by
    // forward kinematics: A folds and slides its base onto B's while it
    // retracts tip-first into its base; B grows out of that same base,
    // base-first, unfolding into its pose. They overlap in time and place,
    // so one machine turns into the other without a gap, and every part is
    // opaque (see drawRobot).
    function drawHandover(A, baseA, qA0, qA1, B, baseB, qB0, qB1, u, slideTo = 1) {
      const nA = A.bodies.length, nB = B.bodies.length;
      const slide = slideTo * smooth(win(u, 0.0, 0.55));   // slideTo 0: A retracts where it stands (the UR hangs from a bar; a Franka sliding up to it left the stage)
      const bA = place(baseA.m, [baseA.t[0] + (baseB.t[0] - baseA.t[0]) * slide, baseA.t[1] + (baseB.t[1] - baseA.t[1]) * slide, baseA.t[2] + (baseB.t[2] - baseA.t[2]) * slide]);
      const gA = {};
      A.bodies.forEach((b, i) => { gA[b.name] = 1 - smooth(win(u, 0.38 + (1 - i / Math.max(1, nA - 1)) * 0.22, 0.2)); });
      drawRobot(A, bA, lerpQ(qA0, qA1, smooth(win(u, 0.0, 0.5))), 1, gA);
      const gB = {};
      B.bodies.forEach((b, j) => { gB[b.name] = smooth(win(u, 0.45 + (j / Math.max(1, nB - 1)) * 0.3, 0.2)); });
      drawRobot(B, baseB, lerpQ(qB0, qB1, smooth(win(u, 0.5, 0.5))), 1, gB);
    }

    // ── the robots WORK while the page is settled ───────────────────────
    // Each has a cycle of waypoints in joint space — reach, close, carry,
    // open, return — eased between, so the arm reads as doing a job rather
    // than swaying. `cycleQ` returns the pose at time t along a cycle of
    // `period` seconds; the gripper joint is driven separately where the
    // robot has one.
    const easeIO = t => t * t * (3 - 2 * t);
    function cycleQ(waypoints, period, t) {
      const n = waypoints.length;
      const phase = ((t % period) + period) % period / period * n;
      const i = Math.floor(phase), k = easeIO(phase - i);
      const a = waypoints[i], b = waypoints[(i + 1) % n];
      return a.map((x, j) => x + (b[j] - x) * k);
    }

    // ── TASKS: what a settled robot does, with real props ───────────────
    // A task is a loop of joint-space waypoints W (eased between over
    // `period` seconds, the gripper's value carried in W too), a tool point
    // (body + offset, mm), the cubes it handles, and EVENTS: cube c is picked
    // up at waypoint `at` and put down at waypoint `drop`. A cube rests at
    // the tool point of the waypoint it is next picked up at (or was last put
    // down at) and rides the tool point in between — so the gripper is on it
    // by construction. The waypoints were solved by IK offline
    // (scripts/ik-poses.mjs) from the cubes' positions in the robot's frame;
    // the rest pose every act morphs from and to is W[0].
    const tpOf = (T, off) => [T.m[0] * off[0] + T.m[1] * off[1] + T.m[2] * off[2] + T.t[0], T.m[3] * off[0] + T.m[4] * off[1] + T.m[5] * off[2] + T.t[1], T.m[6] * off[0] + T.m[7] * off[1] + T.m[8] * off[2] + T.t[2]];
    const toolPoint = (robot, base, q, tcp) => tpOf(bodyPlacements(robot, base, q)[robot.index.get(tcp.body)], tcp.off);
    const taskPhase = (task, t, n) => (((t % task.period) + task.period) % task.period) / task.period * n;
    // The pose along the loop: a cardinal spline THROUGH the waypoints
    // (Hermite, tangent = TENSION x the chord across each waypoint), so the
    // arm passes each one with velocity, not a stop. Easing every segment
    // to a halt — the first version — read as stop-motion; and a waypoint
    // repeated (the gripper closing) still holds the arm still, which is
    // where a real arm does pause.
    const TENSION = 0.42;
    const splineAt = (P0, P1, P2, P3, u) => {
      const u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      return P1.map((_, j) => h00 * P1[j] + h10 * TENSION * (P2[j] - P0[j]) + h01 * P2[j] + h11 * TENSION * (P3[j] - P1[j]));
    };
    const taskQ = (task, ph) => {
      const W = task.W, n = W.length, i = Math.floor(ph) % n, u = ph - Math.floor(ph);
      return splineAt(W[(i - 1 + n) % n], W[i], W[(i + 1) % n], W[(i + 2) % n], u);
    };
    // A loop that does not return to where it started (an item packed into a
    // box) RESETS over its last segment: the props fade, go back to their
    // first positions, and fade in.
    const taskReset = (task, ph, n) => {
      if (!task.reset) return { a: 1, ph };
      const r = ph - (n - 1);
      if (r <= 0) return { a: 1, ph };
      return r < 0.5 ? { a: 1 - r * 2, ph } : { a: (r - 0.5) * 2, ph: 0 };
    };
    function taskCubes(task, ph, tpAt, tpNow) {
      return task.cubes.map((c, ci) => {
        const evs = task.events.filter(e => e.cube === ci);
        let rest = c.at ? tpAt(c.at) : evs.length ? tpAt(task.W[evs[0].at]) : null;
        let held = false;
        for (const e of evs) { if (ph >= e.drop) rest = tpAt(task.W[e.drop]); if (ph >= e.at && ph < e.drop) held = true; }
        return { pos: held ? tpNow : rest, held, size: c.size, mat: c.mat };
      });
    }
    // a cube at a stage point, square to the robot's floor (its base rotation)
    const unitRot = m => { const k = detScale(m) || 1; return m.map(x => x / k); };
    function drawCube(pos, sizePx, R, mat, a) {
      if (a <= 0.01 || !pos) return;
      const T = place(R, pos);
      submit(boxFaces(sizePx, sizePx, sizePx, 0, 0, 0), T, mat, a);
      submitLines(boxWire(sizePx, sizePx, sizePx, 0, 0, 0), T, matLine[mat], LOOK.line * a, LOOK.width);
    }
    // one robot's task at time t: its joints and where its cubes are. `u` is
    // the settle blend (below): 1 is the task live, 0 is its rest frame, and
    // in between the joints and the cubes travel linearly to rest — so a
    // scroll never snaps a robot out of the middle of a move.
    function taskState(robot, base, task, t, u = 1) {
      const n = task.W.length;
      const st = ph0 => {
        const { a, ph } = taskReset(task, ph0, n);
        const q = taskQ(task, ph0);
        const tpAt = qq => toolPoint(robot, base, qq, task.tcp);
        return { q, ph, a, cubes: taskCubes(task, ph, tpAt, tpAt(q)), R: R_UP, k: detScale(base.m) };
      };
      if (u <= 0.001) return st(0);
      const live = st(taskPhase(task, t, n));
      if (u >= 0.999) return live;
      const rest = st(0);
      return { ...live, q: lerpQ(rest.q, live.q, u), a: rest.a + (live.a - rest.a) * u,
               cubes: live.cubes.map((c, i) => ({ ...c, pos: c.pos && rest.cubes[i].pos ? c.pos.map((x, j) => rest.cubes[i].pos[j] + (x - rest.cubes[i].pos[j]) * u) : c.pos })) };
    }
    function drawCubes(st, alpha) {
      for (const c of st.cubes) drawCube(c.pos, c.size * st.k, st.R, c.mat, alpha * st.a);
    }
    // the box the UR pair packs: under the right arm's drop point
    function drawPackBox(base, alpha) {
      const d = toolPoint(ROBOTS.ur5e, base, UR_W_R[6], RB.ur.taskR.tcp);
      const k = detScale(base.m);
      drawOpenBox([d[0], d[1] + 80 * k, d[2]], 240, 240, 160, R_UP, k, MAT.iron, alpha);
    }
    // the OP1's job, in the unit's frame: the box's flaps and the item
    const OPB = { BZ: -200, BX: 210, BW: 300, BD: 180, BH: 120 };
    const lerpArm = (A, B, k) => ({ pitch: A.pitch + (B.pitch - A.pitch) * k, roll: A.roll + (B.roll - A.roll) * k, elbow: A.elbow + (B.elbow - A.elbow) * k, wrist: A.wrist + (B.wrist - A.wrist) * k, open: A.open + (B.open - A.open) * k });
    const ARM_KEYS = ['pitch', 'roll', 'elbow', 'wrist', 'open'];
    const armArr = P => ARM_KEYS.map(k => P[k]);
    const armObj = q => Object.fromEntries(ARM_KEYS.map((k, i) => [k, q[i]]));
    // The Fairino SWAYS between jobs — lifts the unit a little and turns —
    // only while the small arms are off the props (the last two waypoints
    // and the reset), so nothing it carries misses what it is reaching for.
    const fairinoSway = ph => {
      const n = RB.ul.unit.R.length;
      const w = ph > n - 2.6 ? Math.sin(Math.PI * clamp((ph - (n - 2.6)) / 2.6, 0, 1)) : 0;
      return RB.ul.rest.map((x, i) => x + w * [0.12, 0.05, -0.08, 0.04, 0, 0][i]);
    };
    function unitTaskState(TU, t, u = 1) {
      const task = RB.ul.unit, n = task.R.length;
      const st = ph0 => {
        const { a, ph } = taskReset({ reset: true }, ph0, n);
        const at = (Wa, i) => { const j = Math.floor(i) % n, f = i - Math.floor(i); return armObj(splineAt(armArr(Wa[(j - 1 + n) % n]), armArr(Wa[j]), armArr(Wa[(j + 1) % n]), armArr(Wa[(j + 2) % n]), f)); };
        const PR = at(task.R, ph0), PL = at(task.L, ph0);
        const tcpR = P => smallArmFrames(TU, P, 1).tcp;
        let itemPos = tcpR(task.R[task.item.at]), held = false;
        if (ph >= task.item.drop) itemPos = tcpR(task.R[task.item.drop]);
        if (ph >= task.item.at && ph < task.item.drop) { held = true; itemPos = tcpR(PR); }
        const fold = ([i0, i1]) => smooth(clamp((ph - i0) / (i1 - i0), 0, 1));
        return { PR, PL, a, itemPos, held, q: fairinoSway(ph0), flaps: { R: fold(task.flaps.R), F: fold(task.flaps.F), L: fold(task.flaps.L), B: fold(task.flaps.B) } };
      };
      if (u <= 0.001) return st(0);
      const live = st(taskPhase(task, t, n));
      if (u >= 0.999) return live;
      const rest = st(0);
      const mix = (A, B) => A + (B - A) * u;
      return { PR: lerpArm(rest.PR, live.PR, u), PL: lerpArm(rest.PL, live.PL, u), a: mix(rest.a, live.a), held: live.held,
               itemPos: rest.itemPos.map((x, j) => mix(x, live.itemPos[j])), q: lerpQ(rest.q, live.q, u),
               flaps: { R: mix(rest.flaps.R, live.flaps.R), F: mix(rest.flaps.F, live.flaps.F), L: mix(rest.flaps.L, live.flaps.L), B: mix(rest.flaps.B, live.flaps.B) } };
    }
    // arriving / leaving, the packing table and its box GROW about the table
    // top's centre, opaque, instead of fading in as a ghost
    function growUnitProps(TU, st, g) {
      if (g <= 0.03) return;
      drawUnitProps(g < 1 ? scaleAbout(TU, g, tpOf(TU, [OPB.BX, 0, OPB.BZ - 24])) : TU, st, 1);
    }
    function drawUnitProps(TU, st, alpha) {
      if (alpha <= 0.01) return;
      const { BZ, BX, BW, BD, BH } = OPB;
      const k = detScale(TU.m);
      // the packing table under the box, its legs down to the floor
      submit(boxFaces(340, 500, 36, BX, 0, BZ - 24), TU, MAT.poly, alpha);
      submitLines(boxWire(340, 500, 36, BX, 0, BZ - 24), TU, matLine[MAT.poly], LOOK.line * alpha, LOOK.width);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const c = tpOf(TU, [BX + sx * 150, sy * 230, BZ - 42]);
        const h = FLOOR_Y - c[1];
        if (h > 2) { const F = place(IDENT, [0, 0, 0]); submit(boxFaces(5, h, 5, c[0], c[1] + h / 2, c[2]), F, MAT.steel, alpha); submitLines(boxWire(5, h, 5, c[0], c[1] + h / 2, c[2]), F, matLine[MAT.steel], LOOK.line * alpha, LOOK.width); }
      }
      const a = alpha * st.a;
      if (a <= 0.01) return;
      // the box: a base plate, and a flap hinged on each edge, lying flat
      // outward until an arm folds it up
      submit(boxFaces(BD, BW, 6, BX, 0, BZ - 3), TU, MAT.iron, a);
      submitLines(boxWire(BD, BW, 6, BX, 0, BZ - 3), TU, matLine[MAT.iron], LOOK.line * a, LOOK.width);
      const flap = (hinge, M, w, d, cx, cy) => {
        const F = chain(TU, place(M, hinge));
        submit(boxFaces(w, d, 6, cx, cy, 3), F, MAT.iron, a);
        submitLines(boxWire(w, d, 6, cx, cy, 3), F, matLine[MAT.iron], LOOK.line * a, LOOK.width);
      };
      const H = 90 * DEG;
      flap([BX, BW / 2, BZ], rotX(st.flaps.R * H), BD, BH, 0, BH / 2);
      flap([BX, -BW / 2, BZ], rotX(-st.flaps.L * H), BD, BH, 0, -BH / 2);
      flap([BX + BD / 2, 0, BZ], rotY(-st.flaps.F * H), BH, BW, BH / 2, 0);
      flap([BX - BD / 2, 0, BZ], rotY(st.flaps.B * H), BH, BW, -BH / 2, 0);
      drawCube(st.itemPos, 80 * k, R_UP, MAT.alu, a);
    }

    // ── act 1 (right): the motor becomes the SO-ARM101 ──────────────────
    function drawSoArmAct(t) {
      const a = smooth(win(t, 0.0, 0.36));
      // In this camera a POSITIVE pitch looks UP from below (a floor point
      // toward the viewer lands higher on screen than one away — checked
      // numerically). Every act tipped up by +10..+28 for two releases and the
      // owner saw the robots "from under angles"; the work is looked DOWN on
      // now, and each act starts at the pitch the last one ended on.
      setCam(16 * DEG, (14 - 22 * a) * DEG, 30 * (1 - a));
      // the motor swings round and shrinks down to where the SO-ARM's base
      // servo sits — a servo IS a small motor — then hands over
      const shrink = smooth(win(t, 0.30, 0.34));
      if (shrink < 1) {
        const k = MOTOR_K_MAX * (1 - a) + 0.40 * a * (1 - 0.72 * shrink);
        const tilt = mul(rotX(66 * (1 - a) * DEG), rotY(30 * (1 - a) * DEG));
        const goal = soServo();
        const pos = [goal[0] * a, 10 + (goal[1] - 10) * a, 0];
        const base = chain(place(IDENT, pos), place(mul(tilt, scaleM(k)), [0, 0, 0]));
        const roll = chain(base, place(rotZ(ROLL * (1 - a)), [0, 0, 0]));
        const propA = 1 - win(t, 0.03, 0.18);
        const ma = 1 - shrink;
        for (let i = 0; i < MOTOR.length; i++) {
          const part = MOTOR[i];
          const pa = (part.id === 'prop' ? propA : 1) * ma;
          if (pa <= 0.01) continue;
          const T = chain(roll, place(rotZ(part.spins ? SPIN : 0), [0, 0, 0]));
          const mat = part.mat || MAT.neutral;
          submit(part.solids, T, mat, pa);
          submitLines(part.polys, T, matLine[mat], LOOK.line * pa, LOOK.width);
        }
        const C = chain(roll, place(rotZ(SPIN), [0, 0, 0]));
        submit(surface([[-76, 42], [-68, 60], [-56, 64], [-45, 50]], 20), C, MAT.copper, ma);
        submit(surface([[45, 50], [56, 64], [68, 60], [76, 42]], 20), C, MAT.copper, ma);
      }
      // the arm grows out of the servo, base first, unfolding to its pose;
      // its cube arrives with it, and once settled it moves the cube
      const base = standing(RB.so.root, RB.so.k, RB.so.yaw);
      if (t >= 1) {
        const st = taskState(ROBOTS.soarm, base, RB.so.task, idleT, settleU);
        drawRobot(ROBOTS.soarm, base, st.q, 1);
        drawCubes(st, 1);
      } else {
        const gr = growOrder(SO_ORDER, t, 0.34, 0.5);
        drawRobot(ROBOTS.soarm, base, lerpQ(RB.so.folded, RB.so.rest, smooth(win(t, 0.5, 0.5))), 1, gr);
        drawCubes(taskState(ROBOTS.soarm, base, RB.so.task, 0), smooth(win(t, 0.8, 0.2)));
      }
      flush();
    }
    // where the SO-ARM's base servo sits on the stage — the motor lands there
    function soServo() {
      const robot = ROBOTS.soarm;
      const i = robot.parts.findIndex(p => p.body === 'base' && p.mat === 'black' && /^sts/.test(p.name || ''));
      const T = standing(RB.so.root, RB.so.k, RB.so.yaw);
      const c = robot.centroids[i < 0 ? 0 : i];
      return [T.m[0] * c[0] + T.m[1] * c[1] + T.m[2] * c[2] + T.t[0], T.m[3] * c[0] + T.m[4] * c[1] + T.m[5] * c[2] + T.t[1], T.m[6] * c[0] + T.m[7] * c[1] + T.m[8] * c[2] + T.t[2]];
    }

    // ── act 2 (right): the SO-ARM101 becomes a Franka Research 3 ───────
    function drawFrankaAct(t) {
      const u = smooth(t);
      // the view tips down to 24 as the Franka arrives, to see the cubes on
      // the floor in front of it (at 12 they hid behind one another)
      setCam((16 + 4 * u) * DEG, (-8 - 10 * u) * DEG, 0);     // from (16, -8), down to -18 over the cubes
      // the small arm TURNS INTO the big one: body by body from the base, each
      // SO-ARM part travels to where its Franka counterpart stands and becomes
      // it (drawMorph), while the Franka unfolds from its packed pose into its
      // working one. The SO-ARM's cube goes as the arm does; the Franka's
      // three cubes arrive as it finishes. Settled, it stacks them.
      const soBase = standing(RB.so.root, RB.so.k, RB.so.yaw);
      const frBase = standing(RB.fr.root, RB.fr.k, RB.fr.yaw);
      if (t >= 1) {
        const st = taskState(ROBOTS.fr3, frBase, RB.fr.task, idleT, settleU);
        drawRobot(ROBOTS.fr3, frBase, st.q, 1);
        drawCubes(st, 1);
      } else {
        drawHandover(ROBOTS.soarm, soBase, RB.so.rest, RB.so.folded, ROBOTS.fr3, frBase, RB.fr.folded, RB.fr.rest, win(t, 0.02, 0.96));
        drawCubes(taskState(ROBOTS.soarm, soBase, RB.so.task, 0), 1 - smooth(win(t, 0.02, 0.25)));
        drawCubes(taskState(ROBOTS.fr3, frBase, RB.fr.task, 0), smooth(win(t, 0.78, 0.2)));
      }
      flush();
    }

    // ── act 3 (right): the Franka becomes Generalist's UR pair ──────────
    function drawURPairAct(t) {
      const u = smooth(t);
      setCam((20 - 2 * u) * DEG, (-18 - 4 * u) * DEG, 0);    // from (20, -18), where the Franka's act ended
      // the Franka BECOMES the right UR arm (drawMorph, base first) as the
      // frame rises round it; the left arm then unfolds from its mount to
      // make the pair. The Franka's cubes go, the table's box and items come.
      // Settled, each arm packs its item into the box.
      const frBase = standing(RB.fr.root, RB.fr.k, RB.fr.yaw);
      const rBase = leaning(RB.ur.rootR, RB.ur.k, RB.ur.yawR), lBase = leaning(RB.ur.rootL, RB.ur.k, RB.ur.yawL);
      drawFrame(smooth(win(t, 0.4, 0.4)), 1);            // after the Franka has folded away (it rose through the growing table)
      const live = t >= 1 ? settleU : 0;
      const stR = taskState(ROBOTS.ur5e, rBase, RB.ur.taskR, idleT, live), stL = taskState(ROBOTS.ur5e, lBase, RB.ur.taskL, idleT, live);
      const propsA = t >= 1 ? 1 : smooth(win(t, 0.7, 0.3));
      drawPackBox(rBase, propsA);
      if (t >= 1) {
        drawUR(rBase, stR.q, 1); drawUR(lBase, stL.q, 1);
        drawCubes(stR, 1); drawCubes(stL, 1);
      } else {
        const h = win(t, 0.02, 0.8);
        drawHandover(ROBOTS.fr3, frBase, RB.fr.rest, RB.fr.folded, ROBOTS.ur5e, rBase, RB.ur.folded, RB.ur.restR, h, 0);
        // the gripper grows on the arriving arm's wrist once the wrist is there
        const qr = lerpQ(RB.ur.folded, RB.ur.restR, smooth(win(h, 0.5, 0.5)));
        const ga = smooth(win(h, 0.8, 0.2));
        if (ga > 0.03) drawURGripper(scaleT(bodyPlacements(ROBOTS.ur5e, rBase, qr)[ROBOTS.ur5e.index.get('wrist3')], ga), 90, 1);
        const gL = smooth(win(t, 0.5, 0.4));
        if (gL > 0.01) drawUR(leaning(RB.ur.rootL, RB.ur.k * (0.4 + 0.6 * gL), RB.ur.yawL), lerpQ(RB.ur.folded, RB.ur.restL, smooth(win(t, 0.6, 0.4))), gL);
        drawCubes(taskState(ROBOTS.fr3, frBase, RB.fr.task, 0), 1 - smooth(win(t, 0.02, 0.25)));
        drawCubes(stR, propsA); drawCubes(stL, propsA);
      }
      flush();
    }

    // ── act 4 (right): the workcell becomes the Ultra OP1 ───────────────
    // The frame and table fade as the cart comes; the Fairino rises from the
    // cart's pedestal body by body (as the SO-ARM grew from its servo),
    // unfolding to hold its flange out level; the two UR arms travel to the
    // unit's shoulders, shrinking, and the unit's own arms fade in as they
    // arrive. The packing table and the flat box arrive last.
    function drawUltraAct(t) {
      const u = smooth(t);
      setCam((18 - 2 * u) * DEG, (-22 - 4 * u) * DEG, 0);    // from (18, -22); down to -26 over the box on the table
      const m = smooth(win(t, 0.05, 0.5));
      // props GROW and SHRINK in place rather than fading: a half-transparent
      // frame and table showed everything behind them, ghost-like
      drawFrame(1 - m, 1);
      drawCart(m, 1);
      const base = standing(RB.ul.root, RB.ul.k, RB.ul.yaw);
      const rBase = leaning(RB.ur.rootR, RB.ur.k, RB.ur.yawR), lBase = leaning(RB.ur.rootL, RB.ur.k, RB.ur.yawL);
      // the unit's frame at REST: where the URs are heading, where the box goes
      const Tf = bodyPlacements(ROBOTS.ultra, base, RB.ul.rest)[ROBOTS.ultra.index.get('wrist3_link')];
      const TU = unitFrame(chain(Tf, place(IDENT, [0, 0, 120])), RB.ul.k);
      if (t >= 1) {
        const st = unitTaskState(TU, idleT, settleU);
        drawUltraRobot(base, st.q, st.PR, st.PL, 1);
        drawUnitProps(TU, st, 1);
        flush();
        return;
      }
      const gone = 1 - smooth(win(t, 0.02, 0.25));
      if (gone > 0.01) {
        const stR0 = taskState(ROBOTS.ur5e, rBase, RB.ur.taskR, 0), stL0 = taskState(ROBOTS.ur5e, lBase, RB.ur.taskL, 0);
        drawPackBox(rBase, gone); drawCubes(stR0, gone); drawCubes(stL0, gone);
      }
      const gr = growOrder(UL_ORDER, t, 0.12, 0.62);
      const q = lerpQ(RB.ul.folded, RB.ul.rest, smooth(win(t, 0.3, 0.6)));
      const armIn = smooth(win(t, 0.62, 0.3));
      drawUltraRobot(base, q, RB.ul.unit.R[0], RB.ul.unit.L[0], 1, gr, armIn);
      const travel = smooth(win(t, 0.25, 0.65));
      const out = 1 - smooth(win(t, 0.6, 0.3));
      if (out > 0.01) {
        for (const [root, yaw, rest, side] of [[RB.ur.rootR, RB.ur.yawR, RB.ur.restR, 1], [RB.ur.rootL, RB.ur.yawL, RB.ur.restL, -1]]) {
          const sh = tpOf(TU, [0, side * UNIT.SY, UNIT.SZ]);
          const pos = [root[0] + (sh[0] - root[0]) * travel, root[1] + (sh[1] - root[1]) * travel, root[2] + (sh[2] - root[2]) * travel];
          drawUR(leaning(pos, RB.ur.k * (1 - 0.7 * travel), yaw, LEAN * (1 - travel)), rest, out);
        }
      }
      growUnitProps(TU, unitTaskState(TU, 0), smooth(win(t, 0.75, 0.25)));
      flush();
    }

    // ── act 5: the OP1 becomes a humanoid, and it waves goodbye ─────────
    // The last page boundary, into Get In Touch. The cart and the props go
    // first; the Fairino folds down into its pedestal and fades; the UNIT —
    // Ultra's torso with the ZED for eyes — lifts off the flange and travels
    // to where the G1 will stand, growing to its size, and the G1 grows out
    // of it: torso first (the unit IS its torso), then waist and pelvis,
    // legs down and arms out, unfolding from a crouch to standing as it
    // arrives. Its base is placed each frame so that its torso IS the
    // travelling frame (`gBase`), which is what makes it one object becoming
    // another rather than two fading past each other. Settled, it waves.
    const HUM_ORDER = ['utorso', 'mtorso', 'ltorso', 'pelvis', 'head', 'hokuyo_link', 'l_clav', 'r_clav', 'l_scap', 'r_scap',
      'l_uglut', 'r_uglut', 'l_uarm', 'r_uarm', 'l_lglut', 'r_lglut', 'l_larm', 'r_larm', 'l_uleg', 'r_uleg',
      'l_ufarm', 'r_ufarm', 'l_lleg', 'r_lleg', 'l_lfarm', 'r_lfarm', 'l_talus', 'r_talus', 'l_hand', 'r_hand', 'l_foot', 'r_foot'];
    // a faint ring on the floor under the feet: the pelvis frame's z is up,
    // so the floor is HUM_PELVIS below it
    function drawFloorMark(base, a) {
      if (a <= 0.01) return;
      submitLines([ringAt(420, 0, 0, -HUM_PELVIS, 40)], base, ink, LOOK.line * 0.45 * a, LOOK.width);
    }
    function drawHumanoidAct(t) {
      const u = smooth(t);
      setCam((16 - 2 * u) * DEG, (-26 + 20 * u) * DEG, 0);   // from the OP1's (16, -26) to (14, -6): a standing figure is met near eye level, not looked down on
      const base = humBase(), H = humPoses();
      const g1 = ROBOTS[HUM], torso = g1.index.get('utorso');
      if (t >= 1) {
        drawFloorMark(base, 1);
        drawRobot(g1, base, humQAt(idleT, settleU), 1);
        flush();
        return;
      }
      const ulBase = standing(RB.ul.root, RB.ul.k, RB.ul.yaw);
      const gone = 1 - smooth(win(t, 0.02, 0.3));
      drawCart(gone, 1);
      const Tf = bodyPlacements(ROBOTS.ultra, ulBase, RB.ul.rest)[ROBOTS.ultra.index.get('wrist3_link')];
      const TU = unitFrame(chain(Tf, place(IDENT, [0, 0, 120])), RB.ul.k);
      growUnitProps(TU, unitTaskState(TU, 0), gone);
      const fa = 1 - smooth(win(t, 0.12, 0.4));
      if (fa > 0.01) drawRobot(ROBOTS.ultra, ulBase, lerpQ(RB.ul.rest, RB.ul.folded, smooth(win(t, 0.08, 0.45))), fa, { zed: 0 });
      const travel = smooth(win(t, 0.12, 0.6));
      const Tt = bodyPlacements(g1, base, H.rest)[torso];
      const TL = lerpT(TU, Tt, travel, RB.ul.k, RB.hum.k);
      const ua = 1 - smooth(win(t, 0.45, 0.3));
      if (ua > 0.03) drawUnit(scaleT(TL, ua), RB.ul.unit.R[0], RB.ul.unit.L[0], 1);
      const ga = smooth(win(t, 0.38, 0.25));
      if (ga > 0.03) {
        const q = lerpQ(H.folded, H.rest, smooth(win(t, 0.3, 0.42)));
        const Tq = bodyPlacements(g1, base, q)[torso];
        const gBase = chain(TL, invT(chain(invT(base), Tq)));
        // the trunk grows about the torso (where the unit is shrinking), and
        // the limbs grow out of it joint by joint, parent first — scale, not
        // fade: a growing body's scale carries into its children, so the
        // Atlas's root (the PELVIS) and the trunk above it must be whole
        // before a limb can show
        const gr = growOrder(HUM_ORDER.slice(6), t, 0.42, 0.34);
        drawRobot(g1, scaleAbout(gBase, ga, TL.t), q, 1, gr);
      }
      drawFloorMark(base, smooth(win(t, 0.72, 0.28)));
      flush();
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
        const pos = [P_2R.root[0] * a, 10 + (P_2R.root[1] - 10) * a, 0];
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
      // the motor shrinks down into the shoulder servo, which is what an
      // SO-ARM101's joints are — small motors — while the printed arm fades in
      const shrink = smooth(win(t, 0.40, 0.36));
      const P = { ...P_2R,
        base: smooth(win(t, 0.24, 0.26)),
        motor: a * (1 - shrink),
        motorK: 1 - 0.7 * shrink,
        skinA: smooth(win(t, 0.36, 0.3)),
        q: [-90 + (P_2R.q[0] + 90) * smooth(win(t, 0.32, 0.45)), P_2R.q[1] * smooth(win(t, 0.56, 0.40)), 0],
        grow: [smooth(win(t, 0.32, 0.26)), smooth(win(t, 0.56, 0.26)), 0],
        elbow: smooth(win(t, 0.52, 0.14)),
        grip: smooth(win(t, 0.78, 0.16)),
        open: 5 + 5 * smooth(win(t, 0.88, 0.12)),
      };
      armChain(t >= 1 ? workP(P_2R) : { ...P, style: 'soarm' });
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
      // the third link and the wrist joints arrive over the second half, and
      // the printed servo arm is re-skinned as a Franka in the middle of it
      P.wrist = smooth(win(t, 0.34, 0.4));
      P.grow[2] = smooth(win(t, 0.46, 0.4));
      P.yawJoint = smooth(win(t, 0.2, 0.3));
      P.blend = smooth(win(t, 0.22, 0.5));
      armChain(t >= 1 ? workP(P_6D) : P);
      flush();
    }

    // ── act 3: the 6-DOF arm becomes a bimanual robot ───────────────────
    // A torso rises under it with a sensor head, the arm moves onto the right
    // shoulder, and a second arm grows on the left. They work out of phase.
    function drawBimanualAct(t) {
      const u = smooth(t);
      setCam((22 - 2 * u) * DEG, (14 - 2 * u) * DEG, 0);
      const stand = smooth(win(t, 0.12, 0.36));
      drawStand(stand, 1);
      const R = lerpP(P_6D, P_BI_R, u);
      R.blend = smooth(win(t, 0.25, 0.45));
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
      const t0 = PERF ? performance.now() : 0;
      ctx.setTransform(dpr * fit, 0, 0, dpr * fit, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      segs = 0; calls = 0; flushMs = 0; flips = 0;
      const s = reduce ? Infinity : heroPhase(y);
      if (s < S_ART) prelude(s);
      else if (reduce) art();
      else {
        const { i, t } = actAt(y);
        if (i < 0) art();
        else if (isLeft) {
          // the camera: explode to the sensor, run the model on its pixels,
          // return detections, then build a world model out of them
          if (i === 0) drawCameraAct(t);
          else if (i === 1) drawInferAct(t);
          else if (i === 2) drawDetectAct(t);
          else if (i === 3) drawWorldAct(t);
          else drawWorldAct(1);          // the simulator holds through the last act; the goodbye is the right's
        } else if (ROBOTS) {
          if (i === 0) drawSoArmAct(t);
          else if (i === 1) drawFrankaAct(t);
          else if (i === 2) drawURPairAct(t);
          else if (i === 3) drawUltraAct(t);
          else drawHumanoidAct(t);
        } else if (i === 0) drawMotorAct(t);
        else if (i === 1) drawArm6Act(t);
        else drawBimanualAct(i === 2 ? t : 1);
      }
      ctx.globalAlpha = 1;
      // A debug read-out, and a DOM write: skipped while the settled loop is
      // running so "hold still and count mutations" still measures the page
      // rather than this attribute.
      if (!idleOn) canvas.dataset.segs = String(segs);
      if (PERF) { canvas.dataset.ms = (performance.now() - t0).toFixed(2); canvas.dataset.flush = flushMs.toFixed(2); canvas.dataset.calls = String(calls); canvas.dataset.segs = String(segs); canvas.dataset.flips = String(flips); }
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
      // The floor is every OTHER frame (32ms): drawing every frame was tried
      // — a 6ms draw on top of Firefox's own scroll work overran the 16.7ms
      // budget and a quarter of frames ran long (p90 17 → 33ms). The
      // multiplier is 2x, not the 8x it was, which had put the acts at
      // 12-25fps: that was the lag the owner saw while scrolling.
      let MIN_MS = 32;
      let lastDraw = -1e9, pendingY = 0;
      const paint = yy => {
        lastY = yy;
        const t0 = performance.now();
        draw(yy);
        MIN_MS = clamp((performance.now() - t0) * 2.0, 32, 80);
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
    // in a held state; rAF stops it dead when the tab is hidden, and it is
    // never started under reduced motion. It runs at FRAME RATE, with a frame
    // skipped after any draw that cost more than a third of one: the 20fps it
    // ran at read as lag once the robots were doing real work. A phone takes
    // every other frame.
    // When the page MOVES, the robots do not snap to rest: `settleU` eases
    // from 1 to 0 over RETURN_MS and every task blends its live pose and
    // props toward its rest frame by it (taskState's `u`), the loop running
    // until it gets there. Settling again mid-return picks up where it was;
    // settling fresh starts the clock at 0, whose pose IS the rest frame, so
    // the start is continuous too. (Before this the arm jumped from
    // mid-reach to rest the instant the page scrolled.)
    const IDLE_SKIP_MS = 6;
    let idleCost = 0;                         // EMA of the settled draw's cost, ms
    // dev (?perf): a harness sets the task clock — with ?idledt tiny it stays
    if (PERF) window['__f3dT_' + side] = t => { idleT = t; settleU = 1; };
    const IDLE_STRIDE = window.innerWidth < 992 ? 2 : 1;
    const RETURN_MS = 700;
    let idleRAF = 0, idleTimer = 0, idlePrev = 0, idleWait = 0, returning = 0;
    const idleStep = () => {
      idleRAF = 0;
      if (!idleOn && !returning) return;
      if (idleWait > 0) { idleWait--; idleSchedule(); return; }
      const now = performance.now();
      const dt = IDLE_DT ? IDLE_DT : idlePrev ? Math.min(0.25, (now - idlePrev) / 1000) : 0;
      idlePrev = now;
      if (idleOn) { idleT += dt; settleU = Math.min(1, settleU + dt / 0.45); }
      else {
        const r = (now - returning) / RETURN_MS;
        settleU = returnFrom * (1 - smooth(clamp(r, 0, 1)));
        if (r >= 1) { returning = 0; settleU = 0; }
      }
      if (held(lastY)) draw(lastY);
      if (!idleOn && !returning) { idlePrev = 0; return; }
      // ADAPTIVE: the settled loop skips frames in proportion to what a draw
      // costs on THIS machine — one for every IDLE_SKIP_MS of it, up to three
      // (60 → 30 → 20 → 15fps) — so a slow machine spends the same share of
      // its frame on the robots as a fast one. A fixed "skip one over 6ms"
      // left a 20ms draw on a 30fps schedule, two thirds of every frame.
      // Fast down, slow up: one slow draw (the first after a mesh arrives, a
      // GC pause) must not set the rate for seconds, a slow machine should.
      const c = performance.now() - now;
      idleCost = c < idleCost ? c : idleCost * 0.6 + c * 0.4;
      idleWait = (IDLE_STRIDE - 1) + Math.min(3, Math.floor(idleCost / IDLE_SKIP_MS));
      idleSchedule();
    };
    let returnFrom = 1;
    const idleSchedule = () => { if (!idleRAF) idleRAF = requestAnimationFrame(idleStep); };
    const stopIdle = () => {
      idleOn = false; idlePrev = 0; returning = 0; settleU = 0;
      if (idleRAF) { cancelAnimationFrame(idleRAF); idleRAF = 0; }
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
    };
    const stopSettle = reduce ? null : onSettle(on => {
      if (on === idleOn) return;
      if (on) {
        if (!held(lastY)) return;           // mid-morph or mid-act: nothing to idle
        if (!returning) { idleT = 0; settleU = 0; }
        returning = 0; idleOn = true; idlePrev = 0; idleSchedule();
      } else {
        idleOn = false;
        if (lastY >= 0 && settleU > 0.01 && held(lastY)) { returning = performance.now(); returnFrom = settleU; idlePrev = 0; idleSchedule(); }
        else { stopIdle(); if (lastY >= 0) draw(lastY); }
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
