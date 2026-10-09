import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import useScrollReveal from '../hooks/useScrollReveal';

// Shared interactive card. useScrollReveal runs the scroll-into-view entrance
// (the Web Animations API; it hands the element's transform back when it is
// done); on hover the card TILTS in 3D toward the pointer and a caption
// follows the cursor.
//
// The tilt is React Bits' TiltedCard (reactbits.dev/components/tilted-card),
// adapted from an image to a whole card at the owner's request (Oct 5: "use
// this for the cards"): the same springs, rotation from the pointer's offset
// from the centre, scale on hover, and the cursor-following figcaption whose
// rotation follows the pointer's vertical velocity. Applied to this element
// rather than an inner <img> because the modal grows out of the card's own
// box; the tilt is reset synchronously on click so the box it measures is the
// card at rest. Off under reduced motion and on touch screens (no hover).
//
//   React Bits — Copyright (c) 2026 David Haz. MIT + Commons Clause License
//   Condition v1.0: may be used as part of a website; the components
//   themselves may not be sold, sublicensed or redistributed.
//
// It is a DIV with button semantics rather than a real <button>: the cards
// contain headings and paragraphs, which are invalid inside a button. So it
// takes the keyboard contract on by hand — focusable, Enter and Space both
// activate, Space does not scroll the page.
const SPRING = { damping: 30, stiffness: 100, mass: 2 };          // TiltedCard's springValues
const CAPTION_SPRING = { stiffness: 350, damping: 30, mass: 1 };

const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

export default function LiftCard({ className = '', delay = 0, onClick, children, tilt = null, ...rest }) {
  const ref = useScrollReveal({ y: 40, scale: 0.97, delay, duration: 650, amount: 0.15 });
  const reduce = useReducedMotion();
  const on = !!tilt && !reduce;
  const amp = tilt?.amp ?? 8, scaleOnHover = tilt?.scale ?? 1.03;

  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const scale = useSpring(1, SPRING);
  const capX = useMotionValue(0), capY = useMotionValue(0);
  const capOpacity = useSpring(0);
  const capRotate = useSpring(0, CAPTION_SPRING);
  const lastY = useRef(0);

  const onMove = e => {
    if (!on || !canHover()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ox = e.clientX - r.left - r.width / 2, oy = e.clientY - r.top - r.height / 2;
    rotateX.set((oy / (r.height / 2)) * -amp);
    rotateY.set((ox / (r.width / 2)) * amp);
    // the caption sits in the card's own (untransformed) layout box
    capX.set(e.clientX - r.left); capY.set(e.clientY - r.top);
    capRotate.set(-(oy - lastY.current) * 0.6);
    lastY.current = oy;
  };
  const onEnter = () => { if (on && canHover()) { scale.set(scaleOnHover); capOpacity.set(1); } };
  const rest0 = () => { capOpacity.set(0); scale.set(1); rotateX.set(0); rotateY.set(0); capRotate.set(0); };
  const activate = e => {
    // put the card back at rest NOW, so the modal measures (and grows out of)
    // the card as it sits on the page, not tilted and scaled — WITHOUT the
    // card's 0.3s transform transition, which turned the reset into an
    // animation and left the measured box the hovered one (Oct 8). The pose
    // it was drawn in goes with it: the modal starts from exactly that and
    // levels out as it lifts (App.jsx, Modal.jsx).
    const el = e.currentTarget;
    el.__tiltPose = on ? { rx: rotateX.get(), ry: rotateY.get(), s: scale.get() } : null;
    if (on) {
      el.style.transition = 'none';
      rotateX.jump(0); rotateY.jump(0); scale.jump(1); capOpacity.jump(0);
      el.style.transform = 'none';
    }
    onClick?.(e);
  };
  const onKeyDown = e => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();          // Space would otherwise scroll
    activate(e);
  };

  return (
    <motion.div
      ref={ref}
      className={`lift-card${on ? ' tilt-card' : ''} ${className}`}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      onClick={activate}
      onKeyDown={onKeyDown}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={rest0}
      style={on ? { rotateX, rotateY, scale, transformPerspective: 900 } : undefined}
      {...rest}
    >
      {children}
      {on && tilt.caption && (
        <motion.span className="tilt-caption" aria-hidden="true" style={{ x: capX, y: capY, opacity: capOpacity, rotate: capRotate }}>
          {tilt.caption}
        </motion.span>
      )}
    </motion.div>
  );
}
