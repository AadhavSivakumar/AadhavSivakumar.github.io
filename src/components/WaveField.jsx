import React, { useEffect, useRef } from 'react';
import { onScroll as onPageScroll } from '../scrollDriver';
import {
  ROWS, VW, VH, FIELD_A, FREQ_LAND, FREQ_PORT, DRIFT,
  rowY, rowA, waveY, S_ART, live, heroPhase, heroHeight,
} from '../waveField';

// The hero's sine field: ONE fixed full-viewport canvas behind the page that
// rides the page by drawing itself offset by -scrollY, so it scrolls away
// with the hero. It used to cut every row at the centre line and fly the
// halves into the two pieces; the owner: "the sine waves can be their own
// thing" — the pieces fade in on their own now, and this draws only the field.
//
// Idle rules: it redraws only while something moves — the entrance, the drift
// while the hero is on screen and the tab is visible (~30fps: it moves ten
// pixels a second), the mouse bulge. Past the hero the canvas is cleared once
// and nothing runs.
//
// The stroke TAPERS down the field (the owner: "a little thicker at the top
// and thinner at the bottom"), from STROKE_TOP to STROKE_BOTTOM css px.
const STROKE_TOP = 3.8, STROKE_BOTTOM = 0.6;
// the pointer lens: its radius (virtual units) and how far it parts the rows
const LENS_R = 46, LENS_H = { land: 40, port: 16 };

