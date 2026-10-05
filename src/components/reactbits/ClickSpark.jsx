// From React Bits (reactbits.dev) — Copyright (c) 2026 David Haz.
// MIT + Commons Clause License Condition v1.0 (see ./LICENSE.md): used here as
// part of this website; not to be sold, sublicensed or redistributed.
//
// Adapted: one fixed, full-viewport canvas that listens to clicks anywhere
// (upstream wraps children in a box), sized to the device pixel ratio, and —
// the important one — the animation loop runs ONLY while sparks are alive.
// Upstream ran requestAnimationFrame forever, clearing an empty canvas 60
// times a second; this site keeps a still page still. Off under reduced
// motion.
import { useEffect, useRef } from 'react';

export default function ClickSpark({ sparkColor = '#C5A35C', sparkSize = 10, sparkRadius = 18, sparkCount = 8, duration = 420, extraScale = 1 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let sparks = [], raf = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ease = t => t * (2 - t);
    const draw = now => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      sparks = sparks.filter(s => {
        const t = (now - s.start) / duration;
        if (t >= 1) return false;
        const e = ease(t), d = e * sparkRadius * extraScale, len = sparkSize * (1 - e);
        ctx.strokeStyle = sparkColor; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x + d * Math.cos(s.a), s.y + d * Math.sin(s.a));
        ctx.lineTo(s.x + (d + len) * Math.cos(s.a), s.y + (d + len) * Math.sin(s.a));
        ctx.stroke();
        return true;
      });
      raf = sparks.length ? requestAnimationFrame(draw) : 0;
      if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    const onClick = e => {
      if (e.clientX === 0 && e.clientY === 0) return;           // keyboard "clicks"
      const now = performance.now();
      for (let i = 0; i < sparkCount; i++) sparks.push({ x: e.clientX, y: e.clientY, a: (2 * Math.PI * i) / sparkCount, start: now });
      if (!raf) raf = requestAnimationFrame(draw);
    };
    window.addEventListener('click', onClick, { passive: true });
    window.addEventListener('resize', size);
    return () => { window.removeEventListener('click', onClick); window.removeEventListener('resize', size); cancelAnimationFrame(raf); };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, extraScale]);
  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 3000 }} />;
}
