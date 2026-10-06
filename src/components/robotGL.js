// The right stage's WebGL backend (Oct 6). Flourish3D still does all of the
// geometry: kinematics, the grow-ins, the morphs, the jobs, and the
// projection of every point onto the 340x660 stage (`cam()`). It hands the
// projected result here, and this draws it with a DEPTH BUFFER and per-pixel
// light instead of a painter's sort of flat-filled triangles.
//
// Why (the owner, more than once: "textures still glitching on the
// so-arm101", "I can see a lot of triangles"): Canvas2D fills each triangle
// with ONE tone, so a curved surface shows its facets, and it orders parts by
// sorting face centres into depth slabs, so two parts close in depth trade
// places frame to frame. Here a baked robot is lit from its smooth vertex
// normals, and every face, prop and line is depth-tested per pixel.
//
// Everything arrives in STAGE SCREEN SPACE — x right, y down, in drawing
// units, plus the view depth z (toward the viewer positive) that cam()
// already computes — and is drawn by an orthographic camera over exactly the
// stage box, so it lands on the pixel the line art would have used. Three
// kinds of geometry, rebuilt per frame into growable buffers:
//   lit   the baked meshes: per-vertex view-space normals, MeshStandardMaterial
//   flat  the drawn props' faces (already toned by Flourish3D): unlit
//   lines the line art: unlit, depth-tested, so hidden lines are hidden
// Faces with alpha < 1 go to a second, transparent pass of each kind.
import * as THREE from 'three';

const W = 340, H = 660;

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
export const linRGB = rgb => [toLin(rgb[0] / 255), toLin(rgb[1] / 255), toLin(rgb[2] / 255)];

