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
// It draws NOTHING of its own kinematics. Each frame Flourish3D hands over the
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
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

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

  // materials, after Boston Dynamics' current product Atlas (the product
  // page's collage and render): a graphite body, blue shells, satin-black
  // joints, a glossy black visor and a warm-white ring light
  const blue = new THREE.MeshStandardMaterial({ color: 0x7890c8, roughness: 0.45, metalness: 0.15 });
  const white = blue;                                      // the limb shells (name kept for the bone code below)
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.55, metalness: 0.25 });
  const black = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.6, metalness: 0.2 });
  const grey = dark;
  const face = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.08, metalness: 0.4 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe2a8, emissiveIntensity: 1.8, roughness: 0.5 });
  const mats = [blue, dark, black, face, glow];

  // body-local parts, in mm, z UP (the URDF body frames), x forward
  const bodies = new Map();            // name -> Group (its matrix set per frame)
  const part = (name, geo, mat, pos, rot) => {
    let g = bodies.get(name);
    if (!g) { g = new THREE.Group(); g.matrixAutoUpdate = false; yawG.add(g); bodies.set(name, g); }
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    g.add(m);
    return m;
  };
  const geos = [];
  const G = geo => { geos.push(geo); return geo; };
  const Z_UP = [Math.PI / 2, 0, 0];     // cylinders are Y-up in three; body frames are Z-up
  const X_AX = [0, 0, Math.PI / 2];     // an axis along x (the head faces +x)
  const box = (w, d, h, r) => G(new RoundedBoxGeometry(d, w, h, 5, r));   // (width y, depth x, height z, corner radius)

  // ── DETAIL PASS (iterated against Boston Dynamics' product collage) ──
  const shellMat = blue.clone(); shellMat.side = THREE.DoubleSide;        // open half-shells
  const darkShell = dark.clone(); darkShell.side = THREE.DoubleSide;
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.3, metalness: 0.8 });
  mats.push(shellMat, darkShell, steel);
  const cyl = (r0, r1, h, seg = 40) => G(new THREE.CylinderGeometry(r1, r0, h, seg));
  // a half-shell round an axis (Y in three, Z once turned), `arc` radians
  // wide, centred on `face` (0 = +x, PI = -x)
  const halfShell = (r0, r1, h, arc, faceAng) => { const g = new THREE.CylinderGeometry(r1, r0, h, 40, 1, true, faceAng - arc / 2 + Math.PI / 2 - Math.PI / 2 + (Math.PI / 2 - 0), arc); return G(g); };
  // a grille: n small dark slots in a row along an axis
  const grille = (name, n, at, step, size, mat = black) => { for (let i = 0; i < n; i++) part(name, box(...size, 2), mat, [at[0] + step[0] * i, at[1] + step[1] * i, at[2] + step[2] * i]); };
  // a joint drum: black barrel, a bevel ring on each face, a steel cap
  const drumJ = (name, r, w, pos, axis) => {
    const rot = axis === 'x' ? X_AX : axis === 'z' ? Z_UP : undefined;
    part(name, cyl(r, r, w, 48), black, pos, rot);
    for (const sgn of [-1, 1]) {
      const o = axis === 'x' ? [sgn * w / 2, 0, 0] : axis === 'z' ? [0, 0, sgn * w / 2] : [0, sgn * w / 2, 0];
      const trot = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'z' ? undefined : [Math.PI / 2, 0, 0];
      part(name, G(new THREE.TorusGeometry(r * 0.72, r * 0.07, 10, 40)), dark, [pos[0] + o[0], pos[1] + o[1], pos[2] + o[2]], trot);
      const cap = axis === 'x' ? [sgn * (w / 2 + 2), 0, 0] : axis === 'z' ? [0, 0, sgn * (w / 2 + 2)] : [0, sgn * (w / 2 + 2), 0];
      part(name, cyl(r * 0.28, r * 0.28, 6, 24), steel, [pos[0] + cap[0], pos[1] + cap[1], pos[2] + cap[2]], rot);
    }
  };

  // CHEST: an upper graphite block with rounded shoulders, a narrower lower
  // block, a proud blue front panel with a seam, side vents, a label band
  part('utorso', box(430, 250, 300, 60), dark, [-15, 0, 430]);
  part('utorso', box(370, 235, 250, 45), dark, [-15, 0, 170]);
  part('utorso', box(340, 34, 290, 30), blue, [110, 0, 225]);                // the blue front panel
  part('utorso', box(300, 6, 4, 2), black, [128, 0, 150]);                  // its lower seam
  part('utorso', box(300, 6, 4, 2), black, [128, 0, 300]);                  // its upper seam
  part('utorso', box(300, 18, 46, 10), black, [108, 0, 450]);               // the label band
  { // the wordmark on the band
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#0d0e10'; x.fillRect(0, 0, 512, 64); x.fillStyle = '#d8dce4'; x.font = '600 34px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Boston Dynamics', 256, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1;   // the plane faces +x from behind its own normal: unmirror
    const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); mats.push(m);
    part('utorso', G(new THREE.PlaneGeometry(240, 30)), m, [118, 0, 450], [Math.PI / 2, Math.PI / 2, 0]);
  }
  for (const sy of [-1, 1]) {
    part('utorso', box(22, 180, 230, 10), blue, [-15, sy * 190, 270]);     // blue side panels
    grille('utorso', 6, [-80, sy * 202, 360], [26, 0, 0], [6, 14, 70]);   // side vents
  }
  // back: a dark battery pack
  part('utorso', box(300, 60, 300, 30), black, [-165, 0, 300]);
  // WAIST: a ribbed black barrel, knurled rings, a steel belt ring
  // (wide, as in the photos: the ribbed section is nearly as wide as the
  // lower chest and joins it to the pelvis — narrow, it read as a spring)
  part('utorso', box(300, 200, 60, 24), black, [-15, 0, 25]);                // a belt block under the chest
  part('utorso', G(new THREE.CylinderGeometry(118, 118, 170, 48)).scale(1, 1, 1), dark, [-10, 0, -80], Z_UP);
  for (let i = 0; i < 7; i++) part('utorso', G(new THREE.TorusGeometry(120, 8, 10, 56)), black, [-10, 0, -10 - i * 22]);
  part('utorso', G(new THREE.TorusGeometry(124, 7, 12, 56)), steel, [-10, 0, 0]);
  // SHOULDERS: huge black rounded blocks, a bevel line round each, the pitch drum outboard
  for (const sy of [-1, 1]) {
    part('utorso', box(150, 200, 175, 62), black, [-15, sy * 252, 522]);
    drumJ('utorso', 70, 40, [-15, sy * 335, 510]);
  }
  // NECK and HEAD: a short neck with a collar; a blue-shelled round head
  // (rear vents, a rounded rear cap), a thick warm ring light round a glossy
  // black visor carrying a sensor bar with two lenses, an antenna
  part('utorso', cyl(46, 52, 110, 32), dark, [-5, 0, 640], Z_UP);
  part('utorso', G(new THREE.TorusGeometry(56, 8, 10, 32)), black, [-5, 0, 600]);
  const headShell = new THREE.LatheGeometry([[0, -100], [70, -99], [118, -88], [145, -62], [152, -20], [152, 40], [146, 66], [130, 80], [0, 80]].map(([r, y]) => new THREE.Vector2(r, y)), 80);
  part('utorso', G(headShell), blue, [0, 0, 830], X_AX);
  part('utorso', G(new THREE.TorusGeometry(118, 21, 28, 96)), glow, [86, 0, 830], [0, Math.PI / 2, 0]);
  part('utorso', G(new THREE.TorusGeometry(142, 5, 10, 96)), dark, [70, 0, 830], [0, Math.PI / 2, 0]);   // the shell's front lip
  part('utorso', cyl(98, 98, 14, 80), face, [93, 0, 830], X_AX);
  part('utorso', box(150, 12, 40, 14), black, [102, 0, 822]);
  for (const sy of [-1, 1]) part('utorso', cyl(11, 11, 6, 24), steel, [109, sy * 42, 822], X_AX);   // its lenses
  for (const sy of [-1, 1]) grille('utorso', 5, [-60, sy * 128, 798], [0, 0, 16], [34, 8, 8]);   // head side vents, set into the rear shell (at the rim they stuck out like ears)
  part('utorso', cyl(5, 6, 90, 10), black, [-40, 75, 1000], Z_UP);
  part('utorso', G(new THREE.SphereGeometry(9, 12, 10)), black, [-40, 75, 1048]);
  // PELVIS: a dark block with a front plate between two big lateral hip drums
  part('pelvis', box(300, 210, 150, 55), dark, [0, 0, -50]);
  part('pelvis', box(220, 20, 90, 18), black, [106, 0, -60]);
  for (const sy of [-1, 1]) drumJ('pelvis', 108, 110, [15, sy * 168, -80]);
  // LEGS, modelled in their own body frames (so shells face forward):
  // thigh (uleg): a dark core to the knee at (-50, 0, -374), a blue shell over
  // its front and outside; knee (lleg origin): a lateral drum; shin (lleg):
  // a dark core to the ankle at (0, 0, -422), a blue calf plate behind;
  // ankle (talus): a lateral drum; foot: a long black sole, a heel roller
  const thighTilt = Math.atan2(50, 374);
  for (const sd of ['l', 'r']) {
    const out = sd === 'l' ? 1 : -1;
    const th = new THREE.Group(); th.rotation.y = thighTilt; th.position.set(-25, 0, -187);
    const addTo = (grp, geo, mat, pos, rot) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); grp.add(m); };
    addTo(th, cyl(74, 64, 374), dark, null, Z_UP);
    addTo(th, G(new THREE.CylinderGeometry(92, 102, 330, 40, 1, true, Math.PI / 2 - Math.PI * 0.62, Math.PI * 1.24)), shellMat, [0, 0, 10], Z_UP);   // centred on +x (theta PI/2 after the Z-up turn)
    addTo(th, box(8, 6, 250, 2), black, [101, 0, 0]);                         // the shell's seam
    part(sd + '_uleg', G(new THREE.BufferGeometry()), dark).add(th);
    drumJ(sd + '_lleg', 86, 176, [0, 0, 0]);
    const sh = new THREE.Group(); sh.position.set(0, 0, -211);
    addTo(sh, cyl(66, 52, 422), dark, null, Z_UP);
    addTo(sh, G(new THREE.CylinderGeometry(70, 86, 260, 40, 1, true, -Math.PI / 2 - Math.PI * 0.5, Math.PI * 1.0)), shellMat, [0, 0, 40], Z_UP);   // calf plate, behind (-x)
    addTo(sh, box(120, 40, 60, 14), black, [60, 0, 120]);                     // the shin's front guard
    part(sd + '_lleg', G(new THREE.BufferGeometry()), dark).add(sh);
    drumJ(sd + '_talus', 58, 120, [0, 0, 0]);
    part(sd + '_foot', box(135, 290, 62, 26), black, [45, 0, -70]);
    part(sd + '_foot', box(120, 200, 14, 6), dark, [70, 0, -104]);            // the sole
    part(sd + '_foot', cyl(52, 52, 132, 32), black, [-85, 0, -60]);
    // ELBOW: a lateral drum; HAND: a dark palm, a thumb and two jointed fingers
    drumJ(sd + '_larm', 70, 128, [0, 0, 0], 'x');
    part(sd + '_hand', box(78, 96, 110, 24), dark, [0, 0, -30]);
    part(sd + '_hand', G(new THREE.TorusGeometry(46, 7, 10, 32)), black, [0, 0, 20]);   // wrist ring
    for (const f of [-1, 1]) {
      part(sd + '_hand', box(24, 30, 70, 10), black, [f * 22, out * 18, -120]);
      part(sd + '_hand', box(22, 28, 60, 10), black, [f * 22, out * 26, -178], [out * 0.35, 0, 0]);
    }
    part(sd + '_hand', box(26, 30, 70, 10), black, [0, -out * 40, -100], [-out * 0.4, 0, 0]);   // thumb
  }
  // a blue shell over each upper arm, a blue plate on each forearm, as bones below

  // LIMBS are bones between body origins (as the Canvas2D drawer had them):
  // a tapered white shell, rounded ends, a black ball at the far joint
  const BONES = [   // from, to, radius at from, radius at to, joint ball radius (0 = none; the drums are the joints)
    ['l_scap', 'l_larm', 78, 70, 0, 'blue'], ['r_scap', 'r_larm', 78, 70, 0, 'blue'],
    ['l_larm', 'l_hand', 60, 50, 0, 'dark'], ['r_larm', 'r_hand', 60, 50, 0, 'dark'],     // forearms graphite (the photos)
    // (the legs are modelled in their body frames above)
  ];
  const unitSphere = G(new THREE.SphereGeometry(1, 32, 20));
  const bones = BONES.map(([a, b, r0, r1, jr, mn]) => {
    const M = mn === 'dark' ? dark : blue;
    const shell = new THREE.Mesh(G(new THREE.CylinderGeometry(r1 / r0, 1, 1, 40, 1, false)), M);
    const capA = new THREE.Mesh(unitSphere, M), capB = new THREE.Mesh(unitSphere, M), ball = new THREE.Mesh(unitSphere, black);
    [shell, capA, capB, ball].forEach(m => yawG.add(m));
    return { a, b, r0, r1, jr, shell, capA, capB, ball };
  });
  // the shoulder links: from the torso's corner ball out to each arm's first joint
  const links = ['l', 'r'].map(sd => {
    const m = new THREE.Mesh(G(new THREE.CylinderGeometry(1, 1, 1, 32)), blue);    // the upper arm's shell starts at the shoulder block (the photos)
    yawG.add(m);
    return { sd, m, sy: sd === 'l' ? 1 : -1 };
  });

  // stage matrix {m (3x3 row-major, carries scale), t} -> three, y flipped
  const toM4 = (T, out) => out.set(
    T.m[0], T.m[1], T.m[2], T.t[0],
    -T.m[3], -T.m[4], -T.m[5], -T.t[1],
    T.m[6], T.m[7], T.m[8], T.t[2],
    0, 0, 0, 1);
  const tmpM = new THREE.Matrix4(), va = new THREE.Vector3(), vb = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const scaleOf = T => Math.cbrt(Math.abs(T.m[0] * (T.m[4] * T.m[8] - T.m[5] * T.m[7]) - T.m[1] * (T.m[3] * T.m[8] - T.m[5] * T.m[6]) + T.m[2] * (T.m[3] * T.m[7] - T.m[4] * T.m[6])));
  const posOf = (T, v) => v.set(T.t[0], -T.t[1], T.t[2]);
  const place = (mesh, p0, p1, r0, r1) => {
    dir.subVectors(p1, p0); const L = dir.length();
    mesh.visible = L > 0.01 && r0 > 0.05;
    if (!mesh.visible) return;
    mesh.position.addVectors(p0, p1).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(up, dir.normalize());
    mesh.scale.set(r0, L, r0);
  };

  let shown = false;
  return {
    // size the GL canvas to the Canvas2D drawing's box (W x H at `fit`)
    resize(fit, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(Math.round(W * fit), Math.round(H * fit), false);
      canvas.style.width = `${W * fit}px`; canvas.style.height = `${H * fit}px`;
    },
    // at(name) -> {m, t} for every Atlas body; k0 the robot's base scale
    // (px/mm); cam {yaw, pitch, dolly} in radians/units; dark theme flag
    render(at, k0, cam, dark) {
      if (!shown) { canvas.style.visibility = 'visible'; shown = true; }
      pitchG.rotation.x = -cam.pitch;          // stage pitch: positive looks UP
      yawG.rotation.y = cam.yaw;
      pitchG.position.z = cam.dolly || 0;
      for (const [name, g] of bodies) {
        const T = at(name);
        const s = T ? scaleOf(T) / k0 : 0;
        g.visible = !!T && s > 0.03;
        if (g.visible) { toM4(T, tmpM); g.matrix.copy(tmpM); g.matrixWorldNeedsUpdate = true; }
      }
      for (const B of bones) {
        const A = at(B.a), Bt = at(B.b);
        const ga = A ? scaleOf(A) : 0, gb = Bt ? scaleOf(Bt) : 0;
        const k = Math.min(ga, gb);
        const vis = !!A && !!Bt && k / k0 > 0.03;
        B.shell.visible = B.capA.visible = B.capB.visible = B.ball.visible = vis;
        if (!vis) continue;
        posOf(A, va); posOf(Bt, vb);
        place(B.shell, va, vb, B.r0 * k, B.r1 * k);
        B.capA.position.copy(va); B.capA.scale.setScalar(B.r0 * k);
        B.capB.position.copy(vb); B.capB.scale.setScalar(B.r1 * k);
        B.ball.visible = B.jr > 0; B.ball.position.copy(vb); B.ball.scale.setScalar(Math.max(1e-3, B.jr * k * 1.08));
      }
      const U = at('utorso');
      for (const L of links) {
        const S = at(L.sd + '_scap');
        const vis = !!U && !!S && scaleOf(S) / k0 > 0.03;
        L.m.visible = vis;
        if (!vis) continue;
        // the torso's corner, in stage space, then flipped
        const c = [-10, L.sy * 215, 520];
        va.set(U.m[0] * c[0] + U.m[1] * c[1] + U.m[2] * c[2] + U.t[0], -(U.m[3] * c[0] + U.m[4] * c[1] + U.m[5] * c[2] + U.t[1]), U.m[6] * c[0] + U.m[7] * c[1] + U.m[8] * c[2] + U.t[2]);
        posOf(S, vb);
        place(L.m, va, vb, 76 * scaleOf(S), 76 * scaleOf(S));
      }
      renderer.render(scene, camera);
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
