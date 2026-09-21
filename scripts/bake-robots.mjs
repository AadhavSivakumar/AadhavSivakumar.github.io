// Bake the machines the flourishes turn into — the SO-ARM100, the Franka FR3
// and the UR5e on the right, the Intel RealSense D435i on the left — from
// their MuJoCo Menagerie descriptions into line-art-weight meshes the Canvas2D
// renderer can draw.
//
//   node scripts/bake-robots.mjs <menagerie dir> [budget]
//
// <menagerie dir> holds trs_so_arm100/, franka_fr3/, universal_robots_ur5e/
// and realsense_d435i/ as fetched from github.com/google-deepmind/mujoco_menagerie (the XML plus
// the assets/ meshes). The raw meshes are ~60MB and are NOT committed; only
// the baked JSON in src/robots/ is.
//
// What it does, per part:
//   1. reads the STL (SO-ARM) or OBJ (FR3, UR5e) and welds shared vertices;
//   2. DECIMATES by vertex clustering — snaps vertices to a grid and merges —
//      searching the cell size that lands each part on its face budget. A
//      robot ends up around 7,000 triangles. It was 2,000, and at 2,000 with
//      lines drawn along the facets the owner said it looked "mesh-like
//      instead of sim-like". Smoothness is triangles plus smooth shading plus
//      NO facet lines — a STEP file would tessellate to triangles too;
//   3. writes ONLY vertices and faces (plus material and body). Normals,
//      edge adjacency, crease flags and vertex normals are derived at load in
//      src/robots/index.js — they are a function of the geometry, and shipping
//      them tripled the JSON;
//   4. writes the body tree — positions, orientations, joint axes — copied
//      from the MJCF by hand, because the trees are ten lines each and a
//      defaults-aware MJCF parser is not.
// Units: millimetres. The runtime scales to the stage.

import fs from 'node:fs';
import path from 'node:path';
import { decimate } from './qem.mjs';

const ARGS = process.argv.slice(2);
const ROOT = ARGS.find(a => !a.startsWith('--') && !/^[\d.]+$/.test(a));
const BUDGET_ARG = ARGS.find(a => /^[\d.]+$/.test(a));
const ONLY = (ARGS.find(a => a.startsWith('--only=')) || '').slice(7);   // one robot, for running four in parallel
if (!ROOT) { console.error('usage: node scripts/bake-robots.mjs <menagerie dir> [budget] [--only=id]'); process.exit(1); }
const OUT = path.resolve('src/robots');
fs.mkdirSync(OUT, { recursive: true });

/* ── readers ─────────────────────────────────────────────────────────── */

function weld(tris) {                      // tris: flat [x,y,z]*3n → indexed
  const map = new Map(), v = [], f = [];
  const key = (x, y, z) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
  for (let i = 0; i < tris.length; i += 9) {
    const idx = [];
    for (let k = 0; k < 3; k++) {
      const x = tris[i + k * 3], y = tris[i + k * 3 + 1], z = tris[i + k * 3 + 2];
      const kk = key(x, y, z);
      let id = map.get(kk);
      if (id === undefined) { id = v.length / 3; map.set(kk, id); v.push(x, y, z); }
      idx.push(id);
    }
    if (idx[0] !== idx[1] && idx[1] !== idx[2] && idx[0] !== idx[2]) f.push(...idx);
  }
  return { v, f };
}

function readSTL(file) {
  const b = fs.readFileSync(file);
  const n = b.readUInt32LE(80);
  const tris = new Array(n * 9);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    for (let k = 0; k < 9; k++) tris[i * 9 + k] = b.readFloatLE(o + k * 4) * 1000;   // m -> mm
  }
  return [{ mtl: '', ...weld(tris) }];
}

// OBJ, split by `usemtl` group, vertices shared across the file
function readOBJ(file) {
  const text = fs.readFileSync(file, 'utf8');
  const verts = [];
  const groups = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) {
      const a = line.trim().split(/\s+/);
      verts.push(+a[1] * 1000, +a[2] * 1000, +a[3] * 1000);
    } else if (line.startsWith('usemtl')) {
      cur = { mtl: line.slice(6).trim(), f: [] };
      groups.push(cur);
    } else if (line.startsWith('f ')) {
      if (!cur) { cur = { mtl: '', f: [] }; groups.push(cur); }
      const a = line.trim().split(/\s+/).slice(1).map(s => parseInt(s.split('/')[0], 10) - 1);
      for (let k = 1; k + 1 < a.length; k++) cur.f.push(a[0], a[k], a[k + 1]);   // fan, for quads
    }
  }
  // each group gets its own compact vertex list, WELDED BY POSITION: the
  // menagerie OBJs carry a vertex per face corner (88k vertices for 63k
  // faces on the Franka's base), so by index almost no two faces share an
  // edge. Clustering never noticed — it merged by cell anyway. Quadric
  // decimation treats every unshared edge as a boundary to preserve, and
  // the result was a soup of rims hatched across every surface.
  return groups.filter(g => g.f.length).map(g => {
    const tris = new Array(g.f.length * 3);
    g.f.forEach((i, k) => { tris[k * 3] = verts[i * 3]; tris[k * 3 + 1] = verts[i * 3 + 1]; tris[k * 3 + 2] = verts[i * 3 + 2]; });
    return { mtl: g.mtl, ...weld(tris) };
  });
}

