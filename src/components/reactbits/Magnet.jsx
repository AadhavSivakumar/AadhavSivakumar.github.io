// From React Bits (reactbits.dev) — Copyright (c) 2026 David Haz.
// MIT + Commons Clause License Condition v1.0 (see ./LICENSE.md): used here as
// part of this website; not to be sold, sublicensed or redistributed.
//
// Adapted: the transform is written straight to the element instead of
// through React state (upstream re-rendered on EVERY mouse move anywhere on
// the page, near the magnet or not), nothing is written while the pointer is
// out of range and the element already at rest, and it is off for touch and
// reduced motion. Same feel: within `padding` of the element it drifts toward
// the pointer by 1/magnetStrength of the offset, and eases back on leave.
import { useEffect, useRef } from 'react';

export default function Magnet({
  children, padding = 60, disabled = false, magnetStrength = 3,
  activeTransition = 'transform 0.3s ease-out', inactiveTransition = 'transform 0.5s ease-in-out',
  wrapperClassName = '', innerClassName = '', as: Tag = 'span', ...props
}) {
  const wrap = useRef(null), inner = useRef(null);
  useEffect(() => {
    if (disabled) return undefined;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let active = false;
    const onMove = e => {
      const el = wrap.current, i = inner.current;
      if (!el || !i) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const cx = left + width / 2, cy = top + height / 2;
      if (Math.abs(cx - e.clientX) < width / 2 + padding && Math.abs(cy - e.clientY) < height / 2 + padding) {
        if (!active) { active = true; i.style.transition = activeTransition; }
        i.style.transform = `translate3d(${(e.clientX - cx) / magnetStrength}px, ${(e.clientY - cy) / magnetStrength}px, 0)`;
      } else if (active) {
        active = false; i.style.transition = inactiveTransition; i.style.transform = 'translate3d(0, 0, 0)';
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [padding, disabled, magnetStrength, activeTransition, inactiveTransition]);
  return (
    <Tag ref={wrap} className={wrapperClassName} style={{ position: 'relative', display: 'inline-block' }} {...props}>
      <span ref={inner} className={innerClassName} style={{ display: 'inline-block', willChange: 'transform' }}>{children}</span>
    </Tag>
  );
}
