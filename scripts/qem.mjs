// Quadric edge-collapse decimation (Garland & Heckbert), for bake-robots.mjs.
//
// Vertex clustering was tried first — snap vertices to a grid and merge —
// and at 5-7k triangles a robot it left exactly what the owner saw: slivers,
// irregular triangles across smooth surfaces, patches that looked torn. It
// has no idea what the surface is; it just quantises. Edge collapse removes
// the edge whose removal moves the surface LEAST, measured by the summed
// squared distance to the planes of the faces around it (the quadric), so a
// tube keeps its roundness, a flat face stays one flat face, and creases stay
// put until the very end.
//
//   decimate({ v, f }, targetFaces, { maxBoundary }) -> { v, f }
//
// v: flat [x,y,z,...], f: flat [a,b,c,...]. Returns compacted arrays.
// Collapses that would flip a face are refused, and boundary edges carry a
// stiff constraint plane so open shells keep their rims. `maxBoundary` (mm)
// caps how long a boundary edge may get: the constraint plane lets a rim
// vertex slide freely ALONG its rim, so on a round opening the rim polygon
// coarsens until the triangles of the bezel round it run as CHORDS across
// the hole — the camera's front plate had pale wedges cut across it. With a
// cap, a rim keeps enough vertices to stay round.
//
// Speed matters: the camera casing is 135k faces and the first version of
// this took a quarter of an hour on it and had not finished. Two things did
// that — the faces-per-vertex lists were never pruned of dead faces, so the
// fan of a vertex that absorbed its neighbours grew without bound and every
// flip check walked all of it; and a refused edge bumped BOTH its vertices'
// versions, which threw away every other edge on them, so the heap ran dry
// far above the target and the loop crawled through re-queues. Now lists
// are pruned as they are walked and refused edges are just remembered.

