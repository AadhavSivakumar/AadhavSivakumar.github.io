// From React Bits (reactbits.dev) — Copyright (c) 2026 David Haz.
// MIT + Commons Clause License Condition v1.0 (see ./LICENSE.md): used here as
// part of this website; not to be sold, sublicensed or redistributed.
//
// Adapted. The look and feel are upstream's: 12px corners 3px thick and a
// 4px dot in white under `mix-blend-mode: difference`, a 2 s spin, the
// corners closing on the target over `hoverDuration` and then trailing it
// (parallax) as the pointer moves inside it, the press squeeze. What changed:
// - Upstream spun the cursor with an endless GSAP timeline: a style write on
//   every frame, forever, which breaks this site's rule that a still page
//   makes no DOM mutations. The spin is a CSS animation of `rotate` here (no
//   writes; the compositor's job), and everything else runs in ONE rAF loop
//   that stops the moment nothing is moving. No GSAP dependency.
// - Upstream made four new tweens every frame while on a target; the loop
//   eases the corners itself, with the time constants those tweens had.
// - The target's box is read every frame it is held (upstream: once, on
//   entry), so the corners stay on a card that tilts or scrolls under them.
// - Hidden until the pointer first moves (upstream parked it spinning in the
//   middle of the screen), and while the pointer is outside the page or over
//   an iframe, where no moves reach the page. Off for touch screens (no
//   hover, coarse pointer) and for reduced motion.
// - In Firefox the reticle is the page's ink, unblended (TargetCursor.css):
//   it will not blend against this page's fixed-attachment background.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onScroll } from '../../scrollDriver';
import './TargetCursor.css';

const BORDER = 3, CORNER = 12;
// each corner's top-left round the pointer at rest (upstream: ±1.5 / 0.5 x 12)
const REST = [[-18, -18], [6, -18], [6, 6], [-18, 6]];
const power2Out = p => 1 - (1 - p) * (1 - p);
const power3Out = p => 1 - (1 - p) ** 3;

