import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';
import { SITE_QR, QR_PATH } from '../siteQR';

// The ID badges, drawn with motion (Framer Motion) instead of three.js +
// rapier (the owner: "can you use Framer for the lanyards instead?"). That
// removed a ~3 MB lazy chunk and four WebGL canvases — the lanyards were half
// of every long frame on the Experience and Research pages — and the badge
// face is real text now, so it can never wash out under a light.
//
// Each badge is a PENDULUM: the strap and the card hang from a pin as one
// group rotated about the pin. Drag the card and the group swings to follow
// the pointer's angle from the pin (the strap stretching a little); let go and
// it swings home on a low-damped spring that CARRIES THE THROW (the release
// hands the drag's angular velocity to the spring — it used to restart from
// rest, so a flick died at the release). A pointer brushing past pushes it
// into a sway; hovering tilts the card toward the pointer in 3D and slides
// the laminate's sheen with it; a click (not a drag) flips it to the back.
// The front says who and when — the logo, the name, one year; the back the
// role, the exact dates and a QR code to the site (the owner, Oct 9).
// Nothing runs on a still page: every motion is a spring that settles.
const SWING = { type: 'spring', stiffness: 42, damping: 4.2, mass: 1 };   // degrees about the pin

function Badge({ card, pinTop, strap, siteDark }) {
  const reduce = useReducedMotion();
  const swing = useMotionValue(reduce ? 0 : 24);
  const stretch = useSpring(0, { stiffness: 260, damping: 16 });
  const tiltX = useSpring(0, { stiffness: 200, damping: 16 });
  const tiltY = useSpring(0, { stiffness: 200, damping: 16 });
  const sheen = useTransform(tiltY, v => `${50 - v * 3}% 0`);   // the laminate's highlight slides as the card turns
  const [flipped, setFlipped] = useState(false);
  const pinRef = useRef(null);
  const dragged = useRef(false);
  const strapH = useTransform(stretch, s => strap + s);
  const b = card.badge, back = card.back || {};
  const swingTo = (to, velocity = 0) => animate(swing, to, { ...SWING, velocity });

  // the entrance: it drops in already swinging and settles
  useEffect(() => { if (!reduce) { const c = swingTo(0); return () => c.stop(); } return undefined; }, [reduce]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pinXY = () => { const r = pinRef.current.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const onPanStart = () => { dragged.current = true; swing.stop(); tiltX.set(0); tiltY.set(0); };
  const onPan = (e, info) => {
    const [px, py] = pinXY();
    const dx = info.point.x - window.scrollX - px, dy = info.point.y - window.scrollY - py;
    const ang = Math.atan2(dx, Math.max(8, dy)) * 180 / Math.PI;
    swing.set(Math.max(-70, Math.min(70, -ang)));   // a plain value: getVelocity() then measures the throw
    stretch.set(Math.max(0, Math.min(30, Math.hypot(dx, dy) - (strap + 130))));
  };
  const onPanEnd = () => {
    swingTo(0, Math.max(-480, Math.min(480, swing.getVelocity())));
    stretch.set(0);
    setTimeout(() => { dragged.current = false; }, 0);
  };
  // a pointer brushing past pushes it into a small sway
  // a pointer brushing past gives ONE gentle nudge (Oct 6; the owner: "the
  // lanyard physics are messed up when I put my mouse close to it"). It used
  // to add to the running velocity on EVERY pointermove — 60-120 a second —
  // so hovering near a badge compounded into a wild spin. Now: at most one
  // nudge per 250 ms, only from a quick sideways move, never while the pointer
  // is on the card itself (the hover tilt owns that), and the resulting swing
  // speed is capped.
  const lastBrush = useRef(0);
  const onBrush = e => {
    if (reduce || dragged.current) return;
    if (e.target.closest && e.target.closest('.mlan-card-wrap')) return;
    const now = performance.now();
    if (now - lastBrush.current < 250) return;
    const push = Math.max(-6, Math.min(6, -e.movementX * 0.4));
    if (Math.abs(push) < 1.5) return;
    lastBrush.current = now;
    const v = Math.max(-70, Math.min(70, swing.getVelocity() + push * 6));
    swingTo(0, v);
  };
  const onHover = e => {
    if (reduce || dragged.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    tiltY.set(((e.clientX - r.left) / r.width - 0.5) * 22);
    tiltX.set((0.5 - (e.clientY - r.top) / r.height) * 16);
  };
  const onLeave = () => { tiltX.set(0); tiltY.set(0); };
  const pale = siteDark ? ' is-pale' : '';

  return (
    <div className={`mlan${pale}`} style={{ top: pinTop }} onPointerMove={onBrush}>
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
          aria-pressed={flipped}
          aria-label={`${b.name} badge — ${flipped ? 'showing details; flip back' : 'flip for details'}`}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(f => !f); } }}
        >
          <motion.div className="mlan-card" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
            <motion.div className={`mlan-face mlan-front${pale}`} style={{ '--sheen': sheen }}>
              <span className="mlan-slot" aria-hidden="true" />
              <img src={card.image} alt="" className="mlan-photo" draggable="false" />
              <span className="mlan-rule" aria-hidden="true" />
              <strong className="mlan-name">{b.name}</strong>
              {b.year && <span className="mlan-year">{b.year}</span>}
            </motion.div>
            <motion.div className={`mlan-face mlan-back${pale}`} style={{ '--sheen': sheen }}>
              <span className="mlan-slot" aria-hidden="true" />
              <span className="mlan-back-text">
                {/* the lab after a role's " · " on its own line: wrapped, it led a line with the dot */}
                <strong className="mlan-back-role">{(back.role || b.name).split(' · ')[0]}</strong>
                {back.role?.includes(' · ') && <span className="mlan-back-lab">{back.role.split(' · ')[1]}</span>}
                {back.dates && <span className="mlan-back-dates">{back.dates}</span>}
              </span>
              {/* aadhav.dev; two modules of white margin, the border a scanner needs */}
              <svg className="mlan-qr" viewBox={`-2 -2 ${SITE_QR.length + 4} ${SITE_QR.length + 4}`} shapeRendering="crispEdges" aria-hidden="true">
                <path d={QR_PATH} />
              </svg>
              <span className="mlan-qr-url">aadhav.dev</span>
            </motion.div>
          </motion.div>
        </motion.div>
        <motion.span className="mlan-hint" style={{ y: stretch }} aria-hidden="true">drag · click to flip</motion.span>
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
