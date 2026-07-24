import React, { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
} from 'motion/react';

// A single liquid-glass keyword pill. The pill itself is glass (translucent fill
// + backdrop-filter blur/saturate + an SVG displacement filter that warps the
// moving sine-wave field behind it). This component adds the per-chip pointer
// response: a spring-smoothed 3D tilt toward the cursor and a specular highlight
// that tracks the cursor, so each pill "turns to catch the light".
export default function HeroChip({ label, index, onClick }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const px = useMotionValue(50);
  const py = useMotionValue(50);
  const sheen = useSpring(0, { stiffness: 180, damping: 22 });
  const rotX = useSpring(0, { stiffness: 220, damping: 18 });
  const rotY = useSpring(0, { stiffness: 220, damping: 18 });

  const glow = useMotionTemplate`radial-gradient(circle 120px at ${px}% ${py}%, rgba(255,255,255,0.85), rgba(255,255,255,0) 60%)`;

  function handleMove(e) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const rx = (e.clientX - r.left) / r.width;
    const ry = (e.clientY - r.top) / r.height;
    px.set(rx * 100);
    py.set(ry * 100);
    rotY.set((rx - 0.5) * 16);
    rotX.set((0.5 - ry) * 12);
  }
  function handleEnter() { if (!reduce) sheen.set(1); }
  function handleLeave() { sheen.set(0); rotX.set(0); rotY.set(0); }

  return (
    <motion.button
      ref={ref}
      type="button"
      className="hero-chip"
      onClick={onClick}
      onPointerMove={handleMove}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 + index * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -3, scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 620 }}
    >
      <motion.span
        className="hero-chip__sheen"
        aria-hidden="true"
        style={{ backgroundImage: glow, opacity: sheen }}
      />
      <span className="hero-chip__label">{label}</span>
    </motion.button>
  );
}
