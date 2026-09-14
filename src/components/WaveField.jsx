import React, { useEffect, useRef } from 'react';
import { onScroll as onPageScroll } from '../scrollDriver';
import {
  ROWS, VW, VH, STROKE, FIELD_A, BULGE, FREQ_LAND, FREQ_PORT, DRIFT,
  rowY, rowA, waveY, S_HANDOFF, win, rowSplit, live, heroPhase, heroHeight,
} from '../waveField';

// The hero's sine field, as ONE fixed full-viewport canvas behind the page.
//
// It used to be an SVG inside the hero with a CSS translate animation. That
// version could not do the thing this one exists for: once you scroll, the
// rows are cut at the centre line and the two halves travel out to the side
// flourish stages, compressing to fit them, where each becomes the raw
// material the camera and the motor are drawn from (see the prelude in
// Flourish3D.jsx). A row that has to leave the hero and land on a fixed
// element cannot live inside the hero, so the field is fixed and RIDES the
// page by offsetting itself by -scrollY until it detaches.
//
// What it costs: one clear and 25 strokes a frame, and only while there is
// something to animate — the drift while the hero is on screen, the mouse
// bulge while the pointer is over it, the travel while the split is in
// progress. Past the handoff the canvas is cleared once and left alone; the
// scroll driver is the only thing that can wake it again.