/* ── decimation by vertex clustering ─────────────────────────────────── */

function cluster(mesh, cell) {
  const { v, f } = mesh;
  const cellOf = new Map(), rep = [];         // cell key -> new vertex id
  const sums = [];                             // accumulate positions per new vertex
  const remap = new Int32Array(v.length / 3);
  for (let i = 0; i < v.length / 3; i++) {
    const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
    const k = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    let id = cellOf.get(k);
    if (id === undefined) { id = rep.length; cellOf.set(k, id); rep.push(k); sums.push([0, 0, 0, 0]); }
    remap[i] = id;
    const s = sums[id]; s[0] += x; s[1] += y; s[2] += z; s[3] += 1;
  }
  const nv = [];
  for (const s of sums) nv.push(s[0] / s[3], s[1] / s[3], s[2] / s[3]);
  const nf = [], seen = new Set();
  for (let i = 0; i < f.length; i += 3) {
    const a = remap[f[i]], b = remap[f[i + 1]], c = remap[f[i + 2]];
    if (a === b || b === c || a === c) continue;
    // drop exact duplicates (same three vertices, any rotation)
    const k = [a, b, c].sort((p, q) => p - q).join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    nf.push(a, b, c);
  }
  return { v: nv, f: nf };
}

function decimateTo(mesh, budget, opts) {
  if (mesh.f.length / 3 <= budget) return mesh;
  // Quadric edge collapse (scripts/qem.mjs). Vertex clustering, below, is
  // kept for reference: it produced slivers and torn patches at 5-7k
  // triangles, which the owner saw as "triangles" and "broken".
  return decimate(mesh, budget, opts);
}
function decimateByClustering(mesh, budget) {
  if (mesh.f.length / 3 <= budget) return mesh;
  // bounding size sets the search range
  let lo = 0.2, hi = 200;                     // mm
  let best = mesh;
  for (let it = 0; it < 22; it++) {
    const mid = Math.sqrt(lo * hi);
    const m = cluster(mesh, mid);
    if (m.f.length / 3 > budget) lo = mid; else { hi = mid; best = m; }
  }
  return best;
}

/* ── edges, normals ──────────────────────────────────────────────────── */

