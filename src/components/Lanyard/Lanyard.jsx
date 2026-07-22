/* eslint-disable react/no-unknown-property */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei';
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';

import cardGLB from './card.glb';
import lanyardTexture from './lanyard.png';

extend({ MeshLineGeometry, MeshLineMaterial });

// 1x1 transparent pixel — lets useTexture be called unconditionally when a
// front/back image isn't supplied.
const BLANK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// The card model's front face is UV-mapped to the LEFT half of the texture
// atlas and the back face to the RIGHT half (measured from card.glb). Each
// custom image is composited into its own half so the two faces render
// independently, aspect-preserving (no stretching).
// Physical size of the card's printed face, in world units (matches the card
// collider: 0.8 x 1.125 half-extents). Used to undo the aspect difference
// between the UV rect and the badge artwork so nothing renders stretched.
const CARD_FACE_W = 1.6;
const CARD_FACE_H = 2.25;

const FRONT_UV_RECT = { x: 0, y: 0, w: 0.5, h: 0.755 };
const BACK_UV_RECT = { x: 0.5, y: 0, w: 0.5, h: 0.757 };

// Stable rope-joint offsets relative to the band's anchor group. Kept as
// module constants so re-renders never hand rapier a "new" position (which
// would teleport the bodies and tear the strap from its fixed end). The
// chain starts hanging vertically at equilibrium — a horizontal start makes
// neighboring cards collide while dropping and fall asleep mid-swing,
// freezing the straps at a diagonal.
const J1_POS = [0, -0.5, 0];
const J2_POS = [0, -1, 0];
const J3_POS = [0, -1.5, 0];
const CARD_POS = [0, -3, 0];

// Cursor-proximity sway: a moving pointer within SWAY_RADIUS (world units)
// of a card nudges it away, strongest up close.
const SWAY_RADIUS = 3;
const SWAY_STRENGTH = 0.12;

// Click-to-flip: torque impulse that starts the card spinning toward the
// yaw target on the other side.
const FLIP_KICK = 0.08;

// Hover tilt: max lean (radians) toward the cursor while it rests on a card,
// mirroring the 3D tilt the HTML cards used to have.
const TILT_MAX = 0.35;

// Recency gradient: `slot` 0 is the present badge (NYU / Roboflow) and renders
// largest; each step into the past is a touch smaller. The gradient is gentle
// so the run reads as a premium row of similar badges. Indexed by slot; slots
// beyond the list fall back to the last (smallest) entry.
const SLOT_SCALE = [1, 0.9, 0.82];
// All badges hang from the same overhead rail (flat top). Size differences
// alone give a subtle arc — larger cards hang a little lower via the card
// joint — so no per-slot rise is needed.
const SLOT_BASE_Y = 3.2;
const SLOT_RISE = 0;

// Overhead rail the lanyards hang from: a horizontal metal rod with one ring
// per badge, so the straps read as looped over a display rack. Radii are in
// world units at sizeMul 1 and scale with the badge size.
const RING_RADIUS = 0.26;
const ROD_RADIUS = 0.1;

function slotScale(slot) {
  return SLOT_SCALE[slot] ?? SLOT_SCALE[SLOT_SCALE.length - 1];
}

export default function Lanyard({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
  cards = [],
  clearCenterPx = 0,
  spreadStep = null,
  sizeMul = 1,
  lanyardImage = null,
  lanyardWidth = 1
}) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="lanyard-wrapper">
      <Canvas
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <BandField
            cards={cards}
            clearCenterPx={clearCenterPx}
            spreadStep={spreadStep}
            sizeMul={sizeMul}
            isMobile={isMobile}
            lanyardImage={lanyardImage}
            lanyardWidth={lanyardWidth}
          />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

