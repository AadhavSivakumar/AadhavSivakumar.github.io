// The right stage's WebGL renderer (Oct 6). Flourish3D still owns the
// kinematics: the grow-ins, the morphs, the jobs, every body's placement and
// the stage camera's yaw / pitch / dolly. What it no longer does in the GL
// path is touch a mesh vertex: each baked part is uploaded to the GPU ONCE as
// a static BufferGeometry, and a frame hands over one matrix per part — the
// part's placement composed with the camera's view (`V`, a 3x4 from setCam
// in Flourish3D) — and the GPU projects and lights every vertex. Before this,
// the CPU projected and re-uploaded ~6-9k triangles a robot every frame.
//
// The camera reproduces Flourish3D's cam() exactly: a perspective divide at
// PERSP from the stage centre, scaled by ZOOM. In GL terms that is a camera at
// z = PERSP looking down -z with tan(fov/2) = (H/2) / (PERSP * ZOOM). View
// space here is cam()'s rotated space with y flipped to point UP (V does the
// flip), so the lights below are in the same space as before.
//
// The drawn props (cubes, flaps, the UR frame, the cart, the OP1's unit) are
// still built per frame — they are a few hundred faces — and arrive already
// in view space, as toned polygons and lines, in growable streams.
import * as THREE from 'three';

const W = 340, H = 660, PERSP = 600, ZOOM = 0.85;

// 'rgb(r,g,b)' / '#rrggbb' -> linear [r,g,b], cached (the styles repeat)
const colCache = new Map();
const toLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function parseCol(s) {
  let v = colCache.get(s);
  if (v) return v;
  let r = 0, g = 0, b = 0;
  if (s[0] === '#') {
    const h = s.length === 4 ? s.slice(1).split('').map(c => c + c).join('') : s.slice(1);
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = s.match(/[\d.]+/g) || [];
    r = +m[0] || 0; g = +m[1] || 0; b = +m[2] || 0;
  }
  v = [toLin(r / 255), toLin(g / 255), toLin(b / 255)];
  colCache.set(s, v);
  return v;
}

// A growable vertex stream for the per-frame props: position (3), colour (4).
function stream() {
  const s = { n: 0, pos: new Float32Array(3 * 4096), col: new Float32Array(4 * 4096) };
  s.geo = new THREE.BufferGeometry();
  const bind = () => {
    s.geo.setAttribute('position', new THREE.BufferAttribute(s.pos, 3).setUsage(THREE.DynamicDrawUsage));
    s.geo.setAttribute('color', new THREE.BufferAttribute(s.col, 4).setUsage(THREE.DynamicDrawUsage));
  };
  bind();
  s.room = verts => {
    if ((s.n + verts) * 3 <= s.pos.length) return;
    let c = s.pos.length / 3; while (c < s.n + verts) c *= 2;
    const p = new Float32Array(c * 3); p.set(s.pos.subarray(0, s.n * 3)); s.pos = p;
    const q = new Float32Array(c * 4); q.set(s.col.subarray(0, s.n * 4)); s.col = q;
    s.geo.dispose(); s.geo = new THREE.BufferGeometry(); bind(); if (s.obj) s.obj.geometry = s.geo;
  };
  s.commit = () => {
    for (const k of ['position', 'color']) {
      const a = s.geo.getAttribute(k);
      a.clearUpdateRanges(); a.addUpdateRange(0, s.n * a.itemSize); a.needsUpdate = true;
    }
    s.geo.setDrawRange(0, s.n);
    s.obj.visible = s.n > 0;
  };
  s.put = (P, i, c, a) => {
    const j = s.n++;
    s.pos[j * 3] = P[i]; s.pos[j * 3 + 1] = P[i + 1]; s.pos[j * 3 + 2] = P[i + 2];
    s.col[j * 4] = c[0]; s.col[j * 4 + 1] = c[1]; s.col[j * 4 + 2] = c[2]; s.col[j * 4 + 3] = a;
  };
  return s;
}