// Make a part's winding CONSISTENT, then OUTWARD. The SO-ARM's STL exports
// wind triangle by triangle at random — a third of the faces of some parts
// the wrong way — and the renderer culls by winding, so those faces vanished
// and the part read as a see-through wireframe. Consistency is propagated
// across shared edges (two faces sharing an edge must traverse it in opposite
// directions); then the whole part is turned outward by the sign of its
// volume, which is right for any closed shell and does not care about shape
// the way a centroid test does.
function windConsistently(mesh, flip = true) {
  const { f } = mesh;
  const nf = f.length / 3;
  const edgeFaces = new Map();
  const key = (a, b) => (a < b ? a * 1e7 + b : b * 1e7 + a);
  for (let i = 0; i < nf; i++) for (let k = 0; k < 3; k++) {
    const kk = key(f[i * 3 + k], f[i * 3 + (k + 1) % 3]);
    const arr = edgeFaces.get(kk); if (arr) arr.push(i); else edgeFaces.set(kk, [i]);
  }
  const done = new Uint8Array(nf);
  const dirOf = (i, a, b) => {            // +1 if face i goes a->b, -1 if b->a, 0 if not an edge of i
    for (let k = 0; k < 3; k++) { const p = f[i * 3 + k], q = f[i * 3 + (k + 1) % 3]; if (p === a && q === b) return 1; if (p === b && q === a) return -1; }
    return 0;
  };
  const components = [];                 // face lists, one per connected shell
  for (let seed = 0; seed < nf; seed++) {
    if (done[seed]) continue;
    done[seed] = 1;
    const comp = [seed];
    const stack = [seed];
    while (stack.length) {
      const i = stack.pop();
      for (let k = 0; k < 3; k++) {
        const a = f[i * 3 + k], b = f[i * 3 + (k + 1) % 3];
        for (const j of edgeFaces.get(key(a, b))) {
          if (j === i || done[j]) continue;
          // consistent means j traverses the edge the other way
          if (flip && dirOf(j, a, b) === 1) { const t = f[j * 3 + 1]; f[j * 3 + 1] = f[j * 3 + 2]; f[j * 3 + 2] = t; }
          done[j] = 1; stack.push(j); comp.push(j);
        }
      }
    }
    components.push(comp);
  }
  return components;
}
// A part is often several shells (a servo is a body plus a horn plus a
// cable), and each has to be turned outward ON ITS OWN: one decision for the
// whole part left the smaller shells inside-out, culled, and the part
// see-through.
// An OPEN component — a B-rep patch of the camera's CAD export, or a shell
// with a hole — has no meaningful volume, so it is turned by the CENTRE
// test instead: does it face away from the part's centre? Patch by patch
// where the patch agrees with itself (so its smooth normals stay smooth),
// face by face where it does not (a ring round a lens faces both ways).
// The inner skin of a hollow casing fails the test and is turned to face
// the wall it sits in, which culls it from every viewpoint — and that is
// exactly right for line art: the outer skin is all there is to draw.
function orientOutward(mesh) {
  const comps = windConsistently(mesh);
  const { v, f } = mesh;
  const nv = v.length / 3;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < v.length; i += 3) { cx += v[i]; cy += v[i + 1]; cz += v[i + 2]; }
  cx /= nv; cy /= nv; cz /= nv;
  const edgeCount = new Map();
  const key = (a, b) => (a < b ? a * 1e7 + b : b * 1e7 + a);
  for (let i = 0; i < f.length; i += 3) for (let k = 0; k < 3; k++) { const kk = key(f[i + k], f[i + (k + 1) % 3]); edgeCount.set(kk, (edgeCount.get(kk) || 0) + 1); }
  const flipFace = i => { const t = f[i * 3 + 1]; f[i * 3 + 1] = f[i * 3 + 2]; f[i * 3 + 2] = t; };
  const faceOut = i => {                     // area-weighted "faces away from the centre"
    const a = f[i * 3] * 3, b = f[i * 3 + 1] * 3, c = f[i * 3 + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const fx = (v[a] + v[b] + v[c]) / 3 - cx, fy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3 - cy, fz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3 - cz;
    const L = Math.hypot(fx, fy, fz) || 1;
    return (nx * fx + ny * fy + nz * fz) / L;
  };
  let flipped = 0;
  for (const comp of comps) {
    let open = 0;
    for (const i of comp) for (let k = 0; k < 3; k++) if (edgeCount.get(key(f[i * 3 + k], f[i * 3 + (k + 1) % 3])) === 1) open++;
    if (open <= comp.length * 0.03) {          // closed, or as good as: by volume
      let vol = 0;
      for (const i of comp) {
        const a = f[i * 3] * 3, b = f[i * 3 + 1] * 3, c = f[i * 3 + 2] * 3;
        vol += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]);
      }
      if (vol < 0) { for (const i of comp) flipFace(i); flipped++; }
      continue;
    }
    let sum = 0, mag = 0;
    for (const i of comp) { const d = faceOut(i); sum += d; mag += Math.abs(d); }
    if (mag === 0) continue;
    if (sum < -0.3 * mag) { for (const i of comp) flipFace(i); flipped++; }
    else if (sum < 0.3 * mag) { for (const i of comp) if (faceOut(i) < 0) flipFace(i); flipped++; }
  }
  return flipped > 0;
}
function orientOutwardOld(mesh) {
  const { v, f } = mesh;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < v.length; i += 3) { cx += v[i]; cy += v[i + 1]; cz += v[i + 2]; }
  cx /= v.length / 3; cy /= v.length / 3; cz /= v.length / 3;
  const n = faceNormals(v, f);
  let out = 0, inn = 0;
  for (let i = 0; i < f.length; i += 3) {
    const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3;
    const fx = (v[a] + v[b] + v[c]) / 3 - cx, fy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3 - cy, fz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3 - cz;
    const d = fx * n[i] + fy * n[i + 1] + fz * n[i + 2];
    if (d > 0) out++; else if (d < 0) inn++;
  }
  if (inn > out) for (let i = 0; i < f.length; i += 3) { const t = f[i + 1]; f[i + 1] = f[i + 2]; f[i + 2] = t; }
  return inn > out;
}

