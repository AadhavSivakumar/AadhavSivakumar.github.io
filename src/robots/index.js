// The machines the flourishes turn into — three robots on the right, the
// RealSense D435i camera on the left — baked from their MuJoCo Menagerie
// descriptions by scripts/bake-robots.mjs. This module loads
// them (lazily — three JSON chunks, fetched when the flourish mounts), prepares
// each part for the renderer, and does the forward kinematics.
//
// Coordinates: the bake is in millimetres, Z up, as MuJoCo has them. The
// renderer's stage is x right, y DOWN, z toward the viewer, so a robot is
// placed through `standing()`, which turns Z-up into screen-up and scales
// millimetres to stage pixels.

const TAU = Math.PI * 2;

export const ROBOT_IDS = ['soarm', 'fr3', 'ur5e', 'd435i'];

let loading = null;
export function loadRobots() {
  if (!loading) {
    loading = Promise.all([
      import('./soarm.json'),
      import('./fr3.json'),
      import('./ur5e.json'),
      import('./d435i.json'),
    ]).then(mods => {
      const out = {};
      mods.forEach((m, i) => { out[ROBOT_IDS[i]] = prepare(m.default || m); });
      return out;
    });
  }
  return loading;
}

// Everything the renderer needs beyond vertices and faces is derived here,
// once, at load: face normals; SMOOTH vertex normals (the area-weighted
// average of the faces around a vertex — shading a face by the mean of its
// three vertex normals is what turns a faceted decimation into a smooth
// surface); every manifold edge with its two faces, for the silhouette; and
// which edges are CREASES (dihedral over CREASE_DEG), the only interior lines
// a sim-style render draws. Facets are not creases.
// Per robot: the SO-ARM is boxy printed parts whose 90° edges ARE its
// drawing; the Franka, the URs and the camera are organic shells, and on
// those a lower threshold catches decimation facets at the rounded ends and
// draws a lattice across them.
const CREASE_DEG = { soarm: 62, fr3: 76, ur5e: 76, d435i: 78 };
function prepare(robot) {
  const creaseDeg = CREASE_DEG[robot.id] ?? 70;
  const parts = robot.parts.map(p => {
    const v = new Float32Array(p.v), f = new Int32Array(p.f);
    const nv = v.length / 3, nf = f.length / 3;
    const n = new Float32Array(nf * 3);          // face normals (unit)
    const vn = new Float32Array(nv * 3);         // vertex normals (unit)
    for (let i = 0; i < nf; i++) {
      const a = f[i * 3] * 3, b = f[i * 3 + 1] * 3, c = f[i * 3 + 2] * 3;
      const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
      const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;   // length = 2·area
      for (const k of [a, b, c]) { vn[k] += nx; vn[k + 1] += ny; vn[k + 2] += nz; }
      const L = Math.hypot(nx, ny, nz) || 1;
      n[i * 3] = nx / L; n[i * 3 + 1] = ny / L; n[i * 3 + 2] = nz / L;
    }
    for (let i = 0; i < nv; i++) {
      const L = Math.hypot(vn[i * 3], vn[i * 3 + 1], vn[i * 3 + 2]) || 1;
      vn[i * 3] /= L; vn[i * 3 + 1] /= L; vn[i * 3 + 2] /= L;
    }
    // edges: a, b, faceA, faceB (-1 on a boundary)
    const map = new Map();
    for (let i = 0; i < nf; i++) {
      for (let k = 0; k < 3; k++) {
        const a = f[i * 3 + k], b = f[i * 3 + (k + 1) % 3];
        const key = a < b ? a * 1e6 + b : b * 1e6 + a;
        const e = map.get(key);
        if (e) e[3] = i; else map.set(key, [a, b, i, -1]);
      }
    }
    const e = new Int32Array(map.size * 4);
    const crease = new Uint8Array(map.size);
    const cos = Math.cos(creaseDeg * Math.PI / 180);
    let i = 0;
    for (const [a, b, fa, fb] of map.values()) {
      e[i * 4] = a; e[i * 4 + 1] = b; e[i * 4 + 2] = fa; e[i * 4 + 3] = fb;
      if (fb < 0) crease[i] = 1;
      else {
        const d = n[fa * 3] * n[fb * 3] + n[fa * 3 + 1] * n[fb * 3 + 1] + n[fa * 3 + 2] * n[fb * 3 + 2];
        if (d < cos) crease[i] = 1;
      }
      i++;
    }
    // a robot made of open CAD patches (the camera) does not draw its
    // patch borders: they are tessellation seams, not edges of the object
    if (robot.patches) for (let k = 0; k < map.size; k++) if (e[k * 4 + 3] < 0) crease[k] = 0;
    return { body: p.body, name: p.name, mat: p.mat, v, f, n, vn, e, crease, nv, nf, patches: !!robot.patches };
  });
  const bodies = robot.bodies.map(b => ({
    ...b,
    m: b.quat ? quatM(b.quat) : b.euler ? eulerM(b.euler) : IDENT.slice(),
  }));
  const index = new Map(bodies.map((b, i) => [b.name, i]));
  // each part's centroid in its body frame (the camera's shutter sits on its lens)
  const centroids = parts.map(p => { let x = 0, y = 0, z = 0; for (let i = 0; i < p.nv; i++) { x += p.v[i * 3]; y += p.v[i * 3 + 1]; z += p.v[i * 3 + 2]; } return [x / p.nv, y / p.nv, z / p.nv]; });
  return { id: robot.id, parts, bodies, index, centroids };
}

