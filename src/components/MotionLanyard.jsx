import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useReducedMotion } from 'motion/react';

// The ID badges, drawn with motion (Framer Motion) instead of three.js +
// rapier (the owner: "can you use Framer for the lanyards instead?"). That
// removed a ~3 MB lazy chunk and four WebGL canvases — the lanyards were half
// of every long frame on the Experience and Research pages — and the badge
// face is real text now, so it can never wash out under a light.
//
// Each badge is a PENDULUM: the strap and the card hang from a pin as one
// group rotated about the pin by a spring. Drag the card and the group swings
// to follow the pointer's angle from the pin (the strap stretching a little);
// let go and the spring swings it back, overshooting like a weight on a
// string. A pointer brushing past pushes it into a sway; hovering tilts the
// card toward the pointer in 3D; a click (not a drag) flips it over to the
// photo on its back. Nothing runs on a still page: every motion is a spring
// that settles.
function Badge({ card, pinTop, strap, siteDark }) {
  const reduce = useReducedMotion();
  const swing = useSpring(reduce ? 0 : 24, { stiffness: 42, damping: 4.2, mass: 1 });   // degrees about the pin
  const stretch = useSpring(0, { stiffness: 260, damping: 16 });
  const tiltX = useSpring(0, { stiffness: 200, damping: 16 });
  const tiltY = useSpring(0, { stiffness: 200, damping: 16 });
  const [flipped, setFlipped] = useState(false);
  const pinRef = useRef(null);
  const dragged = useRef(false);
  const strapH = useTransform(stretch, s => strap + s);
  const b = card.badge;

  // the entrance: it drops in already swinging and settles
  useEffect(() => { if (!reduce) swing.set(0); }, [reduce, swing]);

  const pinXY = () => { const r = pinRef.current.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const onPanStart = () => { dragged.current = true; tiltX.set(0); tiltY.set(0); };
  const onPan = (e, info) => {
    const [px, py] = pinXY();
    const dx = info.point.x - window.scrollX - px, dy = info.point.y - window.scrollY - py;
    const ang = Math.atan2(dx, Math.max(8, dy)) * 180 / Math.PI;
    swing.jump(Math.max(-70, Math.min(70, -ang)));
    stretch.set(Math.max(0, Math.min(30, Math.hypot(dx, dy) - (strap + 130))));
  };
  const onPanEnd = (e, info) => {
    // let go: the spring swings it home, carrying the throw
    swing.set(0);                              // released off-centre, the low-damped spring swings through and back
    stretch.set(0);
    setTimeout(() => { dragged.current = false; }, 0);
  };
  // a pointer brushing past pushes it into a small sway
  const onBrush = e => {
    if (reduce || dragged.current) return;
    const push = Math.max(-9, Math.min(9, -e.movementX * 0.5));
    if (Math.abs(push) > 0.5) { swing.set(push); setTimeout(() => swing.set(0), 140); }
  };
  const onHover = e => {
    if (reduce || dragged.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    tiltY.set(((e.clientX - r.left) / r.width - 0.5) * 22);
    tiltX.set((0.5 - (e.clientY - r.top) / r.height) * 16);
  };
  const onLeave = () => { tiltX.set(0); tiltY.set(0); };

  return (
    <div className="mlan" style={{ top: pinTop }} onPointerMove={onBrush}>
      <span className="mlan-pin" ref={pinRef} aria-hidden="true" />
      <motion.div className="mlan-hang" style={{ rotate: swing }}>
        <motion.span className="mlan-strap" style={{ height: strapH }} aria-hidden="true" />
        <motion.span className="mlan-clip" style={{ y: stretch }} aria-hidden="true" />
        <motion.div
          className="mlan-card-wrap"
          style={{ y: stretch, rotateX: tiltX, rotateY: tiltY }}
          onPanStart={onPanStart}
          onPan={onPan}
          onPanEnd={onPanEnd}
          onPointerMove={onHover}
          onPointerLeave={onLeave}
          onClick={() => { if (!dragged.current) setFlipped(f => !f); }}
          role="button"
          tabIndex={0}
          aria-label={`${b.name} badge — flip`}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(f => !f); } }}
        >
          <motion.div className="mlan-card" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
            <div className={`mlan-face mlan-front${siteDark ? ' is-pale' : ''}`}>
              <span className="mlan-slot" aria-hidden="true" />
              <img src={card.image} alt="" className="mlan-photo" draggable="false" />
              <strong className="mlan-name">{b.name}</strong>
              <span className="mlan-role">{b.role}</span>
              <span className="mlan-rule" aria-hidden="true" />
              <span className="mlan-meta"><b>ID</b>{b.id}</span>
              <span className="mlan-meta"><b>EXP</b>{b.exp}</span>
            </div>
            <div className="mlan-face mlan-back">
              <img src={card.image} alt="" draggable="false" />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// the site's theme, for the card's inverted look (dark card on the light
// site, pale card on the dark one)
function useSiteDark() {
  const get = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const [dark, setDark] = useState(get);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(get()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

// Two badges in the left column: the first beside the first card, the second
// hung `rowPx` lower, beside the second.
export default function MotionLanyard({ cards, rowPx }) {
  const siteDark = useSiteDark();
  return (
    <>
      {cards.map((c, i) => (
        <Badge key={c.badge.name} card={c} pinTop={150 - 52 + i * rowPx} strap={40} siteDark={siteDark} />   // the column starts 150px above the first card: each pin sits 52px above its card, on a short strap
      ))}
    </>
  );
}