export function createRobotGL(host, after) {
  const canvas = document.createElement('canvas');
  canvas.className = 'f3d-gl f3d-gl--robots';
  canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;visibility:hidden;';
  if (after && after.parentNode === host) host.insertBefore(canvas, after.nextSibling); else host.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    canvas.remove();
    return null;                       // no WebGL: Flourish3D keeps its own Canvas2D path
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.matrixWorldAutoUpdate = false;           // every object's matrix is set by hand
  const camera = new THREE.PerspectiveCamera(2 * Math.atan((H / 2) / (PERSP * ZOOM)) * 180 / Math.PI, W / H, 10, 8000);
  camera.position.set(0, 0, PERSP);
  camera.updateMatrixWorld();
  // a soft studio in VIEW space: sky/ground fill, a key from the upper left
  // front (the line art's KEY light), a cool rim from behind on the right
  const hemi = new THREE.HemisphereLight(0xf7f4ef, 0x55514b, 1.35); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-0.45, 0.62, 0.64); scene.add(key);
  const fillL = new THREE.DirectionalLight(0xffffff, 0.35); fillL.position.set(0.5, -0.1, 0.85); scene.add(fillL);
  const rim = new THREE.DirectionalLight(0xd2ddff, 0.8); rim.position.set(0.6, 0.35, -0.7); scene.add(rim);
  for (const l of [hemi, key, fillL, rim]) l.updateMatrixWorld();

  // Surfaces are pushed back a hair in depth so the line art lying ON them wins
  // (the Canvas2D path nudges lines forward by LINE_BIAS instead).
  const OFFSET = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const flatMat = o => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide, toneMapped: false,
    transparent: o, depthWrite: !o, ...OFFSET });
  const S = { flat: stream(), flatT: stream(), line: stream() };
  S.flat.obj = new THREE.Mesh(S.flat.geo, flatMat(false));
  S.flatT.obj = new THREE.Mesh(S.flatT.geo, flatMat(true));
  S.line.obj = new THREE.LineSegments(S.line.geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, toneMapped: false, depthWrite: false }));
  S.flat.obj.renderOrder = 1; S.flatT.obj.renderOrder = 3; S.line.obj.renderOrder = 4;
  for (const s of Object.values(S)) { s.obj.frustumCulled = false; s.obj.matrixAutoUpdate = false; s.obj.updateMatrixWorld(); scene.add(s.obj); }

  // ── the baked parts: one static geometry each, a pool of instances ──────
  // A part can be drawn more than once in a frame (the SO-ARM's servo STL is
  // placed five times; a morph draws both robots), so each geometry keeps a
  // pool of meshes, and a frame takes them in order. Each instance has its
  // own opaque and transparent material, because its colour is set per frame
  // (materials blend between two during a morph).
  const parts = new Map();                     // part -> { geo, pool: [], used }
  let live = [], prev = [], frame = 0;         // instances shown this frame / last frame
  const geoOf = part => {
    let e = parts.get(part);
    if (e) return e;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(part.v, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(part.vn, 3));
    geo.setIndex(new THREE.BufferAttribute(part.nv < 65536 ? new Uint16Array(part.f) : new Uint32Array(part.f), 1));
    geo.computeBoundingSphere();
    e = { geo, pool: [], used: 0 };
    parts.set(part, e);
    return e;
  };
  const litMat = o => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, side: THREE.FrontSide,
    transparent: o, depthWrite: !o, ...OFFSET });
  const instance = e => {
    let it = e.pool[e.used];
    if (!it) {
      it = new THREE.Mesh(e.geo, null);
      it.mats = [litMat(false), litMat(true)];
      it.matrixAutoUpdate = false;
      it.visible = false;
      scene.add(it);
      e.pool.push(it);
    }
    e.used++;
    return it;
  };

  let shown = false;
  return {
    resize(fit, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(Math.round(W * fit), Math.round(H * fit), false);
      canvas.style.width = `${W * fit}px`; canvas.style.height = `${H * fit}px`;
    },
    begin() {
      for (const s of Object.values(S)) s.n = 0;
      for (const e of parts.values()) e.used = 0;
      const t = prev; prev = live; live = t; live.length = 0; frame++;
    },
    // A baked part at placement (m 3x3 row-major, t) seen through the view V
    // (12 numbers: a 3x3 row-major then a translation), in LINEAR rgb.
    mesh(part, m, t, V, rgb, a) {
      const it = instance(geoOf(part));
      const o = a < 0.999;
      const mat = it.mats[o ? 1 : 0];
      mat.color.setRGB(rgb[0], rgb[1], rgb[2]);
      mat.opacity = a;
      it.material = mat;
      it.renderOrder = o ? 2 : 0;
      // matrixWorld = V ∘ [m | t]
      const e = it.matrixWorld.elements;      // column-major
      for (let r = 0; r < 3; r++) {
        const v0 = V[r * 3], v1 = V[r * 3 + 1], v2 = V[r * 3 + 2];
        e[r] = v0 * m[0] + v1 * m[3] + v2 * m[6];
        e[4 + r] = v0 * m[1] + v1 * m[4] + v2 * m[7];
        e[8 + r] = v0 * m[2] + v1 * m[5] + v2 * m[8];
        e[12 + r] = v0 * t[0] + v1 * t[1] + v2 * t[2] + V[9 + r];
      }
      e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
      it.visible = true; it.frame = frame;
      live.push(it);
    },
    // a toned polygon (a fan), its points already in view space (3 per point)
    poly(P, n, colour, a) {
      if (n < 3) return;
      const s = a < 0.999 ? S.flatT : S.flat, c = parseCol(colour);
      s.room((n - 2) * 3);
      for (let i = 1; i < n - 1; i++) { s.put(P, 0, c, a); s.put(P, i * 3, c, a); s.put(P, i * 3 + 3, c, a); }
    },
    // a polyline, view space
    line(P, n, colour, a) {
      if (n < 2) return;
      const s = S.line, c = parseCol(colour);
      s.room((n - 1) * 2);
      for (let i = 0; i < n - 1; i++) { s.put(P, i * 3, c, a); s.put(P, i * 3 + 3, c, a); }
    },
    // draw the frame; true if anything was drawn
    end() {
      for (const it of prev) if (it.frame !== frame) it.visible = false;
      let any = live.length > 0;
      for (const s of Object.values(S)) { s.commit(); if (s.n) any = true; }
      if (!any) { this.hide(); return false; }
      if (!shown) { canvas.style.visibility = 'visible'; shown = true; }
      renderer.render(scene, camera);
      return true;
    },
    hide() {
      for (const it of live) it.visible = false;
      if (shown) { renderer.clear(); canvas.style.visibility = 'hidden'; shown = false; }
    },
    dispose() {
      for (const s of Object.values(S)) { s.geo.dispose(); s.obj.material.dispose(); }
      for (const e of parts.values()) { e.geo.dispose(); for (const it of e.pool) for (const mt of it.mats) mt.dispose(); }
      renderer.dispose(); canvas.remove();
    },
  };
}
