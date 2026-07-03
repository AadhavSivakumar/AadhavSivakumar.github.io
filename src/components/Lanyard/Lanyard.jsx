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

export default function Lanyard({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
  cards = [],
  clearCenterPx = 0,
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
function BandField({ cards, clearCenterPx = 0, ...bandProps }) {
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

  // Each card needs ~1.75 world units of strap-to-strap spacing; when the
  // viewport can't fit a side's full run, drop the outermost badges rather
  // than stacking them on top of each other.
  const MIN_STEP = 1.75;
  const worldPerPx = layout.world / layout.px;
  const slots = cards.length ? Math.max(...cards.map(c => c.slot || 0)) + 1 : 1;
  const inner = clearCenterPx * worldPerPx + 1.1;
  const outer = Math.max(layout.world / 2 - 1, inner);
  const span = outer - inner;
  const maxSlots = Math.min(slots, Math.floor(span / MIN_STEP) + 1);
  const step = maxSlots > 1 ? span / (maxSlots - 1) : 0;
  const stamp = `${layout.world.toFixed(1)}x${layout.px}`;

  return cards
    .filter(c => (c.slot || 0) < maxSlots)
    .map((c, i) => (
      <Band
        key={`${c.badge?.name || i}@${stamp}`}
        {...bandProps}
        anchorX={(inner + (c.slot || 0) * step) * (c.side === 'left' ? -1 : 1)}
        anchorY={4 - (maxSlots - 1 - (c.slot || 0)) * 0.4}
        image={c.image}
        badge={c.badge}
      />
    ));
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
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(rx, ry, rw, 80 * u);

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

  ctx.textAlign = 'center';
  ctx.fillStyle = '#111827';
  ctx.font = `600 ${15 * u}px Poppins, sans-serif`;
  ctx.fillText(badge.name, cx, ry + 155 * u, rw - 12 * u);
  ctx.fillStyle = '#6b7280';
  ctx.font = `500 ${11 * u}px Poppins, sans-serif`;
  ctx.fillText(badge.role, cx, ry + 172 * u, rw - 12 * u);

  const drawRow = (label, value, y) => {
    ctx.textAlign = 'right';
    ctx.font = `600 ${10 * u}px Poppins, sans-serif`;
    ctx.fillStyle = '#6b7280';
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
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 };
  const { nodes, materials } = useGLTF(cardGLB);
  
  const texture = useTexture(lanyardImage || lanyardTexture);
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
    if (photo) drawCover(photo, BACK_UV_RECT);

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
    [0, 1.5, 0]
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
    } else if (card.current) {
      // A moving cursor gently pushes nearby cards away, making the
      // lanyards sway as the mouse passes (like the live /portfolio badges).
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
      // click-flip — along the shortest path.
      ang.copy(card.current.angvel());
      const q = card.current.rotation();
      rotQ.set(q.x, q.y, q.z, q.w);
      rotE.setFromQuaternion(rotQ, 'YXZ');
      let yawErr = rotE.y - (flipped.current ? Math.PI : 0);
      yawErr = Math.atan2(Math.sin(yawErr), Math.cos(yawErr));
      card.current.setAngvel({ x: ang.x, y: ang.y - yawErr * 0.3, z: ang.z });
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
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
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
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.8}
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
          map={texture}
          repeat={[-4, 1]}
          lineWidth={lanyardWidth}
        />
      </mesh>
    </>
  );
}