// Lays the bands out around the (HTML) about card sitting at the canvas
// center: `slot` 0 is the innermost badge on each `side`, higher slots step
// outward toward the viewport edge. Inner badges hang slightly lower,
// mirroring the staggered badges on the live /portfolio page.
function BandField({ cards, clearCenterPx = 0, spreadStep = null, sizeMul = 1, ...bandProps }) {
  const { viewport, size } = useThree();
  const [layout, setLayout] = useState(null);

  // The physics bodies don't follow their anchors when the canvas aspect
  // ratio changes, which tears the straps from their fixed ends. Wait for
  // the resize to settle, then remount the bands (via key) at positions
  // computed for the new viewport.
  useEffect(() => {
    const t = setTimeout(
      () => setLayout({ world: viewport.width, px: size.width }),
      layout ? 300 : 0
    );
    return () => clearTimeout(t);
  }, [viewport.width, size.width]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!layout) return null;

  const worldPerPx = layout.world / layout.px;
  const slots = cards.length ? Math.max(...cards.map(c => c.slot || 0)) + 1 : 1;
  // Card half-width in world units for a slot (0.8 is the card's half width at
  // scale 1 — matches the collider), so spacing is derived from real size.
  const half = s => 0.8 * slotScale(s) * sizeMul;
  // Center half-gap between the two innermost badges, plus the spacing between
  // adjacent slots. `spreadStep` overrides the auto (size-based) spacing.
  const inner = clearCenterPx * worldPerPx + half(0) + 0.4;
  const step = spreadStep || half(0) + half(1) + 0.6;
  // Drop the outermost badges that would run off-screen rather than stacking.
  const edgeLimit = layout.world / 2 - 0.4;
  let maxSlots = slots;
  while (maxSlots > 1 && inner + (maxSlots - 1) * step + half(maxSlots - 1) > edgeLimit) maxSlots--;
  const stamp = `${layout.world.toFixed(1)}x${layout.px}@${sizeMul}`;

  const shown = cards.filter(c => (c.slot || 0) < maxSlots);
  const anchorXOf = c => (inner + (c.slot || 0) * step) * (c.side === 'left' ? -1 : 1);
  const anchorXs = shown.map(anchorXOf);

  return (
    <>
      <LanyardRack anchorXs={anchorXs} sizeMul={sizeMul} />
      {shown.map((c, i) => (
        <Band
          key={`${c.badge?.name || i}@${stamp}`}
          {...bandProps}
          anchorX={anchorXOf(c)}
          anchorY={SLOT_BASE_Y + (c.slot || 0) * SLOT_RISE}
          scale={slotScale(c.slot || 0) * sizeMul}
          image={c.image}
          badge={c.badge}
        />
      ))}
    </>
  );
}

// The overhead display rail the lanyards hang from: a horizontal metal rod with
// rounded end caps, and one ring per badge positioned so each strap loops over
// its ring (rod at the ring tops, strap starting at the ring bottom).
function LanyardRack({ anchorXs = [], sizeMul = 1 }) {
  const ringR = RING_RADIUS * sizeMul;
  const rodR = ROD_RADIUS * sizeMul;
  const rodY = SLOT_BASE_Y + 2 * ringR;
  const rodHalf = (anchorXs.length ? Math.max(...anchorXs.map(Math.abs)) : 1) + 0.9;
  const metal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9ccd4', metalness: 1, roughness: 0.3 }),
    []
  );
  return (
    <group>
      <mesh position={[0, rodY, -0.15]} rotation={[0, 0, Math.PI / 2]} material={metal}>
        <cylinderGeometry args={[rodR, rodR, rodHalf * 2, 20]} />
      </mesh>
      <mesh position={[-rodHalf, rodY, -0.15]} material={metal}>
        <sphereGeometry args={[rodR * 1.7, 20, 20]} />
      </mesh>
      <mesh position={[rodHalf, rodY, -0.15]} material={metal}>
        <sphereGeometry args={[rodR * 1.7, 20, 20]} />
      </mesh>
      {anchorXs.map((x, i) => (
        <mesh key={i} position={[x, SLOT_BASE_Y + ringR, -0.05]} material={metal}>
          <torusGeometry args={[ringR, rodR * 0.7, 14, 28]} />
        </mesh>
      ))}
    </group>
  );
}

