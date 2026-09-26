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
  const blue = new THREE.MeshStandardMaterial({ color: 0x3f72b8, roughness: 0.42, metalness: 0.12 });   // the reference model's saturated blue
  const white = blue;                                      // the limb shells (name kept for the bone code below)
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.55, metalness: 0.25 });
  const black = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.6, metalness: 0.2 });
  const grey = dark;
  const face = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.08, metalness: 0.4 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xbff8ff, emissive: 0x5fe8ff, emissiveIntensity: 1.7, roughness: 0.5 });   // cyan ring
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

  // ── DETAIL PASS 2, after the 2026 Atlas reference model (Sketchfab,
  // RandomRepresent — viewed only, it is not downloadable) ──
  const shellMat = blue.clone(); shellMat.side = THREE.DoubleSide;
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.28, metalness: 0.85 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xdadde2, roughness: 0.3, metalness: 0.6 });
  const ribbed = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.5, metalness: 0.2 });
  mats.push(shellMat, steel, silver, ribbed);
  const cyl = (r0, r1, h, seg = 40) => G(new THREE.CylinderGeometry(r1, r0, h, seg));
  const tor = (R, r, seg = 48) => G(new THREE.TorusGeometry(R, r, 14, seg));
  const LAT = [Math.PI / 2, 0, 0];   // three's Y axis -> body z; for a LATERAL (y) axis use no rotation
  // a stack of rings round an axis: the ribbed collars and the knurled bars
  const ribs = (name, R, r, n, step, at, axis, mat) => {
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * step;
      const pos = axis === 'y' ? [at[0], at[1] + o, at[2]] : axis === 'z' ? [at[0], at[1], at[2] + o] : [at[0] + o, at[1], at[2]];
      part(name, tor(R, r, 40), mat, pos, axis === 'y' ? [Math.PI / 2, 0, 0] : axis === 'z' ? undefined : [0, Math.PI / 2, 0]);
    }
  };
  // a blue HUB: a lateral donut with a dark bore, the knee and ankle of the reference
  const hub = (name, R, w, pos) => {
    part(name, cyl(R, R, w, 48), blue, pos);                       // Y axis = lateral
    for (const sgn of [-1, 1]) {
      part(name, tor(R * 0.78, R * 0.22, 48), blue, [pos[0], pos[1] + sgn * w / 2, pos[2]], [Math.PI / 2, 0, 0]);
      part(name, cyl(R * 0.45, R * 0.45, 8, 32), black, [pos[0], pos[1] + sgn * (w / 2 + 2), pos[2]]);
    }
  };
  const texOf = draw => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

  // HEAD: blue rear shell with a fin on top; a dark MESH face (a grille
  // texture) with a sensor slot across its lower part; a cyan ring light
  const headShell = new THREE.LatheGeometry([[0, -100], [70, -99], [118, -88], [145, -62], [152, -20], [152, 40], [146, 66], [130, 80], [0, 80]].map(([r, y]) => new THREE.Vector2(r, y)), 80);
  part('utorso', G(headShell), blue, [0, 0, 830], [0, 0, -Math.PI / 2]);   // -90: the lathe's open (y+) end forward; +90 put its closed dome over the face
  part('utorso', box(30, 70, 60, 12), blue, [-60, 0, 975]);                  // the fin on top of the head
  const grilleTex = texOf(x => { x.fillStyle = '#121418'; x.fillRect(0, 0, 512, 512); x.fillStyle = '#2b2f36'; for (let yy = 8; yy < 512; yy += 14) for (let xx = (yy / 14 % 2) * 7 + 4; xx < 512; xx += 14) { x.beginPath(); x.arc(xx, yy, 4, 0, 7); x.fill(); } });
  const faceMat = new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.35, metalness: 0.3 }); mats.push(faceMat);
  part('utorso', cyl(112, 112, 12, 80), faceMat, [92, 0, 830], X_AX);
  part('utorso', G(new THREE.TorusGeometry(122, 13, 24, 96)), glow, [92, 0, 830], [0, Math.PI / 2, 0]);
  part('utorso', box(150, 14, 34, 12), black, [100, 0, 776]);                // the sensor slot
  for (const sy of [-1, 1]) part('utorso', cyl(10, 10, 6, 20), steel, [108, sy * 48, 776], X_AX);
  // NECK: a slim dark column with a steel ring
  part('utorso', cyl(40, 46, 150, 32), dark, [-10, 0, 650], Z_UP);
  part('utorso', tor(46, 7), steel, [-10, 0, 600]);
  // CHEST: a black upper block (the logos) over a big rounded BLUE block
  // that is the chest's lower two thirds, wrapping front and sides
  part('utorso', box(320, 220, 180, 55), black, [-15, 0, 500]);
  part('utorso', box(330, 240, 380, 70), blue, [-5, 0, 250]);
  part('utorso', box(290, 50, 300, 34), black, [-140, 0, 300]);             // the back
  { const tex = texOf(x => { x.fillStyle = '#0c0d0f'; x.fillRect(0, 0, 512, 512); x.fillStyle = '#e8ecf2'; x.strokeStyle = '#e8ecf2'; x.lineWidth = 10; x.beginPath(); x.ellipse(256, 170, 70, 42, 0, 0, 7); x.stroke(); x.font = 'bold 64px Arial'; x.textAlign = 'center'; x.fillText('H', 256, 194); x.font = '600 58px Arial'; x.fillText('BostonDynamics', 256, 330); });
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1;
    const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: false }); mats.push(m);
    part('utorso', G(new THREE.PlaneGeometry(170, 170)), m, [107, 0, 500], [Math.PI / 2, Math.PI / 2, 0]); }   // inside the black block's front face
  // WAIST: a horizontal ribbed bar across the chest's foot, a short black
  // column down to the pelvis
  part('utorso', cyl(52, 52, 250, 40), black, [0, 0, 40]);                   // lateral bar (Y axis)
  ribs('utorso', 54, 5, 9, 24, [0, 0, 40], 'y', dark);
  part('utorso', cyl(80, 74, 260, 36), black, [0, 0, -110], Z_UP);          // reaches the pelvis bar
  ribs('utorso', 82, 5, 8, 26, [0, 0, -110], 'z', dark);
  // SHOULDERS: black balls on the chest's top corners, a white ribbed collar
  // below each, before the blue upper arm
  for (const sy of [-1, 1]) {
    part('utorso', box(130, 150, 140, 46), black, [-10, sy * 215, 520]);          // shoulder block (the reference's shoulders are blocks, not balls)
  }
  // PELVIS: a horizontal black bar with round drum ends, ribbed at the
  // middle, white ribbed collars where the thighs hang
  part('pelvis', cyl(58, 58, 280, 40), black, [0, 0, -70]);
  ribs('pelvis', 60, 5, 6, 22, [0, 0, -70], 'y', dark);
  for (const sy of [-1, 1]) {
    part('pelvis', cyl(78, 78, 60, 48), black, [0, sy * 165, -70]);
    part('pelvis', cyl(34, 34, 66, 24), steel, [0, sy * 165, -70]);
  }
  // LEGS in their body frames. Thigh (uleg): a black core, a blue rounded
  // front shell over its upper two thirds. Knee (lleg origin) and ankle
  // (talus): blue hubs. Shin (lleg): a long flat black slab. Foot: a black
  // plate on a steel sole.
  const thighTilt = Math.atan2(50, 374);
  for (const sd of ['l', 'r']) {
    const out = sd === 'l' ? 1 : -1;
    const add = (grp, geo, mat, pos, rot) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); grp.add(m); };
    const th = new THREE.Group(); th.rotation.y = thighTilt; th.position.set(-25, 0, -187);
    add(th, box(100, 125, 374, 42), black);
    add(th, box(118, 100, 350, 42), blue, [30, 0, 0]);                        // the blue thigh shell, down to the knee hub
    part(sd + '_uleg', G(new THREE.BufferGeometry()), dark).add(th);
    ribs(sd + '_uleg', 56, 6, 4, 15, [0, 0, -18], 'z', ribbed);            // the white ribbed collar at the hip, on the thigh
    hub(sd + '_lleg', 64, 100, [0, 0, 0]);
    const sh = new THREE.Group(); sh.position.set(0, 0, -211);
    add(sh, box(84, 125, 390, 40), black);                                   // the flat shin slab
    add(sh, box(56, 24, 250, 12), dark, [66, 0, 0]);                           // its front ridge
    part(sd + '_lleg', G(new THREE.BufferGeometry()), dark).add(sh);
    hub(sd + '_talus', 50, 84, [0, 0, 0]);
    part(sd + '_foot', box(120, 280, 40, 16), black, [45, 0, -75]);
    part(sd + '_foot', box(110, 290, 12, 5), steel, [45, 0, -100]);
    // ELBOW: a black drum; HAND: a silver gripper with three fingers
    part(sd + '_larm', cyl(54, 54, 104, 40), black, [0, 0, 0], X_AX);
    ribs(sd + '_hand', 44, 6, 3, 14, [0, 0, 40], 'z', black);                 // the ribbed wrist
    part(sd + '_hand', box(80, 100, 100, 18), silver, [0, 0, -30]);
    for (const f of [-1, 0, 1]) {
      part(sd + '_hand', box(22, 30, 90, 8), silver, [f * 26, out * 12, -128]);
      part(sd + '_hand', box(8, 20, 60, 3), black, [f * 26, out * 12 + 16, -128]);   // the finger's dark pad
    }
  }

  // LIMBS are bones between body origins (as the Canvas2D drawer had them):
  // a tapered white shell, rounded ends, a black ball at the far joint
  const BONES = [   // from, to, radius at from, radius at to, joint ball radius (0 = none; the drums are the joints)
    ['l_scap', 'l_larm', 62, 56, 0, 'blue'], ['r_scap', 'r_larm', 62, 56, 0, 'blue'],
    ['l_larm', 'l_hand', 48, 42, 0, 'dark'], ['r_larm', 'r_hand', 48, 42, 0, 'dark'],     // forearms black (the reference)
    // (the legs are modelled in their body frames above)
  ];
  const unitSphere = G(new THREE.SphereGeometry(1, 32, 20));
  // Limbs are ROUNDED SLABS (the listing's clay render and the Sketchfab
  // views: rectangular-section shells with big fillets, not tubes), oriented
  // each frame so their flat face points the way the parent body faces, plus
  // a BLOCK joint at the far end (the elbow; the knee/ankle hubs are parts)
  const slabGeo = G(new RoundedBoxGeometry(1, 1, 1, 5, 0.32));
  const bones = BONES.map(([a, b, r0, r1, jr, mn]) => {
    const M = mn === 'dark' ? black : blue;
    const shell = new THREE.Mesh(slabGeo, M); shell.matrixAutoUpdate = false;
    const capA = new THREE.Mesh(unitSphere, M), capB = new THREE.Mesh(unitSphere, M), ball = new THREE.Mesh(unitSphere, black);
    capA.visible = capB.visible = false;
    [shell, ball].forEach(m => yawG.add(m));
    return { a, b, r0, r1, jr, shell, capA, capB, ball };
  });
  const bx = new THREE.Vector3(), bz = new THREE.Vector3(), fwd = new THREE.Vector3();
  const placeSlab = (mesh, A, p0, p1, w, d) => {
    dir.subVectors(p1, p0); const L = dir.length();
    if (L < 0.01) { mesh.visible = false; return; }
    dir.divideScalar(L);
    fwd.set(A.m[0], -A.m[3], A.m[6]).normalize();                 // the parent body's forward (+x), in GL space
    bz.crossVectors(fwd, dir).normalize(); bx.crossVectors(dir, bz).normalize();
    mesh.matrix.makeBasis(bx.multiplyScalar(d), dir.clone().multiplyScalar(L + w * 0.35), bz.multiplyScalar(w));
    mesh.matrix.setPosition((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
    mesh.matrixWorldNeedsUpdate = true; mesh.visible = true;
  };
  // the shoulder links: from the torso's corner ball out to each arm's first joint
  const links = ['l', 'r'].map(sd => {
    const m = new THREE.Mesh(G(new THREE.CylinderGeometry(1, 1, 1, 32)), blue);    // the blue upper-arm shell starts right under the shoulder block (the reference)
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
        placeSlab(B.shell, A, va, vb, 2 * B.r0 * k, 1.7 * B.r0 * k);
        B.capA.visible = B.capB.visible = false;
        B.ball.visible = B.jr > 0; B.ball.position.copy(vb); B.ball.scale.setScalar(Math.max(1e-3, B.jr * k * 1.08));
      }
      const U = at('utorso');
      for (const L of links) {
        const S = at(L.sd + '_scap');
        const vis = !!U && !!S && scaleOf(S) / k0 > 0.03;
        L.m.visible = vis;
        if (!vis) continue;
        // the torso's corner, in stage space, then flipped
        const c = [-10, L.sy * 205, 520];
        va.set(U.m[0] * c[0] + U.m[1] * c[1] + U.m[2] * c[2] + U.t[0], -(U.m[3] * c[0] + U.m[4] * c[1] + U.m[5] * c[2] + U.t[1]), U.m[6] * c[0] + U.m[7] * c[1] + U.m[8] * c[2] + U.t[2]);
        posOf(S, vb);
        place(L.m, va, vb, 50 * scaleOf(S), 50 * scaleOf(S));
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
