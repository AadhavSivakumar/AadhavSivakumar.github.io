// The electric Atlas, rendered with REAL shading (three.js / WebGL), over the
// right stage's Canvas2D art.
//
// Why a second renderer for one robot: the Canvas2D line-art renderer fills
// every triangle with ONE flat tone, so a curved surface always shows its
// facets — the owner: "Is there a different way of 3d modeling it without
// having the triangles show up? I feel like the current method isn't working".
// Here every surface is lit per pixel with smooth normals: rounded boxes,
// capsules, lathed shells, a glowing ring light.
//
// THE MODEL is the owner's own Atlas (Blender, 181 parts, baked by
// scripts/bake-atlas26.mjs into src/robots/atlas26.bin, fetched lazily). It
// draws NOTHING of its own kinematics. Each frame Flourish3D hands over the
// placement of every Atlas body (the same growPlacements the Canvas2D drawer
// used, so the wave, the grow-in and the morph drive it unchanged) and its
// camera (yaw, pitch, dolly). This module maps stage space — x right, y DOWN,
// z toward the viewer, a perspective divide at 600 and a 0.85 zoom about the
// centre — onto a three.js camera that projects identically, so the GL robot
// lands exactly where the line-art one did.
//
// The three.js stack is already on the site (the lanyard badges); this module
// is imported lazily, so it is only fetched near the last page.
import * as THREE from 'three';

const PERSP = 600, ZOOM = 0.85, W = 340, H = 660;