export default function WaveField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 1, H = 1, dpr = 1, portrait = false;
    let heroH = heroHeight();
    let scrollY = window.scrollY;
    const t0 = performance.now();

    let ink = '#C5A35C', inkRGB = [197, 163, 92], fieldA = FIELD_A.light;
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue('--accent-color').trim() || ink;
      const v = ink.replace('#', '');
      inkRGB = [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
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
    };

    measure();

    // ── the pointer LENS ────────────────────────────────────────────────
    // (the owner: "make the mouse hovering effect a bit better"). It was
    // /portfolio's bulge: every row near the cursor lifted into one lump that
    // snapped on and off. Now the rows PART around the pointer — pushed up
    // above it and down below it, like a lens — the lens follows the pointer
    // with easing rather than sitting on it, and fades in and out.
    let tx = null, ty = null;               // where the pointer is (virtual units)
    let mx = null, my = null;               // where the lens is, easing after it
    let lens = 0, lensTo = 0;               // its strength, 0..1
    const onMove = e => {
      if (reduce) return;
      const yPage = e.clientY + scrollY;
      if (yPage < 0 || yPage > heroH) { lensTo = 0; wake(); return; }
      tx = (e.clientX / W) * VW;
      ty = (yPage / heroH) * VH;
      if (mx === null) { mx = tx; my = ty; }
      lensTo = 1;
      wake();
    };
    const onLeave = () => { lensTo = 0; wake(); };
    // ease the lens toward the pointer; true while it is still moving
    const stepLens = dt => {
      if (mx === null) return false;
      const k = 1 - Math.exp(-dt * 9), kl = 1 - Math.exp(-dt * (lensTo ? 6 : 4));
      mx += (tx - mx) * k; my += (ty - my) * k;
      lens += (lensTo - lens) * kl;
      if (lensTo === 0 && lens < 0.002) { lens = 0; mx = my = null; return false; }
      return Math.abs(tx - mx) + Math.abs(ty - my) > 0.05 || Math.abs(lensTo - lens) > 0.002;
    };

    // ── drawing ─────────────────────────────────────────────────────────
    // A field point at screen x on row i sits at
    //   y = (rowY + wave) * heroH / VH - scrollY
    // with the wave mirrored about the centre: its argument is |xv - VW/2|.
    function fieldY(i, yv, xs, phase, freq, bulgeH) {
      const xv = (xs / W) * VW;
      let w = waveY(i, Math.abs(xv - VW / 2), phase, freq);
      if (bulgeH > 0 && lens > 0) {
        // a derivative of a gaussian in y: rows above are pushed up, rows
        // below pushed down, the push fading with distance in x and y
        const dx = xv - mx, dy = yv - my, d2 = dx * dx + dy * dy, R = LENS_R;
        // tapered to EXACTLY zero at 3R by a smooth window: a hard cutoff
        // there left ~1.3 units of push and every row stepped at the edge
        // (the owner: "a weird discontinuity… with the mouse hover effect")
        if (d2 < 9 * R * R) { const q = 1 - d2 / (9 * R * R); w += bulgeH * lens * (dy / R) * Math.exp(-d2 / (2 * R * R)) * q * q; }
      }
      return (yv + w) * (heroH / VH) - scrollY;
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const s = heroPhase(scrollY);
      if (s >= S_ART) return false;
      const elapsed = now - t0;
      const phase = live.phase, freq = live.freq;
      const bulgeH = portrait ? LENS_H.port : LENS_H.land;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = ink;
      let entering = false;
      for (let i = 0; i < ROWS; i++) {
        // entrance: each row drops in from above — /portfolio's 50ms stagger
        // and 1200ms cubic-out
        let e = 1;
        if (!reduce) {
          const t = (elapsed - i * 50) / 1200;
          if (t < 1) { e = t <= 0 ? 0 : 1 - Math.pow(1 - t, 3); entering = true; }
        }
        if (e <= 0) continue;
        const yv = -50 + (rowY(i) + 50) * e;
        const a = rowA(i) * e * fieldA;
        if (a <= 0.004) continue;
        ctx.globalAlpha = a;
        // eased, so the upper rows stay heavy and the thinning happens lower down
        ctx.lineWidth = STROKE_TOP + (STROKE_BOTTOM - STROKE_TOP) * Math.pow(i / (ROWS - 1), 0.75);
        // SMOOTH: a point every ~6 px, joined by quadratic curves through the
        // midpoints (straight segments showed their corners on the thick top
        // rows — "I can still see individual segments")
        ctx.beginPath();
        const N = Math.max(120, Math.round(W / 6));
        let px = 0, py = fieldY(i, yv, 0, phase, freq, bulgeH);
        ctx.moveTo(px, py);
        for (let q = 1; q <= N; q++) {
          const xs = (W * q) / N, y = fieldY(i, yv, xs, phase, freq, bulgeH);
          ctx.quadraticCurveTo(px, py, (px + xs) / 2, (py + y) / 2);
          px = xs; py = y;
        }
        ctx.lineTo(px, py);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return entering || lensBusy;      // is anything still moving on its own?
    }

    // ── the loop ────────────────────────────────────────────────────────
    // Runs only while something animates on its own: the entrance, the drift
    // (hero on screen, tab visible, ~30fps), the bulge. Otherwise the scroll
    // driver is the only thing that redraws.
    let raf = 0, prev = 0, lastDraw = 0, needDraw = true, lensBusy = false;
    const DRIFT_MS = 31;
    const heroOnScreen = () => scrollY < heroH;
    function tick(now) {
      raf = 0;
      const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 0;
      prev = now;
      const drifting = !reduce && heroOnScreen() && document.visibilityState !== 'hidden';
      if (drifting) live.phase -= DRIFT * dt;
      lensBusy = stepLens(dt || 1 / 60);
      if (!lensBusy && !needDraw && now - lastDraw < DRIFT_MS) {
        if (drifting) raf = requestAnimationFrame(tick); else prev = 0;
        return;
      }
      needDraw = false;
      lastDraw = now;
      const moving = draw(now);
      if (moving || drifting) raf = requestAnimationFrame(tick);
      else prev = 0;
    }
    function wake() { needDraw = true; if (!raf) { prev = 0; raf = requestAnimationFrame(tick); } }

    let cleared = false;
    const stop = onPageScroll(y => {
      scrollY = y;
      // Past the morph the canvas is blank and nothing runs.
      if (heroPhase(y) >= S_ART) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; prev = 0; }
        if (!cleared) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); cleared = true; }
        return;
      }
      cleared = false;
      wake();
    });

    const onResize = () => { measure(); wake(); };
    window.addEventListener('resize', onResize, { passive: true });
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(document.documentElement);
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