export default function TargetCursor({
  targetSelector = '.cursor-target',
  spinDuration = 2,
  hideDefaultCursor = true,
  hoverDuration = 0.2,
  parallaxOn = true,
}) {
  const wrapRef = useRef(null);
  const [enabled] = useState(() => typeof window !== 'undefined' && !!window.matchMedia
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!enabled || !wrap) return undefined;
    const corners = Array.from(wrap.querySelectorAll('.target-cursor-corner'));
    const originalCursor = document.body.style.cursor;
    if (hideDefaultCursor) document.body.style.cursor = 'none';
    wrap.style.setProperty('--tc-spin', `${spinDuration}s`);

    let mx = 0, my = 0;            // the pointer
    let cx = 0, cy = 0;            // the reticle, chasing it
    let shown = false;
    const rel = REST.map(([x, y]) => ({ x, y }));   // corners, relative to the reticle
    const drawn = REST.map(() => ({ x: NaN, y: NaN }));
    let dx = NaN, dy = NaN;
    let target = null, enteredAt = 0;
    let leave = null;              // the corners' way home: { t0, from }
    let resume = 0, raf = 0, last = 0;

    const write = () => {
      if (cx !== dx || cy !== dy) { wrap.style.translate = `${cx}px ${cy}px`; dx = cx; dy = cy; }
      for (let i = 0; i < 4; i++) {
        const c = rel[i], d = drawn[i];
        if (Math.abs(c.x - d.x) < 0.01 && Math.abs(c.y - d.y) < 0.01) continue;
        corners[i].style.transform = `translate(${c.x}px, ${c.y}px)`;
        d.x = c.x; d.y = c.y;
      }
    };

    const tick = now => {
      raf = 0;
      const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 1 / 60;
      last = now;
      let busy = false;

      // the reticle follows the pointer (upstream: a 0.1 s power3.out tween per move)
      const kp = 1 - Math.exp(-dt / 0.028);
      cx += (mx - cx) * kp; cy += (my - cy) * kp;
      if (Math.abs(mx - cx) < 0.05 && Math.abs(my - cy) < 0.05) { cx = mx; cy = my; } else busy = true;

      if (target && !target.isConnected) release(now);
      if (target) {
        const r = target.getBoundingClientRect();
        const goal = [
          [r.left - BORDER, r.top - BORDER],
          [r.right + BORDER - CORNER, r.top - BORDER],
          [r.right + BORDER - CORNER, r.bottom + BORDER - CORNER],
          [r.left - BORDER, r.bottom + BORDER - CORNER],
        ];
        // the hold strengthens over hoverDuration (power2.out); while it does,
        // each frame closes that fraction of the gap (upstream's 0.05 s tween
        // per tick); at full strength the corners trail by a 0.2 s ease
        const p = Math.min(1, (now - enteredAt) / 1000 / hoverDuration);
        const s = power2Out(p);
        const k = s >= 0.99
          ? (parallaxOn ? 1 - Math.exp(-dt / 0.096) : 1)
          : s * (1 - Math.exp(-dt / 0.0205));
        for (let i = 0; i < 4; i++) {
          const gx = goal[i][0] - cx, gy = goal[i][1] - cy, c = rel[i];
          c.x += (gx - c.x) * k; c.y += (gy - c.y) * k;
          if (Math.abs(gx - c.x) > 0.05 || Math.abs(gy - c.y) > 0.05) busy = true;
        }
        if (p < 1) busy = true;
      } else if (leave) {
        const p = Math.min(1, (now - leave.t0) / 300);
        const e = power3Out(p);
        for (let i = 0; i < 4; i++) {
          rel[i].x = leave.from[i].x + (REST[i][0] - leave.from[i].x) * e;
          rel[i].y = leave.from[i].y + (REST[i][1] - leave.from[i].y) * e;
        }
        if (p < 1) busy = true; else leave = null;
      }

      write();
      if (busy) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const spin = on => wrap.classList.toggle('is-spinning', on);
    function onLeave() { release(performance.now()); }
    function release(now) {
      if (!target) return;
      target.removeEventListener('mouseleave', onLeave);
      target = null;
      leave = { t0: now, from: rel.map(c => ({ x: c.x, y: c.y })) };
      clearTimeout(resume);
      resume = setTimeout(() => { if (!target) spin(true); }, 50);
      kick();
    }

    const onMove = e => {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; cx = mx; cy = my; wrap.classList.add('is-on'); }
      kick();
    };
    const hide = () => {
      if (!shown) return;
      shown = false;
      wrap.classList.remove('is-on', 'is-down');
      if (target) target.removeEventListener('mouseleave', onLeave);
      target = null; leave = null;
      clearTimeout(resume);
      REST.forEach(([x, y], i) => { rel[i].x = x; rel[i].y = y; });
      write();
      spin(true);
    };
    // no relatedTarget: the pointer left the window, or went into an iframe
    const onOut = e => { if (!e.relatedTarget) hide(); };
    const onOver = e => {
      const el = e.target instanceof Element ? e.target.closest(targetSelector) : null;
      if (!el || el === target) return;
      if (target) target.removeEventListener('mouseleave', onLeave);
      clearTimeout(resume);
      target = el; enteredAt = performance.now(); leave = null;
      spin(false);                 // squares up at once, as upstream
      target.addEventListener('mouseleave', onLeave);
      kick();
    };
    const onDown = () => wrap.classList.add('is-down');
    const onUp = () => wrap.classList.remove('is-down');
    // scrolled out from under the pointer: let go (no mouse event says so)
    const stopScroll = onScroll(() => {
      if (!target) return;
      const under = document.elementFromPoint(mx, my);
      if (!under || under.closest(targetSelector) !== target) release(performance.now());
      else kick();
    });

    write();
    spin(true);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    window.addEventListener('blur', hide);
    return () => {
      stopScroll();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', hide);
      if (target) target.removeEventListener('mouseleave', onLeave);
      clearTimeout(resume);
      if (raf) cancelAnimationFrame(raf);
      document.body.style.cursor = originalCursor;
    };
  }, [enabled, targetSelector, spinDuration, hideDefaultCursor, hoverDuration, parallaxOn]);

  if (!enabled) return null;
  return createPortal(
    <div ref={wrapRef} className="target-cursor-wrapper" aria-hidden="true">
      <div className="target-cursor-dot" />
      <div className="target-cursor-corner corner-tl" />
      <div className="target-cursor-corner corner-tr" />
      <div className="target-cursor-corner corner-br" />
      <div className="target-cursor-corner corner-bl" />
    </div>,
    document.body
  );
}
