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

  // materials, after the photos: a white shell, satin black joints, a grey
  // pelvis, a glossy dark face, the ring light
  const white = new THREE.MeshStandardMaterial({ color: 0xeceae6, roughness: 0.42, metalness: 0.05 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.5, metalness: 0.2 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9ea2a8, roughness: 0.35, metalness: 0.55 });
  const face = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.12, metalness: 0.3 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc94a, emissiveIntensity: 1.6, roughness: 0.4 });
  const mats = [white, black, grey, face, glow];

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
  const Z_UP = [Math.PI / 2, 0, 0];     // cylinders/capsules are Y-up in three; body frames are Z-up
  const X_AX = [0, 0, Math.PI / 2];     // an axis along x (the head faces +x)

  // torso: a tall rounded white box, a raised dark lower panel, a label strip
  part('utorso', G(new RoundedBoxGeometry(250, 440, 560, 6, 70)), white, [-15, 0, 330]);
  part('utorso', G(new RoundedBoxGeometry(24, 360, 230, 4, 30)), black, [116, 0, 190]);
  part('utorso', G(new RoundedBoxGeometry(12, 300, 32, 3, 10)), black, [112, 0, 400]);
  // waist actuator and its bright ring
  part('utorso', G(new THREE.CylinderGeometry(62, 66, 160, 40)), black, [0, 0, -40], Z_UP);
  part('utorso', G(new THREE.TorusGeometry(70, 8, 16, 48)), grey, [0, 0, -10]);
  // shoulders: big black balls on the torso's top corners
  for (const sy of [-1, 1]) part('utorso', G(new THREE.SphereGeometry(98, 40, 28)), black, [-10, sy * 215, 520]);
  // neck and head: a round disc facing forward, a dark face, the ring light, an antenna
  part('utorso', G(new THREE.CylinderGeometry(40, 46, 120, 32)), black, [0, 0, 665], Z_UP);
  const headShell = new THREE.LatheGeometry([[0, -70], [96, -68], [128, -52], [140, -20], [140, 38], [130, 60], [112, 68], [0, 68]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
  part('utorso', G(headShell), white, [0, 0, 830], X_AX);
  part('utorso', G(new THREE.CylinderGeometry(88, 88, 8, 64)), face, [70, 0, 830], X_AX);
  part('utorso', G(new THREE.TorusGeometry(103, 10, 20, 72)), glow, [72, 0, 830], [0, Math.PI / 2, 0]);
  part('utorso', G(new THREE.CylinderGeometry(4, 5, 70, 10)), glow, [-30, 60, 990], Z_UP);
  // pelvis between two big hip balls
  part('pelvis', G(new RoundedBoxGeometry(170, 280, 170, 5, 60)), grey, [0, 0, -60]);
  for (const sy of [-1, 1]) part('pelvis', G(new THREE.SphereGeometry(108, 40, 28)), black, [25, sy * 150, -60]);
  // hands and feet
  for (const sd of ['l', 'r']) {
    part(sd + '_hand', G(new RoundedBoxGeometry(80, 60, 140, 4, 22)), black, [0, 0, -40]);
    part(sd + '_foot', G(new RoundedBoxGeometry(270, 125, 60, 4, 24)), black, [40, 0, -65]);
  }

  // LIMBS are bones between body origins (as the Canvas2D drawer had them):
  // a tapered white shell, rounded ends, a black ball at the far joint
  const BONES = [   // from, to, radius at from, radius at to, joint ball radius, material
    ['l_scap', 'l_larm', 66, 58, 66], ['r_scap', 'r_larm', 66, 58, 66],
    ['l_larm', 'l_hand', 56, 46, 52], ['r_larm', 'r_hand', 56, 46, 52],
    ['l_lglut', 'l_lleg', 100, 80, 88], ['r_lglut', 'r_lleg', 100, 80, 88],
    ['l_lleg', 'l_talus', 80, 56, 60], ['r_lleg', 'r_talus', 80, 56, 60],
  ];
  const unitSphere = G(new THREE.SphereGeometry(1, 32, 20));
  const bones = BONES.map(([a, b, r0, r1, jr]) => {
    const shell = new THREE.Mesh(G(new THREE.CylinderGeometry(r1 / r0, 1, 1, 40, 1, false)), white);
    const capA = new THREE.Mesh(unitSphere, white), capB = new THREE.Mesh(unitSphere, white), ball = new THREE.Mesh(unitSphere, black);
    [shell, capA, capB, ball].forEach(m => yawG.add(m));
    return { a, b, r0, r1, jr, shell, capA, capB, ball };
  });
  // the shoulder links: from the torso's corner ball out to each arm's first joint
  const links = ['l', 'r'].map(sd => {
    const m = new THREE.Mesh(G(new THREE.CylinderGeometry(1, 1, 1, 32)), white);   // the upper arm near the shoulder is shell, not joint (the photos)
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
      white.color.setHex(dark ? 0xd9d6d0 : 0xeceae6);
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
        B.ball.position.copy(vb); B.ball.scale.setScalar(B.jr * k * 1.08);
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