/* ── small linear algebra, matching Flourish3D's row-major 3x3 ──────── */

const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const mul = (A, B) => [
  A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8],
];
const apply = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

// MuJoCo quaternions are (w, x, y, z)
function quatM(q) {
  let [w, x, y, z] = q;
  const L = Math.hypot(w, x, y, z) || 1; w /= L; x /= L; y /= L; z /= L;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}
// MuJoCo's default euler sequence is intrinsic xyz: R = Rx · Ry · Rz
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const eulerM = e => mul(rotX(e[0]), mul(rotY(e[1]), rotZ(e[2])));
// rotation of `a` radians about a unit axis
export function axisM(axis, a) {
  const [x, y, z] = axis, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

const place = (m, t) => ({ m, t });
const chain = (a, b) => place(mul(a.m, b.m), [
  a.m[0] * b.t[0] + a.m[1] * b.t[1] + a.m[2] * b.t[2] + a.t[0],
  a.m[3] * b.t[0] + a.m[4] * b.t[1] + a.m[5] * b.t[2] + a.t[1],
  a.m[6] * b.t[0] + a.m[7] * b.t[1] + a.m[8] * b.t[2] + a.t[2],
]);

// A robot standing on the stage: Z-up turned to screen-up, millimetres
// scaled by k, turned by `yaw` about its own vertical, its base at `root`.
export function standing(root, k, yawDeg) {
  const up = rotX(Math.PI / 2);                 // Z (up) -> -y (up on screen)
  const yaw = rotY((yawDeg || 0) * Math.PI / 180);
  const S = [k, 0, 0, 0, k, 0, 0, 0, k];
  return place(mul(yaw, mul(up, S)), [root[0], root[1], root[2] || 0]);
}

// The camera, FACING the viewer: its MuJoCo frame has the sensors on +Z and
// height along Y, so Z is kept toward the viewer and Y is flipped to screen-up
// (a half turn about Z, which also mirrors X back the right way).
export function facing(root, k, yawDeg, pitchDeg) {
  const flip = rotZ(Math.PI);
  const yaw = rotY((yawDeg || 0) * Math.PI / 180);
  const pitch = rotX((pitchDeg || 0) * Math.PI / 180);
  const S = [k, 0, 0, 0, k, 0, 0, 0, k];
  return place(mul(yaw, mul(pitch, mul(flip, S))), [root[0], root[1], root[2] || 0]);
}

// Forward kinematics: the world placement of every body for joint angles `q`
// (radians, one per jointed body in tree order; the base has no joint).
export function bodyPlacements(robot, base, q) {
  const out = new Array(robot.bodies.length);
  let qi = 0;
  for (let i = 0; i < robot.bodies.length; i++) {
    const b = robot.bodies[i];
    const parent = b.parent == null ? base : out[robot.index.get(b.parent)];
    let T = chain(parent, place(b.m, b.pos));
    if (b.axis) {
      const a = q[qi++] || 0;
      T = chain(T, place(axisM(b.axis, a), [0, 0, 0]));
    }
    out[i] = T;
  }
  return out;
}

export { apply, TAU };