export default function WaveField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 1, H = 1, dpr = 1, portrait = false;
    let stages = null;                 // { L, R }: R is the motor's stage, L a matching one off the left edge
    let heroH = heroHeight();
    let scrollY = window.scrollY;
    const t0 = performance.now();

    let ink = '#C5A35C', fieldA = FIELD_A.light;
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue('--accent-color').trim() || ink;
      fieldA = document.documentElement.getAttribute('data-theme') === 'dark' ? FIELD_A.dark : FIELD_A.light;
    };
    readTheme();

    const measure = () => {
      W = window.innerWidth; H = window.innerHeight;
      portrait = W / H < 1;
      live.freq = portrait ? FREQ_PORT : FREQ_LAND;
      const cap = W < 992 ? 1.25 : 1.5;
      dpr = Math.min(window.devicePixelRatio || 1, cap);
      const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      heroH = heroHeight();
      // Only the right half has somewhere to go: the motor's stage. The left
      // half is sent to a mirror of it just past the left edge of the screen,
      // fading as it goes, so the split still reads as a split.
      const R = document.querySelector('.f3d--right');
      const rr = R && R.getBoundingClientRect();
      stages = rr && rr.width > 0
        ? { R: { x: rr.left, y: rr.top, w: rr.width, h: rr.height },
            L: { x: -rr.width - 24, y: rr.top, w: rr.width, h: rr.height } }
        : null;
    };
    measure();

    // ── the mouse bulge, from /portfolio ────────────────────────────────
    // A gaussian lifted under the cursor, in virtual units of the un-split
    // field. Only while the pointer is over the hero band.
    let mx = null, my = null;
    const onMove = e => {
      if (reduce) return;
      const yPage = e.clientY + scrollY;
      if (yPage < 0 || yPage > heroH) { mx = my = null; return; }
      mx = (e.clientX / W) * VW;
      my = (yPage / heroH) * VH;
      wake();
    };
    const onLeave = () => { mx = my = null; wake(); };

    // ── drawing ─────────────────────────────────────────────────────────
    // Every row is drawn as two halves, cut at the centre line, because that
    // is what the split needs — and while the split is 0 the two halves join
    // at the same point and read as one line.
    //
    // A point at virtual (xv, yv) in the un-split field sits on screen at
    //   full:   x = xv / VW * W,  y = yv / VH * heroH - scrollY
    // and in its half's stage at
    //   stage:  x = S.x + frac * S.w,  y = S.y + yv / VH * S.h
    // where frac runs 0..1 across the stage with 0 at the OUTER edge for the
    // left half — the wave is mirrored about the centre, so the left half is
    // the mirror image of the right, and the stage keeps that. The drawn point
    // is the lerp of the two by `u`, the split progress; the wave amplitude is
    // the same lerp of the two vertical scales.
    const STEP = 10;                           // virtual units per sample
    const N = Math.round((VW / 2) / STEP);      // samples per half

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const s = heroPhase(scrollY);
      const layerA = fieldA * (1 - win(s, S_HANDOFF[0], S_HANDOFF[1]));
      if (layerA <= 0.004) return false;

      // Without a stage to fly to (a low-core machine draws no motor) the
      // field simply rides the page and fades where the handoff would be.
      const uLast = stages ? rowSplit(ROWS - 1, s) : 0;
      const elapsed = now - t0;
      const phase = live.phase;
      const freq = live.freq;
      const bulgeMax = portrait ? BULGE.port : BULGE.land;
      const bulge = mx !== null && uLast < 1;

      const kyFull = heroH / VH;
      ctx.lineWidth = STROKE;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = ink;

      let drew = false;
      for (let i = 0; i < ROWS; i++) {
        // entrance: each row drops in from above, staggered — /portfolio's
        // 50ms stagger and 1200ms cubic-out
        let e = 1;
        if (!reduce) {
          const t = (elapsed - i * 50) / 1200;
          if (t < 1) { e = t <= 0 ? 0 : 1 - Math.pow(1 - t, 3); drew = true; }
        }
        if (e <= 0) continue;
        const yv = -50 + (rowY(i) + 50) * e;
        const a = rowA(i) * e * layerA;
        if (a <= 0.004) continue;
        const u = stages ? rowSplit(i, s) : 0;
        const bulgeH = bulgeMax * (1 - u);
        for (let side = 0; side < 2; side++) {
          // the left half fades as it leaves; the right half keeps its alpha
          const sa = side === 0 ? a * (1 - u) * (1 - u) : a;
          if (sa <= 0.004) continue;
          ctx.globalAlpha = sa;
          ctx.beginPath();
          const S = stages ? (side === 0 ? stages.L : stages.R) : null;
          const kyStage = S ? S.h / VH : kyFull;
          const ky = kyFull + (kyStage - kyFull) * u;
          for (let k = 0; k <= N; k++) {
            // d: distance from the centre line, virtual units. Sample so the
            // half runs from the outer edge in, then the join is at k = N.
            const d = side === 0 ? (VW / 2) * (1 - k / N) : (VW / 2) * (k / N);
            const xv = side === 0 ? (VW / 2) - d : (VW / 2) + d;
            let w = waveY(i, d, phase, freq);
            if (bulge && bulgeH > 0) {
              const dx = xv - mx, dy = yv - my, d2 = dx * dx + dy * dy;
              if (d2 < BULGE.cutoff2) w -= bulgeH * Math.exp(-d2 / (2 * BULGE.radius * BULGE.radius));
            }
            const xFull = (xv / VW) * W;
            const yFull = yv * kyFull - scrollY;
            let x = xFull, y = yFull;
            if (S) {
              // frac 0 at the outer edge of each stage
              const frac = side === 0 ? 1 - d / (VW / 2) : d / (VW / 2);
              const xS = S.x + frac * S.w, yS = S.y + yv * kyStage;
              x = xFull + (xS - xFull) * u; y = yFull + (yS - yFull) * u;
            }
            y += w * ky;
            if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      return drew || bulge || uLast < 0.999;      // is anything still moving?
    }

    // ── the loop ────────────────────────────────────────────────────────
    // Runs only while something animates: the entrance, the drift (while the
    // hero is on screen and the rows have not been frozen by the split), the
    // bulge. Otherwise the scroll driver is the only thing that redraws.
    //
    // The drift is redrawn at ~30fps, not 60. It moves ten pixels a second,
    // so a frame every 33ms is a third of a pixel of motion — smooth — and it
    // halves the one cost here that scales with the screen, which is
    // clearing and re-stroking a full-viewport canvas. The bulge follows the
    // pointer and gets the full rate while the pointer is over the field.
    let raf = 0, prev = 0, lastDraw = 0;
    const DRIFT_MS = 31;
    const heroOnScreen = () => scrollY < heroH;
    function tick(now) {
      raf = 0;
      const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 0;
      prev = now;
      const s = heroPhase(scrollY);
      // The drift slows to a stop as the LAST row arrives, so the motor's
      // canvas reads a constant phase at the handoff.
      const u = stages ? rowSplit(ROWS - 1, s) : 0;
      if (!reduce && heroOnScreen()) live.phase -= DRIFT * dt * (1 - u);
      const drifting = !reduce && heroOnScreen() && u < 0.999 && document.visibilityState !== 'hidden';
      if (mx === null && !needDraw && now - lastDraw < DRIFT_MS) {
        if (drifting) raf = requestAnimationFrame(tick); else prev = 0;
        return;
      }
      needDraw = false;
      lastDraw = now;
      const moving = draw(now);
      if (moving || drifting) raf = requestAnimationFrame(tick);
      else prev = 0;
    }
    let needDraw = true;
    const wake = () => { needDraw = true; if (!raf) { prev = 0; raf = requestAnimationFrame(tick); } };

    const stop = onPageScroll(y => {
      scrollY = y;
      // Past the handoff the canvas is blank and nothing runs. Everything
      // before it redraws on scroll, and wakes the loop if it has gone idle.
      if (heroPhase(y) > S_HANDOFF[0] + S_HANDOFF[1] + 0.05) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; prev = 0; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        return;
      }
      wake();
    });

    const onResize = () => { measure(); wake(); };
    window.addEventListener('resize', onResize, { passive: true });
    // the stages are positioned by CSS breakpoints too, so re-measure on any
    // layout change of the flourish layer
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(document.documentElement);
      const layer = canvas.parentElement;
      if (layer) ro.observe(layer);
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    const onVis = () => { if (document.visibilityState !== 'hidden') wake(); };
    document.addEventListener('visibilitychange', onVis);
    const themeWatch = new MutationObserver(() => { readTheme(); wake(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    wake();
    return () => {
      stop();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      ro?.disconnect();
      themeWatch.disconnect();
    };
  }, []);

  return <canvas className="wave-layer" ref={ref} aria-hidden="true" />;
}