// A HOLLOW shell — a casing with walls, like the camera's — has an inner
// surface whose faces face inward. Drawn, those show through every gap and
// the part reads as transparent. If more than a quarter of a part's faces
// point at its own centroid, keep only the outward ones: the outer skin is
// all the line art needs.
function peelInterior(mesh) {
  const { v, f } = mesh;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < v.length; i += 3) { cx += v[i]; cy += v[i + 1]; cz += v[i + 2]; }
  cx /= v.length / 3; cy /= v.length / 3; cz /= v.length / 3;
  const n = faceNormals(v, f);
  const keep = [];
  let inward = 0;
  for (let i = 0; i < f.length; i += 3) {
    const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3;
    const fx = (v[a] + v[b] + v[c]) / 3 - cx, fy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3 - cy, fz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3 - cz;
    const L = Math.hypot(fx, fy, fz) || 1;
    const d = (fx * n[i] + fy * n[i + 1] + fz * n[i + 2]) / L;
    if (d < -0.35) inward++; else keep.push(f[i], f[i + 1], f[i + 2]);
  }
  if (inward < f.length / 3 * 0.25) return mesh;
  return { v, f: keep };
}

function faceNormals(v, f) {
  const n = new Array(f.length);
  for (let i = 0; i < f.length; i += 3) {
    const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const L = Math.hypot(nx, ny, nz) || 1;
    n[i] = nx / L; n[i + 1] = ny / L; n[i + 2] = nz / L;
  }
  return n;
}