// A growable vertex stream: position (3), colour (4), optional normal (3),
// optional index. One BufferGeometry, re-uploaded per frame.
function stream(withNormal, indexed) {
  const s = { n: 0, ni: 0, pos: new Float32Array(3 * 4096), col: new Float32Array(4 * 4096),
              nrm: withNormal ? new Float32Array(3 * 4096) : null, idx: indexed ? new Uint32Array(3 * 8192) : null };
  s.geo = new THREE.BufferGeometry();
  const bind = () => {
    s.geo.setAttribute('position', new THREE.BufferAttribute(s.pos, 3).setUsage(THREE.DynamicDrawUsage));
    s.geo.setAttribute('color', new THREE.BufferAttribute(s.col, 4).setUsage(THREE.DynamicDrawUsage));
    if (s.nrm) s.geo.setAttribute('normal', new THREE.BufferAttribute(s.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    if (s.idx) s.geo.setIndex(new THREE.BufferAttribute(s.idx, 1).setUsage(THREE.DynamicDrawUsage));
  };
  bind();
  s.room = (verts, inds = 0) => {
    let grow = false;
    if ((s.n + verts) * 3 > s.pos.length) {
      let c = s.pos.length / 3; while (c < s.n + verts) c *= 2;
      const p = new Float32Array(c * 3); p.set(s.pos.subarray(0, s.n * 3)); s.pos = p;
      const q = new Float32Array(c * 4); q.set(s.col.subarray(0, s.n * 4)); s.col = q;
      if (s.nrm) { const r = new Float32Array(c * 3); r.set(s.nrm.subarray(0, s.n * 3)); s.nrm = r; }
      grow = true;
    }
    if (s.idx && s.ni + inds > s.idx.length) {
      let c = s.idx.length; while (c < s.ni + inds) c *= 2;
      const i2 = new Uint32Array(c); i2.set(s.idx.subarray(0, s.ni)); s.idx = i2;
      grow = true;
    }
    if (grow) { s.geo.dispose(); s.geo = new THREE.BufferGeometry(); bind(); if (s.obj) s.obj.geometry = s.geo; }
  };
  s.commit = () => {
    const g = s.geo;
    for (const k of ['position', 'color', 'normal']) {
      const a = g.getAttribute(k); if (!a) continue;
      a.clearUpdateRanges(); a.addUpdateRange(0, s.n * a.itemSize); a.needsUpdate = true;
    }
    if (s.idx) { const ix = g.getIndex(); ix.clearUpdateRanges(); ix.addUpdateRange(0, s.ni); ix.needsUpdate = true; }
    g.setDrawRange(0, s.idx ? s.ni : s.n);
    if (s.obj) s.obj.visible = (s.idx ? s.ni : s.n) > 0;
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
  renderer.sortObjects = true;

  const scene = new THREE.Scene();
  // stage box: x 0..W, y 0..-H (stage y is down), view depth z
  const camera = new THREE.OrthographicCamera(0, W, 0, -H, -4000, 4000);
  camera.position.set(0, 0, 0);
  // a soft studio in VIEW space: sky/ground fill, a key from the upper left
  // front (the line art's KEY light), a cool rim from behind on the right
  const hemi = new THREE.HemisphereLight(0xf7f4ef, 0x55514b, 1.35); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-0.45, 0.62, 0.64); scene.add(key);
  const fillL = new THREE.DirectionalLight(0xffffff, 0.35); fillL.position.set(0.5, -0.1, 0.85); scene.add(fillL);
  const rim = new THREE.DirectionalLight(0xd2ddff, 0.8); rim.position.set(0.6, 0.35, -0.7); scene.add(rim);

  const litMat = o => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide,
    transparent: o, depthWrite: !o });
  const flatMat = o => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false,
    transparent: o, depthWrite: !o, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const S = {
    lit: stream(true, true), litT: stream(true, true),
    flat: stream(false, false), flatT: stream(false, false),
    line: stream(false, false),
  };
  S.lit.obj = new THREE.Mesh(S.lit.geo, litMat(false));
  S.litT.obj = new THREE.Mesh(S.litT.geo, litMat(true));
  S.flat.obj = new THREE.Mesh(S.flat.geo, flatMat(false));
  S.flatT.obj = new THREE.Mesh(S.flatT.geo, flatMat(true));
  S.line.obj = new THREE.LineSegments(S.line.geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, toneMapped: false, depthWrite: false }));
  S.lit.obj.renderOrder = 0; S.flat.obj.renderOrder = 1; S.litT.obj.renderOrder = 2; S.flatT.obj.renderOrder = 3; S.line.obj.renderOrder = 4;
  for (const s of Object.values(S)) { s.obj.frustumCulled = false; s.obj.matrixAutoUpdate = false; scene.add(s.obj); }

  let shown = false;
  const put = (s, x, y, z, c, a) => {
    const i = s.n++;
    s.pos[i * 3] = x; s.pos[i * 3 + 1] = -y; s.pos[i * 3 + 2] = z;
    s.col[i * 4] = c[0]; s.col[i * 4 + 1] = c[1]; s.col[i * 4 + 2] = c[2]; s.col[i * 4 + 3] = a;
    return i;
  };

  return {
    resize(fit, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(Math.round(W * fit), Math.round(H * fit), false);
      canvas.style.width = `${W * fit}px`; canvas.style.height = `${H * fit}px`;
    },
    begin() { for (const s of Object.values(S)) { s.n = 0; s.ni = 0; } },
    // a baked mesh, already projected: scr = x,y,z per vertex (stage screen),
    // nrm = unit view-space normals per vertex (stage axes, y down), f/nf its
    // faces, rgb LINEAR, alpha
    mesh(nv, scr, nrm, f, nf, rgb, a) {
      const s = a < 0.999 ? S.litT : S.lit;
      s.room(nv, nf * 3);
      const base = s.n;
      for (let i = 0; i < nv; i++) {
        put(s, scr[i * 3], scr[i * 3 + 1], scr[i * 3 + 2], rgb, a);
        const j = (base + i) * 3;
        s.nrm[j] = nrm[i * 3]; s.nrm[j + 1] = -nrm[i * 3 + 1]; s.nrm[j + 2] = nrm[i * 3 + 2];
      }
      const ix = s.idx;
      for (let i = 0; i < nf * 3; i++) ix[s.ni + i] = base + f[i];
      s.ni += nf * 3;
    },
    // a toned polygon (a fan) from the Canvas2D path's point buffer
    poly(P, Z, o, n, colour, a) {
      if (n < 3) return;
      const s = a < 0.999 ? S.flatT : S.flat, c = parseCol(colour);
      s.room((n - 2) * 3);
      const zo = o >> 1;
      for (let i = 1; i < n - 1; i++) {
        put(s, P[o], P[o + 1], Z[zo], c, a);
        put(s, P[o + i * 2], P[o + i * 2 + 1], Z[zo + i], c, a);
        put(s, P[o + i * 2 + 2], P[o + i * 2 + 3], Z[zo + i + 1], c, a);
      }
    },
    // a polyline (bias already in Z)
    line(P, Z, o, n, colour, a, bias) {
      if (n < 2) return;
      const s = S.line, c = parseCol(colour);
      s.room((n - 1) * 2);
      const zo = o >> 1;
      for (let i = 0; i < n - 1; i++) {
        put(s, P[o + i * 2], P[o + i * 2 + 1], Z[zo + i] + bias, c, a);
        put(s, P[o + i * 2 + 2], P[o + i * 2 + 3], Z[zo + i + 1] + bias, c, a);
      }
    },
    // draw the frame; true if anything was drawn
    end() {
      let any = false;
      for (const s of Object.values(S)) { s.commit(); if (s.n) any = true; }
      if (!any) { this.hide(); return false; }
      if (!shown) { canvas.style.visibility = 'visible'; shown = true; }
      renderer.render(scene, camera);
      return true;
    },
    hide() { if (shown) { renderer.clear(); canvas.style.visibility = 'hidden'; shown = false; } },
    dispose() {
      for (const s of Object.values(S)) { s.geo.dispose(); s.obj.material.dispose(); }
      renderer.dispose(); canvas.remove();
    },
  };
}