export function decimate(mesh, target, opts = {}) {
  const maxBoundary = opts.maxBoundary ?? Infinity;
  const v = Float64Array.from(mesh.v);
  const f = Int32Array.from(mesh.f);
  const nv = v.length / 3, nf = f.length / 3;
  if (nf <= target) return { v: Array.from(v), f: Array.from(f) };

  // ── quadrics: 10 floats per vertex (symmetric 4x4) ──
  const Q = new Float64Array(nv * 10);
  const addPlane = (i, a, b, c, d, w) => {
    const o = i * 10;
    Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d;
    Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d;
    Q[o + 7] += w * c * c; Q[o + 8] += w * c * d;
    Q[o + 9] += w * d * d;
  };
  const faceAlive = new Uint8Array(nf).fill(1);
  const P = new Float64Array(5);
  const plane = (i, out) => {
    const a = f[i * 3] * 3, b = f[i * 3 + 1] * 3, c = f[i * 3 + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const L = Math.hypot(nx, ny, nz);
    if (L < 1e-12) { out[4] = 0; return; }
    nx /= L; ny /= L; nz /= L;
    out[0] = nx; out[1] = ny; out[2] = nz; out[3] = -(nx * v[a] + ny * v[a + 1] + nz * v[a + 2]); out[4] = L / 2;   // area
  };
  for (let i = 0; i < nf; i++) {
    plane(i, P);
    if (P[4] === 0) { faceAlive[i] = 0; continue; }
    for (let k = 0; k < 3; k++) addPlane(f[i * 3 + k], P[0], P[1], P[2], P[3], P[4]);
  }

  // ── adjacency: faces per vertex ──
  const vf = new Array(nv);
  for (let i = 0; i < nv; i++) vf[i] = [];
  for (let i = 0; i < nf; i++) if (faceAlive[i]) for (let k = 0; k < 3; k++) vf[f[i * 3 + k]].push(i);
  const prune = (vid) => {                     // drop dead faces from a fan, in place
    const L = vf[vid]; let w = 0;
    for (let r = 0; r < L.length; r++) if (faceAlive[L[r]]) L[w++] = L[r];
    L.length = w;
    return L;
  };

  // ── edges, with boundary constraints ──
  const edgeKey = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  const edgeCount = new Map();
  for (let i = 0; i < nf; i++) if (faceAlive[i]) for (let k = 0; k < 3; k++) {
    const key = edgeKey(f[i * 3 + k], f[i * 3 + (k + 1) % 3]);
    edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
  }
  // a boundary edge gets a plane through it, perpendicular to its one face,
  // weighted heavily: the rim of an open shell is a feature, not noise
  for (let i = 0; i < nf; i++) {
    if (!faceAlive[i]) continue;
    for (let k = 0; k < 3; k++) {
      const a = f[i * 3 + k], b = f[i * 3 + (k + 1) % 3];
      if (edgeCount.get(edgeKey(a, b)) !== 1) continue;
      plane(i, P);
      const ex = v[b * 3] - v[a * 3], ey = v[b * 3 + 1] - v[a * 3 + 1], ez = v[b * 3 + 2] - v[a * 3 + 2];
      let nx = ey * P[2] - ez * P[1], ny = ez * P[0] - ex * P[2], nz = ex * P[1] - ey * P[0];
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const d = -(nx * v[a * 3] + ny * v[a * 3 + 1] + nz * v[a * 3 + 2]);
      const w = 1000 * Math.hypot(ex, ey, ez);
      addPlane(a, nx, ny, nz, d, w); addPlane(b, nx, ny, nz, d, w);
    }
  }
  const isBoundary = new Uint8Array(nv);
  for (let i = 0; i < nf; i++) if (faceAlive[i]) for (let k = 0; k < 3; k++) {
    const a = f[i * 3 + k], b = f[i * 3 + (k + 1) % 3];
    if (edgeCount.get(edgeKey(a, b)) === 1) { isBoundary[a] = 1; isBoundary[b] = 1; }
  }
  edgeCount.clear();

  // cost of collapsing a-b, and where the merged vertex goes: the best of the
  // two ends and the midpoint (solving the 3x3 is not worth its instability
  // on the flat regions these meshes are full of). No allocation.
  const QS = new Float64Array(10);
  const qcost = (x, y, z) =>
    QS[0] * x * x + 2 * QS[1] * x * y + 2 * QS[2] * x * z + 2 * QS[3] * x +
    QS[4] * y * y + 2 * QS[5] * y * z + 2 * QS[6] * y +
    QS[7] * z * z + 2 * QS[8] * z + QS[9];
  const evalEdge = (a, b, out) => {
    for (let i = 0; i < 10; i++) QS[i] = Q[a * 10 + i] + Q[b * 10 + i];
    const ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2];
    const bx = v[b * 3], by = v[b * 3 + 1], bz = v[b * 3 + 2];
    const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
    const ca = qcost(ax, ay, az), cb = qcost(bx, by, bz), cm = qcost(mx, my, mz);
    if (cm <= ca && cm <= cb) { out[0] = mx; out[1] = my; out[2] = mz; return cm; }
    if (ca <= cb) { out[0] = ax; out[1] = ay; out[2] = az; return ca; }
    out[0] = bx; out[1] = by; out[2] = bz; return cb;
  };

  // ── heap of edges, lazily invalidated by a per-vertex version ──
  const ver = new Uint32Array(nv);
  const heap = [];
  const push = (cost, a, b) => {
    const e = { cost, a, b, va: ver[a], vb: ver[b] };
    heap.push(e);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p].cost <= heap[i].cost) break; heap[i] = heap[p]; heap[p] = e; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].cost < heap[m].cost) m = l;
        if (r < heap.length && heap[r].cost < heap[m].cost) m = r;
        if (m === i) break;
        heap[i] = heap[m]; heap[m] = last; i = m;
      }
    }
    return top;
  };
  const tmp = new Float64Array(3);
  const seen = new Set();
  for (let i = 0; i < nf; i++) if (faceAlive[i]) for (let k = 0; k < 3; k++) {
    const a = f[i * 3 + k], b = f[i * 3 + (k + 1) % 3];
    const key = edgeKey(a, b);
    if (seen.has(key)) continue; seen.add(key);
    push(evalEdge(a, b, tmp), a, b);
  }
  seen.clear();

  // ── collapse until the budget is met ──
  const alive = new Uint8Array(nv).fill(1);
  const refused = new Set();                   // edge keys whose collapse would flip a face
  let faces = 0; for (let i = 0; i < nf; i++) faces += faceAlive[i];
  const N0 = new Float64Array(5), N1 = new Float64Array(5);
  // would any face around `vid` (that does not vanish with the edge) flip if
  // `vid` moved to (nx,ny,nz)?
  // shape quality of a face: 4*sqrt(3)*area / (sum of squared edges), 1 for
  // equilateral, toward 0 for a sliver
  const quality = fi => {
    const a = f[fi * 3] * 3, b = f[fi * 3 + 1] * 3, c = f[fi * 3 + 2] * 3;
    const e0 = (v[b] - v[a]) ** 2 + (v[b + 1] - v[a + 1]) ** 2 + (v[b + 2] - v[a + 2]) ** 2;
    const e1 = (v[c] - v[b]) ** 2 + (v[c + 1] - v[b + 1]) ** 2 + (v[c + 2] - v[b + 2]) ** 2;
    const e2 = (v[a] - v[c]) ** 2 + (v[a + 1] - v[c + 1]) ** 2 + (v[a + 2] - v[c + 2]) ** 2;
    plane(fi, N1);
    return (4 * Math.sqrt(3) * N1[4]) / ((e0 + e1 + e2) || 1e-12);
  };
  const SLIVER = 0.12;
  const flipsAround = (vid, a, b, nx, ny, nz) => {
    const L = prune(vid);
    const ox = v[vid * 3], oy = v[vid * 3 + 1], oz = v[vid * 3 + 2];
    let bad = false;
    for (let r = 0; r < L.length && !bad; r++) {
      const fi = L[r];
      const i0 = f[fi * 3], i1 = f[fi * 3 + 1], i2 = f[fi * 3 + 2];
      let hits = 0;
      if (i0 === a || i0 === b) hits++;
      if (i1 === a || i1 === b) hits++;
      if (i2 === a || i2 === b) hits++;
      if (hits >= 2) continue;                 // this face vanishes with the edge
      plane(fi, N0);
      const q0 = quality(fi);
      v[vid * 3] = nx; v[vid * 3 + 1] = ny; v[vid * 3 + 2] = nz;
      plane(fi, N1);
      const q1 = quality(fi);
      v[vid * 3] = ox; v[vid * 3 + 1] = oy; v[vid * 3 + 2] = oz;
      if (N1[4] === 0 || N0[0] * N1[0] + N0[1] * N1[1] + N0[2] * N1[2] < 0.2) bad = true;
      // No SLIVERS: a collapse may not turn a decent face into a needle. On a
      // band between two preserved rims the cheapest collapses make long
      // triangles zig-zagging rim to rim, and their alternating mean normals
      // shade as teeth. A face that already is a sliver may stay one.
      else if (q1 < SLIVER && q0 >= SLIVER) bad = true;
    }
    return bad;
  };
  // The LINK CONDITION: a collapse is manifold-safe only if every vertex
  // adjacent to both ends is the apex of a face on the edge itself. Any
  // other shared neighbour would end up joined to the merged vertex twice,
  // through two different faces — a non-manifold "fin" — and fins are what
  // break the winding propagation downstream (an edge with three faces
  // cannot be traversed consistently), so the part comes out see-through.
  const oppSet = new Set(), nbA = new Set();
  const linkOK = (a, b) => {
    oppSet.clear(); nbA.clear();
    const La = prune(a), Lb = prune(b);
    for (let r = 0; r < La.length; r++) {
      const fi = La[r];
      const i0 = f[fi * 3], i1 = f[fi * 3 + 1], i2 = f[fi * 3 + 2];
      if (i0 === b || i1 === b || i2 === b) oppSet.add(i0 === a || i0 === b ? (i1 === a || i1 === b ? i2 : i1) : i0);
      else { if (i0 !== a) nbA.add(i0); if (i1 !== a) nbA.add(i1); if (i2 !== a) nbA.add(i2); }
    }
    if (oppSet.size > 2) return false;                     // already non-manifold here
    for (let r = 0; r < Lb.length; r++) {
      const fi = Lb[r];
      const i0 = f[fi * 3], i1 = f[fi * 3 + 1], i2 = f[fi * 3 + 2];
      if (i0 === a || i1 === a || i2 === a) continue;
      if ((i0 !== b && nbA.has(i0) && !oppSet.has(i0)) || (i1 !== b && nbA.has(i1) && !oppSet.has(i1)) || (i2 !== b && nbA.has(i2) && !oppSet.has(i2))) return false;
    }
    return true;
  };
  while (faces > target && heap.length) {
    const e = pop();
    const { a, b } = e;
    if (!alive[a] || !alive[b] || e.va !== ver[a] || e.vb !== ver[b]) continue;
    const key = edgeKey(a, b);
    if (refused.has(key)) continue;
    evalEdge(a, b, tmp);
    // a rim vertex merging with an interior one stays ON the rim: the merged
    // vertex takes the rim vertex's place, or the rim would wander inward
    // with every such collapse (the casing's front opening grew a triangle
    // across it that way)
    if (isBoundary[a] !== isBoundary[b]) { const r = isBoundary[a] ? a : b; tmp[0] = v[r * 3]; tmp[1] = v[r * 3 + 1]; tmp[2] = v[r * 3 + 2]; }
    const nx = tmp[0], ny = tmp[1], nz = tmp[2];
    if (isBoundary[a] && isBoundary[b] && Math.hypot(v[a * 3] - v[b * 3], v[a * 3 + 1] - v[b * 3 + 1], v[a * 3 + 2] - v[b * 3 + 2]) > maxBoundary) { refused.add(key); continue; }
    if (!linkOK(a, b) || flipsAround(a, a, b, nx, ny, nz) || flipsAround(b, a, b, nx, ny, nz)) { refused.add(key); continue; }
    // collapse b into a
    v[a * 3] = nx; v[a * 3 + 1] = ny; v[a * 3 + 2] = nz;
    for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
    isBoundary[a] |= isBoundary[b];
    alive[b] = 0;
    const La = vf[a], Lb = vf[b];
    for (let r = 0; r < Lb.length; r++) {
      const fi = Lb[r];
      if (!faceAlive[fi]) continue;
      let hasA = false;
      for (let k = 0; k < 3; k++) { if (f[fi * 3 + k] === b) f[fi * 3 + k] = a; else if (f[fi * 3 + k] === a) hasA = true; }
      if (hasA) { faceAlive[fi] = 0; faces--; }              // degenerate: shared the edge
      else La.push(fi);
    }
    vf[b] = null;
    ver[a]++; ver[b]++;
    // re-queue a's edges (the refusals on a's old edges no longer apply: the
    // geometry around a has changed)
    const L = prune(a);
    const nbrs = new Set();
    for (let r = 0; r < L.length; r++) { const fi = L[r]; for (let k = 0; k < 3; k++) { const x = f[fi * 3 + k]; if (x !== a) nbrs.add(x); } }
    for (const x of nbrs) { refused.delete(edgeKey(a, x)); push(evalEdge(a, x, tmp), a, x); }
  }

  // ── compact ──
  const remap = new Int32Array(nv).fill(-1);
  const outV = [], outF = [];
  const seenF = new Set();                     // the same three vertices twice is a fold: keep one
  for (let i = 0; i < nf; i++) {
    if (!faceAlive[i]) continue;
    const i0 = f[i * 3], i1 = f[i * 3 + 1], i2 = f[i * 3 + 2];
    if (i0 === i1 || i1 === i2 || i0 === i2) continue;
    const lo = Math.min(i0, i1, i2), hi = Math.max(i0, i1, i2), mid = i0 + i1 + i2 - lo - hi;
    const fk = (lo * 4294967296 + mid) * 4096 + (hi & 4095) + ':' + hi;
    if (seenF.has(fk)) continue; seenF.add(fk);
    for (const x of [i0, i1, i2]) {
      if (remap[x] < 0) { remap[x] = outV.length / 3; outV.push(v[x * 3], v[x * 3 + 1], v[x * 3 + 2]); }
      outF.push(remap[x]);
    }
  }
  return { v: outV, f: outF };
}