export function createAtlasGL(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'f3d-gl';
  canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
  host.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    canvas.remove();
    return null;                       // no WebGL: the caller keeps the Canvas2D drawing
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // camera: at the viewer, 600 units out, a field of view that makes a point
  // at z = 0 land at CX + x * 0.85 — the stage's own projection
  const fov = 2 * Math.atan((H / 2) / ZOOM / PERSP) * 180 / Math.PI;
  const camera = new THREE.PerspectiveCamera(fov, W / H, 20, 4000);
  camera.position.set(0, 0, PERSP);
  camera.lookAt(0, 0, 0);

  // lighting: a sky/ground fill, a warm key from the upper left front (the
  // line art's KEY), a cool rim from behind
  scene.add(new THREE.HemisphereLight(0xf4f1ec, 0x3a3834, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-300, 450, 520); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 1.4); rim.position.set(380, 200, -500); scene.add(rim);

  // the world: stage coordinates with y flipped, turned by the stage camera
  const pitchG = new THREE.Group(), yawG = new THREE.Group();
  scene.add(pitchG); pitchG.add(yawG);

  // ── the owner's model, rigged onto the DRC skeleton ─────────────────
  // Model space: metres, x = the robot's LEFT, y up, z forward. Skeleton
  // (URDF body frames): mm, x forward, y left, z up. conv() maps a model
  // point, relative to a reference, into skeleton mm; S puts the model's
  // pelvis (0.80 m) at the skeleton's 930 mm.
  const S = 1160;
  const conv = (p, r) => [(p[2] - r[2]) * S, (p[0] - r[0]) * S, (p[1] - r[1]) * S];
  const PELVIS = [0, 0.80, -0.01], TORSO = [0, 0.983, -0.01];
  // which piece each part belongs to
  const pieceOf = name => {
    const sd = /\.L$/.test(name) ? 'l' : /\.R$/.test(name) ? 'r' : '';
    if (/^(Head_|Neck|Torso|Shoulder_Pitch|Shoulder_Band|Waist_)/.test(name)) return 'torso';
    if (/^(Pelvis_|Hip_Actuator|Hip_Band|Hip_Cap|Hip_Bolts)/.test(name)) return 'pelvis';
    if (/^(Shoulder_Bracket|Shoulder_Roll|UpperArm)/.test(name)) return sd + 'upper';
    if (/^(Elbow|Forearm)/.test(name)) return sd + 'fore';
    if (/^(Wrist_|Hand_)/.test(name)) return sd + 'hand';
    if (/^(Hip_Yaw|Thigh)/.test(name)) return sd + 'thigh';
    if (/^(Knee|Shin)/.test(name)) return sd + 'shin';
    if (/^(Ankle|Foot)/.test(name)) return sd + 'foot';
    return 'torso';
  };
  // limb pieces: model pivot P and child C; the skeleton bone (from, to)
  // they aim along; the body whose forward keeps their front forward; the
  // body whose scale grows them. Each hangs from the END of the piece
  // before it (the torso/pelvis for the first), so a limb never parts.
  const LIMBS = [];
  for (const [sd, sx] of [['l', 1], ['r', -1]]) {
    const X = v => v * sx;
    LIMBS.push(
      { id: sd + 'upper', P: [X(0.250), 1.240, -0.005], C: [X(0.252), 0.985, -0.005], from: sd + '_scap', to: sd + '_larm', fwd: 'utorso', root: 'torso' },
      { id: sd + 'fore', P: [X(0.252), 0.985, -0.005], C: [X(0.252), 0.782, -0.003], from: sd + '_larm', to: sd + '_hand', fwd: 'utorso', root: sd + 'upper' },
      { id: sd + 'hand', P: [X(0.252), 0.782, -0.003], C: [X(0.252), 0.66, -0.003], from: sd + '_larm', to: sd + '_hand', fwd: 'utorso', root: sd + 'fore' },
      { id: sd + 'thigh', P: [X(0.140), 0.800, -0.010], C: [X(0.140), 0.465, -0.012], from: sd + '_uleg', to: sd + '_lleg', fwd: 'pelvis', root: 'pelvis' },
      { id: sd + 'shin', P: [X(0.140), 0.465, -0.012], C: [X(0.140), 0.095, -0.005], from: sd + '_lleg', to: sd + '_talus', fwd: 'pelvis', root: sd + 'thigh' },
      { id: sd + 'foot', P: [X(0.140), 0.095, -0.005], C: null, body: sd + '_foot', root: sd + 'shin' },
    );
  }
  const RIGID = { torso: { body: 'utorso', ref: TORSO }, pelvis: { body: 'pelvis', ref: PELVIS } };
  const refOf = id => (RIGID[id] ? RIGID[id].ref : LIMBS.find(l => l.id === id).P);
  // each limb's rest frame (fwd, left, up columns → a bone-aligned basis)
  const norm = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const frame = (axis, fwd) => {        // e2 along the bone, e0 the forward made perpendicular, e1 = e2 x e0
    const e2 = norm(axis);
    const e0 = norm(fwd.map((v, i) => v - dot(fwd, e2) * e2[i]));
    return [e0, cross(e2, e0), e2];
  };
  for (const L of LIMBS) if (L.C) { L.len = Math.hypot(...conv(L.C, L.P)); L.rest = frame(conv(L.C, L.P), [1, 0, 0]); }

  const groups = new Map();              // piece id -> Group (matrix set per frame)
  const bbox = new Map();                // piece id -> local bounding box (mm)
  const mats = [], geos = [];
  let ready = false;
  const matFor = (name, def) => {
    const kd = def.kd, ke = def.ke;
    const lin = new THREE.Color().setRGB(kd[0], kd[1], kd[2], THREE.LinearSRGBColorSpace);
    const isMetal = /Metal/.test(name), isGrille = /Grille/.test(name);
    const m = new THREE.MeshStandardMaterial({
      color: isGrille ? new THREE.Color(0x1a1c20) : lin,
      roughness: isGrille ? 0.7 : Math.max(0.12, Math.min(0.85, 1 - Math.sqrt(def.ns / 1000))),
      metalness: isMetal ? 0.85 : /Glass/.test(name) ? 0.3 : 0.08,
    });
    const e = Math.max(ke[0], ke[1], ke[2]);
    if (e > 0) { m.emissive = new THREE.Color().setRGB(ke[0] / e, ke[1] / e, ke[2] / e, THREE.LinearSRGBColorSpace); m.emissiveIntensity = Math.min(2.2, e * 0.55); }
    mats.push(m);
    return m;
  };
  fetch(new URL('../robots/atlas26.bin', import.meta.url)).then(r => r.arrayBuffer()).then(buf => {
    const dv = new DataView(buf);
    const hl = dv.getUint32(0, true);
    const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
    let o = 4 + hl; o += (4 - (o % 4)) % 4;
    const nV = hdr.parts.reduce((s, p) => s + p.vCount, 0);
    const P = new Int16Array(buf, o, nV * 3); o += nV * 6; o += (4 - (o % 4)) % 4;
    const Nn = new Int8Array(buf, o, nV * 4); o += nV * 4;
    const I = new Uint16Array(buf, o, hdr.parts.reduce((s, p) => s + p.iCount, 0));
    const mcache = {};
    for (const p of hdr.parts) {
      const id = pieceOf(p.name), ref = refOf(id);
      const pos = new Float32Array(p.vCount * 3), nor = new Float32Array(p.vCount * 3);
      for (let i = 0; i < p.vCount; i++) {
        const k = (p.v0 + i) * 3, n = (p.v0 + i) * 4;
        const c = conv([P[k] / 1e4, P[k + 1] / 1e4, P[k + 2] / 1e4], ref);
        pos[i * 3] = c[0]; pos[i * 3 + 1] = c[1]; pos[i * 3 + 2] = c[2];
        nor[i * 3] = Nn[n + 2] / 127; nor[i * 3 + 1] = Nn[n] / 127; nor[i * 3 + 2] = Nn[n + 1] / 127;   // same axis shuffle
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(new THREE.BufferAttribute(I.slice(p.i0, p.i0 + p.iCount), 1));
      geos.push(g);
      const bb = bbox.get(id) || bbox.set(id, { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }).get(id);
      for (let i = 0; i < p.vCount; i++) for (let c = 0; c < 3; c++) { const v = pos[i * 3 + c]; if (v < bb.min[c]) bb.min[c] = v; if (v > bb.max[c]) bb.max[c] = v; }
      let grp = groups.get(id);
      if (!grp) { grp = new THREE.Group(); grp.matrixAutoUpdate = false; grp.visible = false; yawG.add(grp); groups.set(id, grp); }
      grp.add(new THREE.Mesh(g, mcache[p.mat] || (mcache[p.mat] = matFor(p.mat, hdr.mats[p.mat] || { kd: [0.5, 0.5, 0.5], ke: [0, 0, 0], ns: 250 }))));
    }
    ready = true;
  }).catch(() => {});

  // stage matrix {m (3x3 row-major, carries scale), t} -> three, y flipped
  const toM4 = (T, out) => out.set(
    T.m[0], T.m[1], T.m[2], T.t[0],
    -T.m[3], -T.m[4], -T.m[5], -T.t[1],
    T.m[6], T.m[7], T.m[8], T.t[2],
    0, 0, 0, 1);
  const tmpM = new THREE.Matrix4();
  const scaleOf = T => Math.cbrt(Math.abs(T.m[0] * (T.m[4] * T.m[8] - T.m[5] * T.m[7]) - T.m[1] * (T.m[3] * T.m[8] - T.m[5] * T.m[6]) + T.m[2] * (T.m[3] * T.m[7] - T.m[4] * T.m[6])));
  const apply = (T, v) => [T.m[0] * v[0] + T.m[1] * v[1] + T.m[2] * v[2] + T.t[0], T.m[3] * v[0] + T.m[4] * v[1] + T.m[5] * v[2] + T.t[1], T.m[6] * v[0] + T.m[7] * v[1] + T.m[8] * v[2] + T.t[2]];
  const setGroup = (id, T, vis) => { const g = groups.get(id); if (!g) return; g.visible = vis; if (vis) { toM4(T, tmpM); g.matrix.copy(tmpM); g.matrixWorldNeedsUpdate = true; } };

  // Solve every piece's stage placement from the skeleton (no drawing).
  // Returns id -> { T, vis }.
  const solve = (at, k0) => {
    const out = {};
    const setGroup = (id, T, vis) => { out[id] = { T, vis: !!T && vis }; };
      const placed = {};
      for (const [id, R] of Object.entries(RIGID)) {
        const T = at(R.body);
        const vis = !!T && scaleOf(T) / k0 > 0.03;
        setGroup(id, T, vis);
        placed[id] = T;
      }
      for (const L of LIMBS) {
        const root = placed[L.root];
        if (!root) { setGroup(L.id, null, false); continue; }
        // the pivot: the model's joint point carried by the piece above
        const rootRef = refOf(L.root);
        const pivot = apply(root, conv(L.P, rootRef));
        if (!L.C) {                            // the foot: its skeleton body's orientation, at the ankle
          const F = at(L.body);
          const k = F ? scaleOf(F) : 0;
          const T = F ? { m: F.m, t: pivot } : null;
          setGroup(L.id, T, !!F && k / k0 > 0.03);
          continue;
        }
        const A = at(L.from), B = at(L.to), Fw = at(L.fwd);
        if (!A || !B || !Fw) { setGroup(L.id, null, false); continue; }
        const k = Math.min(scaleOf(A), scaleOf(B));
        const axis = [B.t[0] - A.t[0], B.t[1] - A.t[1], B.t[2] - A.t[2]];
        const fwd = [Fw.m[0], Fw.m[3], Fw.m[6]];
        const E = frame(axis, fwd), E0 = L.rest;
        // R = E · E0ᵀ (columns e0 e1 e2), times the scale
        const m = new Array(9);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r * 3 + c] = k * (E[0][r] * E0[0][c] + E[1][r] * E0[1][c] + E[2][r] * E0[2][c]);
        const T = { m, t: pivot };
        setGroup(L.id, T, k / k0 > 0.03);
        placed[L.id] = T;
      }
    return out;
  };
  const setGroupReal = setGroup;
  let shown = false;
  return {
    get ready() { return ready; },
    // size the GL canvas to the Canvas2D drawing's box (W x H at `fit`)
    resize(fit, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(Math.round(W * fit), Math.round(H * fit), false);
      canvas.style.width = `${W * fit}px`; canvas.style.height = `${H * fit}px`;
    },
    // at(name) -> {m, t} for every skeleton body; k0 the base scale (px/mm);
    // cam {yaw, pitch, dolly}; dark theme flag
    // `over`: id -> placement for pieces in flight (a morph carries them)
    render(at, k0, cam, dark, vis, over) {
      if (!ready) return;
      if (!shown) { canvas.style.visibility = 'visible'; shown = true; }
      pitchG.rotation.x = -cam.pitch;          // stage pitch: positive looks UP
      yawG.rotation.y = cam.yaw;
      pitchG.position.z = cam.dolly || 0;
      const sol = solve(at, k0);
      for (const [id, P] of Object.entries(sol)) {
        const T = over && over[id] ? over[id] : P.T;
        setGroupReal(id, T, (over && over[id] ? true : P.vis) && (!vis || vis[id] !== false));
      }
      renderer.render(scene, camera);
    },
    // where each piece is, for the morphs that turn other robots into this
    // one: its placement, its local box, and two stage points along it
    // (pivot and far end for limbs; bottom and top for the rigid pieces)
    pieces(at, k0) {
      if (!ready) return null;
      const sol = solve(at, k0), out = {};
      for (const [id, P] of Object.entries(sol)) {
        if (!P.T) continue;
        const bb = bbox.get(id); if (!bb) continue;
        const L = LIMBS.find(l => l.id === id);
        const c = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2];
        const p0 = L && L.C ? P.T.t : apply(P.T, [c[0], c[1], L ? bb.max[2] : bb.min[2]]);
        const p1 = L && L.C ? apply(P.T, conv(L.C, L.P)) : apply(P.T, [c[0], c[1], L ? bb.min[2] : bb.max[2]]);
        out[id] = { T: P.T, bb, p0, p1 };
      }
      return out;
    },
    hide() {
      if (!shown) return;
      renderer.clear();
      canvas.style.visibility = 'hidden';
      shown = false;
    },
    dispose() {
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
      renderer.dispose(); canvas.remove();
    },
  };
}