// Tracks the site theme so the strap can invert against the page: a dark strap
// on the light theme, a light strap on the dark theme.
function useSiteTheme() {
  const [theme, setTheme] = useState(
    () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'light'
  );
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setTheme(el.getAttribute('data-theme') || 'light');
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    read();
    return () => obs.disconnect();
  }, []);
  return theme;
}

// The strap artwork is a near-black webbing, which is right on the light theme
// but disappears on the dark one. Tinting can't fix that (the material colour
// only multiplies the map), so on the dark theme we render an inverted copy of
// the texture: a light strap with dark hardware.
function useStrapTexture(texture, theme) {
  return useMemo(() => {
    if (theme !== 'dark' || !texture?.image) return texture;
    const img = texture.image;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return texture;
    ctx.filter = 'invert(1)';
    ctx.drawImage(img, 0, 0);
    const inverted = new THREE.CanvasTexture(canvas);
    inverted.colorSpace = texture.colorSpace;
    inverted.wrapS = inverted.wrapT = THREE.RepeatWrapping;
    inverted.flipY = texture.flipY;
    inverted.needsUpdate = true;
    return inverted;
  }, [texture, theme]);
}

// Draws an ID-badge face (photo, name, role, ID/EXP rows) into the card's
// front UV rect, matching the badge design on the live /portfolio page.
// Proportions are expressed against the live badge's 160x260 canvas card.
function drawBadgeFace(ctx, rect, badge, img, W, H) {
  const rx = rect.x * W;
  const ry = rect.y * H;
  const rw = rect.w * W;
  const rh = rect.h * H;
  const u = rh / 260;
  const cx = rx + rw / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rx, ry, rw, rh);
  // Full-bleed header band is drawn untransformed so it still reaches both
  // edges of the card.
  ctx.fillStyle = '#f5f1e9';
  ctx.fillRect(rx, ry, rw, 80 * (rh / 260));

  // The UV rect is squarer than the 160x260 badge design it carries, so a
  // naive draw stretches every glyph horizontally. Compress x about the card's
  // centre line by exactly that ratio so text and the photo stay true.
  const squash = (CARD_FACE_W / CARD_FACE_H) * (260 / 160);
  ctx.translate(cx, 0);
  ctx.scale(1 / squash, 1);
  ctx.translate(-cx, 0);

  if (img) {
    const r = 50 * u;
    const cy = ry + 75 * u;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max((2 * r) / img.width, (2 * r) / img.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  }

  // premium gold accent divider under the photo
  ctx.fillStyle = '#c5a35c';
  ctx.fillRect(rx + 22 * u, ry + 131 * u, rw - 44 * u, 1.6 * u);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#111827';
  ctx.font = `600 ${15 * u}px Poppins, sans-serif`;
  ctx.fillText(badge.name, cx, ry + 155 * u, rw - 12 * u);
  ctx.fillStyle = '#6b7280';
  ctx.font = `500 ${11 * u}px Poppins, sans-serif`;
  ctx.fillText(badge.role, cx, ry + 172 * u, rw - 12 * u);

  const drawRow = (label, value, y) => {
    ctx.textAlign = 'right';
    ctx.font = `700 ${10 * u}px Poppins, sans-serif`;
    ctx.fillStyle = '#b0872f';
    ctx.fillText(label, cx - 5 * u, y);
    ctx.textAlign = 'left';
    ctx.font = `600 ${11 * u}px Poppins, sans-serif`;
    ctx.fillStyle = '#111827';
    ctx.fillText(value, cx + 5 * u, y);
  };
  if (badge.id) drawRow('ID', badge.id, ry + 205 * u);
  if (badge.exp) drawRow('EXP', badge.exp, ry + 225 * u);

  ctx.restore();
}

