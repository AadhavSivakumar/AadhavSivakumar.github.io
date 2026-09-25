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

  // CHEST: a graphite block, wider at the top, with a big blue front panel
  // over its lower two thirds, a dark label band above it, side panels
  part('utorso', box(420, 260, 330, 50), dark, [-15, 0, 420]);
  part('utorso', box(360, 240, 250, 45), dark, [-15, 0, 150]);
  part('utorso', box(330, 30, 300, 26), blue, [112, 0, 230]);               // the blue front panel
  part('utorso', box(300, 16, 50, 10), black, [112, 0, 440]);               // the label band
  for (const sy of [-1, 1]) part('utorso', box(24, 170, 220, 10), blue, [-20, sy * 185, 280]);   // blue side panels
  // WAIST: a ribbed black column down to the pelvis
  for (let i = 0; i < 5; i++) part('utorso', G(new THREE.CylinderGeometry(96 - i * 3, 96 - i * 3, 24, 36)), black, [-10, 0, -4 - i * 30], Z_UP);
  part('utorso', G(new THREE.CylinderGeometry(78, 78, 150, 36)), dark, [-10, 0, -60], Z_UP);
  // SHOULDERS: huge black rounded blocks on the chest's top corners
  for (const sy of [-1, 1]) part('utorso', box(150, 190, 170, 60), black, [-15, sy * 250, 520]);
  // NECK and HEAD: a short dark neck; a round head, blue-shelled, facing +x,
  // with a thick warm ring light round a glossy black visor, and an antenna
  part('utorso', G(new THREE.CylinderGeometry(48, 56, 110, 32)), dark, [-5, 0, 640], Z_UP);
  const headShell = new THREE.LatheGeometry([[0, -95], [110, -92], [140, -70], [150, -30], [150, 40], [140, 70], [120, 82], [0, 82]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
  part('utorso', G(headShell), blue, [0, 0, 830], X_AX);
  part('utorso', G(new THREE.TorusGeometry(116, 20, 24, 80)), glow, [88, 0, 830], [0, Math.PI / 2, 0]);   // the ring light
  part('utorso', G(new THREE.CylinderGeometry(98, 98, 14, 72)), face, [92, 0, 830], X_AX);                 // the visor, proud of the shell's face
  part('utorso', box(120, 12, 36, 10), dark, [101, 0, 824]);                                               // the sensor slot across it
  part('utorso', G(new THREE.CylinderGeometry(5, 6, 90, 10)), black, [-40, 70, 1000], Z_UP);               // the antenna
  // PELVIS: a dark block between two big black lateral hip drums
  part('pelvis', box(300, 200, 150, 50), dark, [0, 0, -50]);
  for (const sy of [-1, 1]) {
    part('pelvis', G(new THREE.CylinderGeometry(112, 112, 110, 48)), black, [15, sy * 165, -80]);          // axis lateral (y)
    part('pelvis', G(new THREE.CylinderGeometry(70, 70, 114, 36)), dark, [15, sy * 165, -80]);
  }
  // KNEES and ELBOWS: lateral black drums at the joints, with a dark face disc
  for (const sd of ['l', 'r']) {
    part(sd + '_lleg', G(new THREE.CylinderGeometry(84, 84, 186, 48)), black, [0, 0, 0]);     // proud of the leg on both sides
    part(sd + '_lleg', G(new THREE.CylinderGeometry(52, 52, 190, 36)), dark, [0, 0, 0]);
    part(sd + '_talus', G(new THREE.CylinderGeometry(60, 60, 110, 36)), black, [0, 0, 0]);
    part(sd + '_larm', G(new THREE.CylinderGeometry(72, 72, 130, 40)), black, [0, 0, 0], X_AX);
    // HANDS: a dark palm with three fingers; FEET: long black soles, rounded heel
    part(sd + '_hand', box(70, 90, 110, 22), dark, [0, 0, -30]);
    for (const f of [-1, 0, 1]) part(sd + '_hand', box(20, 26, 80, 9), black, [f * 28, sd === 'l' ? 15 : -15, -120]);
    part(sd + '_foot', box(130, 280, 70, 28), black, [40, 0, -65]);
    part(sd + '_foot', G(new THREE.CylinderGeometry(60, 60, 128, 32)), black, [-80, 0, -40]);
  }

  // LIMBS are bones between body origins (as the Canvas2D drawer had them):
  // a tapered white shell, rounded ends, a black ball at the far joint
  const BONES = [   // from, to, radius at from, radius at to, joint ball radius (0 = none; the drums are the joints)
    ['l_scap', 'l_larm', 78, 70, 0, 'blue'], ['r_scap', 'r_larm', 78, 70, 0, 'blue'],
    ['l_larm', 'l_hand', 60, 50, 0, 'dark'], ['r_larm', 'r_hand', 60, 50, 0, 'dark'],     // forearms graphite (the photos)
    ['l_lglut', 'l_lleg', 92, 84, 0, 'blue'], ['r_lglut', 'r_lleg', 92, 84, 0, 'blue'],
    ['l_lleg', 'l_talus', 80, 58, 0, 'dark'], ['r_lleg', 'r_talus', 80, 58, 0, 'dark'],     // shins graphite
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
    const m = new THREE.Mesh(G(new THREE.CylinderGeometry(1, 1, 1, 32)), black);   // the shoulder link: the black shoulder block continues down
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
        place(L.m, va, vb, 58 * scaleOf(S), 58 * scaleOf(S));
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