// every manifold edge as [a, b, faceA, faceB] (faceB = -1 on a boundary),
// and which of them are feature edges
function edges(f, n, angleDeg) {
  const map = new Map();
  for (let i = 0; i < f.length; i += 3) {
    const fi = i / 3;
    for (let k = 0; k < 3; k++) {
      const a = f[i + k], b = f[i + (k + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const e = map.get(key);
      if (e) e.push(fi); else map.set(key, [a, b, fi]);
    }
  }
  const cos = Math.cos(angleDeg * Math.PI / 180);
  const all = [], feature = [];
  for (const e of map.values()) {
    const [a, b, fa, fb = -1] = e;
    all.push(a, b, fa, fb);
    if (fb < 0) { feature.push(a, b); continue; }
    const d = n[fa * 3] * n[fb * 3] + n[fa * 3 + 1] * n[fb * 3 + 1] + n[fa * 3 + 2] * n[fb * 3 + 2];
    if (d < cos) feature.push(a, b);
  }
  return { all, feature };
}

/* ── the robots ──────────────────────────────────────────────────────── */
// Body trees copied from the MJCF. pos in metres, quat (w x y z) or euler
// (radians, intrinsic xyz), joint axis in the body frame. Materials map the
// menagerie's onto the renderer's MAT slots by name; the runtime resolves.
// A geom is [file, material] or [file, material, pos, quat]: the SO-ARM101's
// MJCF places every mesh with its own offset inside its body, and that
// transform is baked into the vertices here.
const quatM = q => {
  let [w, x, y, z] = q; const L = Math.hypot(w, x, y, z) || 1; w /= L; x /= L; y /= L; z /= L;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
};
function transformInPlace(mesh, pos, quat) {
  if (!pos && !quat) return;
  const m = quat ? quatM(quat) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const t = pos ? pos.map(x => x * 1000) : [0, 0, 0];
  const v = mesh.v;
  for (let i = 0; i < v.length; i += 3) {
    const x = v[i], y = v[i + 1], z = v[i + 2];
    v[i] = m[0] * x + m[1] * y + m[2] * z + t[0];
    v[i + 1] = m[3] * x + m[4] * y + m[5] * z + t[1];
    v[i + 2] = m[6] * x + m[7] * y + m[8] * z + t[2];
  }
}

const mm = p => p.map(x => x * 1000);

const ROBOTS = {
  // The camera: one body, nine parts by material. Budget is generous — it is
  // the whole of the left side, drawn large, and it comes apart piece by
  // piece, so every piece has to hold up on its own.
  // The camera is DRAWN now (Flourish3D.jsx, `D435`): Intel's export is open
  // B-rep patches and never stopped reading as broken. The entry stays as the
  // record of what was tried; `skip` keeps it out of the bake.
  d435i: {
    dir: 'realsense_d435i', kind: 'obj', budget: 500, skip: true,
    // Intel's CAD export is OPEN B-rep patches with T-junctions, not shells
    // (75k boundary edges in the body; welding cannot stitch a T-junction),
    // so its patches are oriented by the centre test in orientOutward, and
    // the renderer does not draw its patch borders (`patches` below).
    // Rebuilding it as a closed shell from its volume was tried — voxelise
    // the assembly, flood the air, blur, surface nets, decimate — and
    // pinched at every lens aperture (hundreds of non-manifold edges the
    // decimator could not pass), leaving torn surfaces. Not worth more.
    patches: true,
    // its rims — the bezel round the front, the lens apertures — may not
    // coarsen past 2.5mm edges, or the bezel's triangles cut across them
    qem: { maxBoundary: 2.5 },
    bodies: [
      { name: 'd435i', parent: null, pos: [0, 0, 0], geoms: [
        ['d435i_0.obj', 'black'], ['d435i_1.obj', 'green'], ['d435i_2.obj', 'gray'], ['d435i_3.obj', 'black'],
        ['d435i_4.obj', 'gray'], ['d435i_5.obj', 'black'], ['d435i_6.obj', 'black'], ['d435i_7.obj', 'black'],
        ['d435i_8.obj', 'white'],
      ] },
    ],
  },
  // TheRobotStudio's SO-ARM101, from their own MJCF (Simulation/SO101/
  // so101_new_calib.xml). Printed parts are white, the STS3215 servos black.
  soarm: {
    dir: 'so101', kind: 'stl', budget: 620,
    bodies: [
      { name: 'base', parent: null, pos: [0, 0, 0], geoms: [
        ['base_motor_holder_so101_v1.stl', 'white', [-0.00636471, -9.94414e-05, -0.0024], [0.5, 0.5, 0.5, 0.5]],
        ['base_so101_v2.stl', 'white', [-0.00636471, -8.97657e-09, -0.0024], [0.5, 0.5, 0.5, 0.5]],
        ['sts3215_03a_v1.stl', 'black', [0.0263353, -8.97657e-09, 0.0437], [1, 0, 0, 0]],
        ['waveshare_mounting_plate_so101_v2.stl', 'black', [-0.0309827, -0.000199441, 0.0474], [0.5, 0.5, 0.5, 0.5]],
      ] },
      { name: 'shoulder', parent: 'base', pos: [0.0388353, -8.97657e-09, 0.0624], quat: [0, 0, -1, 0], axis: [0, 0, 1], geoms: [
        ['sts3215_03a_v1.stl', 'black', [-0.0303992, 0.000422241, -0.0417], [0.5, 0.5, 0.5, -0.5]],
        ['motor_holder_so101_base_v1.stl', 'white', [-0.0675992, -0.000177759, 0.0158499], [0.5, 0.5, -0.5, 0.5]],
        ['rotation_pitch_so101_v1.stl', 'white', [0.0122008, 2.22413e-05, 0.0464], [0.707107, -0.707107, 0, 0]],
      ] },
      { name: 'upper_arm', parent: 'shoulder', pos: [-0.0303992, -0.0182778, -0.0542], quat: [0.5, -0.5, -0.5, -0.5], axis: [0, 0, 1], geoms: [
        ['sts3215_03a_v1.stl', 'black', [-0.11257, -0.0155, 0.0187], [0, -0.707107, 0.707107, 0]],
        ['upper_arm_so101_v1.stl', 'white', [-0.065085, 0.012, 0.0182], [0, 1, 0, 0]],
      ] },
      { name: 'lower_arm', parent: 'upper_arm', pos: [-0.11257, -0.028, 0], quat: [0.707107, 0, 0, 0.707107], axis: [0, 0, 1], geoms: [
        ['under_arm_so101_v1.stl', 'white', [-0.0648499, -0.032, 0.0182], [0, 1, 0, 0]],
        ['motor_holder_so101_wrist_v1.stl', 'white', [-0.0648499, -0.032, 0.018], [0, -1, 0, 0]],
        ['sts3215_03a_v1.stl', 'black', [-0.1224, 0.0052, 0.0187], [0, 0, 1, 0]],
      ] },
      { name: 'wrist', parent: 'lower_arm', pos: [-0.1349, 0.0052, 0], quat: [0.707107, 0, 0, -0.707107], axis: [0, 0, 1], geoms: [
        ['sts3215_03a_no_horn_v1.stl', 'black', [0, -0.0424, 0.0306], [0.5, 0.5, 0.5, -0.5]],
        ['wrist_roll_pitch_so101_v2.stl', 'white', [0, -0.028, 0.0181], [0.5, -0.5, -0.5, -0.5]],
      ] },
      { name: 'gripper', parent: 'wrist', pos: [0, -0.0611, 0.0181], quat: [0.0172091, -0.0172091, 0.706897, 0.706897], axis: [0, 0, 1], geoms: [
        ['sts3215_03a_v1.stl', 'black', [0.0077, 0.0001, -0.0234], [0.707107, -0.707107, 0, 0]],
        ['wrist_roll_follower_so101_v1.stl', 'white', [0, -0.000218214, 0.000949706], [0, 1, 0, 0]],
      ] },
      { name: 'moving_jaw', parent: 'gripper', pos: [0.0202, 0.0188, -0.0234], quat: [0.707107, 0.707107, 0, 0], axis: [0, 0, 1], geoms: [
        ['moving_jaw_so101_v1.stl', 'white', [0, 0, 0.0189], [1, 0, 0, 0]],
      ] },
    ],
  },
  soarm100: {
    dir: 'trs_so_arm100', kind: 'stl', budget: 520, skip: true,
    bodies: [
      { name: 'Base', parent: null, pos: [0, 0, 0], geoms: [['Base.stl', 'white'], ['Base_Motor.stl', 'black']] },
      { name: 'Rotation_Pitch', parent: 'Base', pos: [0, -0.0452, 0.0165], quat: [0.707105, 0.707108, 0, 0], axis: [0, 1, 0],
        geoms: [['Rotation_Pitch.stl', 'white'], ['Rotation_Pitch_Motor.stl', 'black']] },
      { name: 'Upper_Arm', parent: 'Rotation_Pitch', pos: [0, 0.1025, 0.0306], euler: [1.57079, 0, 0], axis: [1, 0, 0],
        geoms: [['Upper_Arm.stl', 'white'], ['Upper_Arm_Motor.stl', 'black']] },
      { name: 'Lower_Arm', parent: 'Upper_Arm', pos: [0, 0.11257, 0.028], euler: [-1.57079, 0, 0], axis: [1, 0, 0],
        geoms: [['Lower_Arm.stl', 'white'], ['Lower_Arm_Motor.stl', 'black']] },
      { name: 'Wrist_Pitch_Roll', parent: 'Lower_Arm', pos: [0, 0.0052, 0.1349], euler: [-1.57079, 0, 0], axis: [1, 0, 0],
        geoms: [['Wrist_Pitch_Roll.stl', 'white'], ['Wrist_Pitch_Roll_Motor.stl', 'black']] },
      { name: 'Fixed_Jaw', parent: 'Wrist_Pitch_Roll', pos: [0, -0.0601, 0], euler: [0, 1.57079, 0], axis: [0, 1, 0],
        geoms: [['Fixed_Jaw.stl', 'white'], ['Fixed_Jaw_Motor.stl', 'black']] },
      { name: 'Moving_Jaw', parent: 'Fixed_Jaw', pos: [-0.0202, -0.0244, 0], quat: [0, 0, 1, 0], axis: [0, 0, 1],
        geoms: [['Moving_Jaw.stl', 'white']] },
    ],
  },
  fr3: {
    dir: 'franka_fr3', kind: 'obj', budget: 720,
    bodies: [
      { name: 'link0', parent: null, pos: [0, 0, 0], geoms: [['link0.obj']] },
      { name: 'link1', parent: 'link0', pos: [0, 0, 0.333], axis: [0, 0, 1], geoms: [['link1.obj']] },
      { name: 'link2', parent: 'link1', pos: [0, 0, 0], quat: [1, -1, 0, 0], axis: [0, 0, 1], geoms: [['link2.obj']] },
      { name: 'link3', parent: 'link2', pos: [0, -0.316, 0], quat: [1, 1, 0, 0], axis: [0, 0, 1], geoms: [['link3.obj']] },
      { name: 'link4', parent: 'link3', pos: [0.0825, 0, 0], quat: [1, 1, 0, 0], axis: [0, 0, 1], geoms: [['link4.obj']] },
      { name: 'link5', parent: 'link4', pos: [-0.0825, 0.384, 0], quat: [1, -1, 0, 0], axis: [0, 0, 1], geoms: [['link5.obj']] },
      { name: 'link6', parent: 'link5', pos: [0, 0, 0], quat: [1, 1, 0, 0], axis: [0, 0, 1], geoms: [['link6.obj']] },
      { name: 'link7', parent: 'link6', pos: [0.088, 0, 0], quat: [1, 1, 0, 0], axis: [0, 0, 1], geoms: [['link7.obj']] },
      // the Franka Hand, from the Menagerie's franka_emika_panda (the FR3 model
      // ships without it; the hand is the same part): two fingers on SLIDE
      // joints along the hand's y, 0-40 mm each
      { name: 'hand', parent: 'link7', pos: [0, 0, 0.107], quat: [0.9238795, 0, 0, -0.3826834], geoms: [
        ['hand_0.obj', 'white'], ['hand_1.obj', 'black'], ['hand_2.obj', 'black'], ['hand_3.obj', 'white'], ['hand_4.obj', 'white'],
      ] },
      { name: 'left_finger', parent: 'hand', pos: [0, 0, 0.0584], axis: [0, 1, 0], slide: true, geoms: [['finger_0.obj', 'white'], ['finger_1.obj', 'black']] },
      { name: 'right_finger', parent: 'hand', pos: [0, 0, 0.0584], quat: [0, 0, 0, 1], axis: [0, 1, 0], slide: true, geoms: [['finger_0.obj', 'white'], ['finger_1.obj', 'black']] },
    ],
  },
  // The Ultra OP1's base machine: a FAIRINO FR20 (fairino_description,
  // fairino20_v6.urdf — SolidWorks-exported STLs in metres, joint origins as
  // URDF rpy), carrying Ultra's own bimanual unit on its flange. The unit
  // has no public CAD and is drawn procedurally in Flourish3D at the `unit`
  // body; its eyes are a Stereolabs ZED 2i (zed-ros-interfaces/meshes),
  // whose frame is ROS camera_link (x forward, z up) turned to hang under
  // the flange (the unit's z points down).
  ultra: {
    dir: 'fairino20', kind: 'stl', budget: 640,
    bodies: [
      { name: 'base_link', parent: null, pos: [0, 0, 0], geoms: [['base_link.STL', 'white']] },
      { name: 'shoulder_link', parent: 'base_link', pos: [0, 0, 0], axis: [0, 0, 1], geoms: [['shoulder_link.STL', 'white']] },
      { name: 'upperarm_link', parent: 'shoulder_link', pos: [0, 0, 0.215], rpy: [1.5708, 0, 0], axis: [0, 0, 1], geoms: [['upperarm_link.STL', 'white']] },
      { name: 'forearm_link', parent: 'upperarm_link', pos: [-1, 0, 0], axis: [0, 0, 1], geoms: [['forearm_link.STL', 'white']] },
      { name: 'wrist1_link', parent: 'forearm_link', pos: [-0.716, 0, 0], axis: [0, 0, 1], geoms: [['wrist1_link.STL', 'white']] },
      { name: 'wrist2_link', parent: 'wrist1_link', pos: [0, 0, 0.16601], rpy: [1.5708, 0, 0], axis: [0, 0, 1], geoms: [['wrist2_link.STL', 'white']] },
      { name: 'wrist3_link', parent: 'wrist2_link', pos: [0, 0, 0.138], rpy: [-1.5708, 0, 0], axis: [0, 0, 1], geoms: [['wrist3_link.STL', 'linkgray']] },
      { name: 'unit', parent: 'wrist3_link', pos: [0, 0, 0.12], geoms: [] },
      { name: 'zed', parent: 'unit', pos: [0.09, 0, 0.07], rpy: [3.14159, 0, 0], geoms: [['../../zed/zed2i.stl', 'black']] },
    ],
  },
  ur5e: {
    dir: 'universal_robots_ur5e', kind: 'obj', budget: 380,
    bodies: [
      { name: 'base', parent: null, pos: [0, 0, 0], quat: [0, 0, 0, -1], geoms: [['base_0.obj', 'black'], ['base_1.obj', 'jointgray']] },
      { name: 'shoulder', parent: 'base', pos: [0, 0, 0.163], axis: [0, 0, 1],
        geoms: [['shoulder_0.obj', 'urblue'], ['shoulder_1.obj', 'black'], ['shoulder_2.obj', 'jointgray']] },
      { name: 'upperarm', parent: 'shoulder', pos: [0, 0.138, 0], quat: [1, 0, 1, 0], axis: [0, 1, 0],
        geoms: [['upperarm_0.obj', 'linkgray'], ['upperarm_1.obj', 'black'], ['upperarm_2.obj', 'jointgray'], ['upperarm_3.obj', 'urblue']] },
      { name: 'forearm', parent: 'upperarm', pos: [0, -0.131, 0.425], axis: [0, 1, 0],
        geoms: [['forearm_0.obj', 'urblue'], ['forearm_1.obj', 'linkgray'], ['forearm_2.obj', 'black'], ['forearm_3.obj', 'jointgray']] },
      { name: 'wrist1', parent: 'forearm', pos: [0, 0, 0.392], quat: [1, 0, 1, 0], axis: [0, 1, 0],
        geoms: [['wrist1_0.obj', 'black'], ['wrist1_1.obj', 'urblue'], ['wrist1_2.obj', 'jointgray']] },
      { name: 'wrist2', parent: 'wrist1', pos: [0, 0.127, 0], axis: [0, 0, 1],
        geoms: [['wrist2_0.obj', 'black'], ['wrist2_1.obj', 'urblue'], ['wrist2_2.obj', 'jointgray']] },
      { name: 'wrist3', parent: 'wrist2', pos: [0, 0, 0.1], axis: [0, 1, 0], geoms: [['wrist3.obj', 'linkgray']] },
    ],
  },
};

// the Franka's combined OBJs name their groups by colour
const fr3Material = mtl => {
  const m = mtl.match(/color_(\d+)_(\d+)_(\d+)/);
  if (!m) return 'white';
  const [r, g, b] = m.slice(1).map(Number);
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r < 90 && g < 90 && b < 90) return 'black';
  return 'gray';
};

const round = (x, d = 1) => +x.toFixed(d);

for (const [id, R] of Object.entries(ROBOTS)) {
  if (R.skip || (ONLY && id !== ONLY)) continue;
  const budget = BUDGET_ARG ? Math.round(R.budget * (+BUDGET_ARG)) : R.budget;
  const out = { id, patches: !!R.patches, bodies: [], parts: [] };
  let tris = 0, bytes = 0, flipped = 0, peels = 0;
  for (const B of R.bodies) {
    out.bodies.push({ name: B.name, parent: B.parent, pos: mm(B.pos), quat: B.quat || null, euler: B.euler || null, rpy: B.rpy || null, axis: B.axis || null, slide: !!B.slide });
    for (const [file, matName, gpos, gquat] of B.geoms) {
      const p = path.join(ROOT, R.dir, 'assets', file);
      const groups = R.kind === 'stl' ? readSTL(p) : readOBJ(p);
      for (const g of groups) transformInPlace(g, gpos, gquat);
      // budget shared across a file's groups, by face count
      const total = groups.reduce((s, g) => s + g.f.length / 3, 0);
      // per-file budgets for the camera: the casing is most of what you see,
      // then the black front plate — at 110 faces its patches came out as a
      // torn handful of triangles and the casing's open front showed its
      // ribs through the gap — then the sensor module behind it
      const CAM_BUDGET = { 'd435i_8.obj': 3600, 'd435i_5.obj': 950, 'd435i_4.obj': 800 };
      // the Franka Hand is drawn small; its two big shells and the fingers
      // need far fewer faces than an arm link (two Frankas make the OP1, and
      // the frame budget is the whole page's)
      // ...and the base, a chamfered pedestal with cut-outs in seven
      // material groups, needs more than a link (at 480 it was a torn tent)
      const HAND_BUDGET = { 'hand_2.obj': 320, 'hand_3.obj': 380, 'hand_1.obj': 190, 'hand_4.obj': 190, 'hand_0.obj': 50, 'finger_0.obj': 150, 'finger_1.obj': 120, 'link0.obj': 1800 };
      const fileBudget = id === 'd435i' ? (CAM_BUDGET[file] ?? 110) : (HAND_BUDGET[file] ?? budget);
      for (const g of groups) {
        // a small group still needs enough faces to be a ring and not a
        // crown: the Franka's base band at 127 was a row of teeth
        const share = Math.max(100, Math.round(fileBudget * (g.f.length / 3) / total));
        // wind the INPUT consistently first (the SO-ARM's STLs are random per
        // triangle), so the decimator works on an oriented surface; then
        // again after, per shell, outward
        orientOutward(g);
        const m = decimateTo(g, share, R.qem);
        if (m.f.length < 3) continue;
        if (orientOutward(m)) flipped++;
        // NO interior peeling. It was tried: removing inward-facing faces from
        // hollow shells opened a boundary around every hole, and every
        // boundary edge is an outline, so the parts came out covered in lines.
        // Inside-out shells were the actual cause of see-through parts, and
        // per-shell orientation above fixes that; inner surfaces face away
        // from the viewer and cull themselves.
        const mat = matName || (id === 'fr3' ? fr3Material(g.mtl) : 'white');
        out.parts.push({ body: B.name, name: path.basename(file).replace(/\.(obj|stl)$/i, ''), mat, v: m.v.map(x => round(x, 1)), f: m.f });
        tris += m.f.length / 3;
      }
    }
  }
  const json = JSON.stringify(out);
  bytes = Buffer.byteLength(json);
  fs.writeFileSync(path.join(OUT, `${id}.json`), json);
  console.log(`${id.padEnd(6)} ${out.parts.length} parts, ${tris} triangles, ${flipped} parts re-wound, ${peels} shells peeled, ${(bytes / 1024).toFixed(0)} KB`);
}