function Band({
  maxSpeed = 50,
  minSpeed = 0,
  isMobile = false,
  anchorX = 0,
  anchorY = 4,
  scale = 1,
  image = null,
  badge = null,
  lanyardImage = null,
  lanyardWidth = 1
}) {
  const band = useRef(),
    fixed = useRef(),
    j1 = useRef(),
    j2 = useRef(),
    j3 = useRef(),
    card = useRef();
  const vec = new THREE.Vector3(),
    ang = new THREE.Vector3(),
    rotQ = new THREE.Quaternion(),
    rotE = new THREE.Euler(),
    dir = new THREE.Vector3();
  const flipped = useRef(false);
  const press = useRef(null);
  const lastPointer = useRef({ x: 0, y: 0 });
  const hoverTilt = useRef(null);
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 };
  const { nodes, materials } = useGLTF(cardGLB);
  
  const texture = useTexture(lanyardImage || lanyardTexture);
  const theme = useSiteTheme();
  const strapTex = useStrapTexture(texture, theme);
  const photoTex = useTexture(image || BLANK_PIXEL);

  // Composite this badge into the card's texture atlas: the front face gets
  // the ID-badge layout (photo + name/role/ID/EXP), the back face gets the
  // photo full-bleed, aspect-preserving (no stretch).
  const cardMap = useMemo(() => {
    const baseMap = materials.base.map;
    if (!image && !badge) return baseMap;

    const baseImg = baseMap.image;
    const W = baseImg.width;
    const H = baseImg.height;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return baseMap;
    // Keep the original baked atlas for the card edges and any untouched face.
    ctx.drawImage(baseImg, 0, 0, W, H);

    // Back face: fit the whole logo inside the card ("contain") on a clean
    // white field. A cover-fit crops wide wordmarks so they run off the edges.
    const drawContain = (img, rect) => {
      const rx = rect.x * W;
      const ry = rect.y * H;
      const rw = rect.w * W;
      const rh = rect.h * H;
      // Aspect of the rect as it actually appears on the physical card face.
      const faceScaleX = rw / (rh * (CARD_FACE_W / CARD_FACE_H)) ;
      const pad = 0.14;
      const availW = rw * (1 - 2 * pad) / faceScaleX;
      const availH = rh * (1 - 2 * pad);
      const s = Math.min(availW / img.width, availH / img.height);
      const dw = img.width * s * faceScaleX;
      const dh = img.height * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.drawImage(img, rx + (rw - dw) / 2, ry + (rh - dh) / 2, dw, dh);
      ctx.restore();
    };

    const drawCover = (img, rect) => {
      const rx = rect.x * W;
      const ry = rect.y * H;
      const rw = rect.w * W;
      const rh = rect.h * H;
      const scale = Math.max(rw / img.width, rh / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = rx + (rw - dw) / 2;
      const dy = ry + (rh - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    };

    const photo = image ? photoTex.image : null;
    if (badge) drawBadgeFace(ctx, FRONT_UV_RECT, badge, photo, W, H);
    else if (photo) drawCover(photo, FRONT_UV_RECT);
    if (photo) drawContain(photo, BACK_UV_RECT);

    const composite = new THREE.CanvasTexture(canvas);
    composite.colorSpace = THREE.SRGBColorSpace;
    composite.flipY = baseMap.flipY;
    composite.anisotropy = 16;
    composite.needsUpdate = true;
    return composite;
  }, [image, badge, photoTex, materials.base.map]);

  const [curve] = useState(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
  );
  const [dragged, drag] = useState(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.5 * scale, 0]
  ]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => void (document.body.style.cursor = 'auto');
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z });
    } else if (card.current && !hovered) {
      // A moving cursor gently pushes nearby cards away, making the
      // lanyards sway as the mouse passes (like the live /portfolio badges).
      // Skipped while hovering the card itself — the hover tilt takes over.
      const moved = state.pointer.x !== lastPointer.current.x || state.pointer.y !== lastPointer.current.y;
      if (moved) {
        lastPointer.current.x = state.pointer.x;
        lastPointer.current.y = state.pointer.y;
        vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
        dir.copy(vec).sub(state.camera.position).normalize();
        vec.add(dir.multiplyScalar(state.camera.position.length()));
        const pos = card.current.translation();
        const dx = pos.x - vec.x;
        const dy = pos.y - vec.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SWAY_RADIUS && dist > 0.05) {
          const f = (1 - dist / SWAY_RADIUS) * SWAY_STRENGTH * Math.min(delta, 1 / 30);
          card.current.applyImpulse({ x: (dx / dist) * f, y: (dy / dist) * f, z: 0 }, true);
        }
      }
    }
    if (fixed.current) {
      [j1, j2].forEach(ref => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        // Clamp the lerp alpha to 1 — above 1 Vector3.lerp extrapolates past
        // the target, which makes the strap diverge into huge streaks
        // whenever the frame rate drops below maxSpeed fps.
        ref.current.lerped.lerp(
          ref.current.translation(),
          Math.min(1, delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)))
        );
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));

      // Steer the card's yaw toward its front — or its back after a
      // click-flip — along the shortest path. While the cursor rests on the
      // card, lean the yaw/pitch targets toward it for a 3D hover tilt.
      ang.copy(card.current.angvel());
      const q = card.current.rotation();
      rotQ.set(q.x, q.y, q.z, q.w);
      rotE.setFromQuaternion(rotQ, 'YXZ');
      const tilt = (!dragged && hovered && hoverTilt.current) || null;
      let yawErr = rotE.y - ((flipped.current ? Math.PI : 0) + (tilt ? tilt.nx * TILT_MAX : 0));
      yawErr = Math.atan2(Math.sin(yawErr), Math.cos(yawErr));
      const pitchErr = rotE.x - (tilt ? -tilt.ny * TILT_MAX : 0);
      card.current.setAngvel({ x: ang.x - pitchErr * 0.35, y: ang.y - yawErr * 0.35, z: ang.z });
    }
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[anchorX, anchorY, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={J1_POS} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={J2_POS} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={J3_POS} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={CARD_POS} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[0.8 * scale, 1.125 * scale, 0.01]} />
          <group
            scale={2.25 * scale}
            position={[0, -1.2 * scale, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => { hover(false); hoverTilt.current = null; }}
            onPointerMove={e => {
              if (!card.current) return;
              const pos = card.current.translation();
              hoverTilt.current = {
                nx: THREE.MathUtils.clamp((e.point.x - pos.x) / (0.9 * scale), -1, 1),
                ny: THREE.MathUtils.clamp((e.point.y - pos.y) / (1.2 * scale), -1, 1),
              };
              card.current.wakeUp();
            }}
            onPointerUp={e => {
              e.target.releasePointerCapture(e.pointerId);
              drag(false);
              // A press without meaningful movement is a click: flip the
              // card around instead of requiring a drag-and-snap.
              const p = press.current;
              press.current = null;
              if (p && performance.now() - p.t < 350 && Math.hypot(e.point.x - p.x, e.point.y - p.y) < 0.2) {
                flipped.current = !flipped.current;
                card.current?.applyTorqueImpulse({ x: 0, y: (flipped.current ? 1 : -1) * FLIP_KICK, z: 0 }, true);
              }
            }}
            onPointerDown={e => {
              e.target.setPointerCapture(e.pointerId);
              press.current = { t: performance.now(), x: e.point.x, y: e.point.y };
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={cardMap}
                map-anisotropy={16}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.1}
                roughness={0.55}
                metalness={0.35}
              />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={strapTex}
          repeat={[-4, 1]}
          lineWidth={lanyardWidth}
        />
      </mesh>
    </>
  );
}
