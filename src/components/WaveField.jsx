import React, { useEffect, useRef } from 'react';
import { onScroll as onPageScroll } from '../scrollDriver';
import { glassState, onGlass } from '../glassBus';
import {
  VW, VH, FIELD_A, FREQ_LAND, FREQ_PORT, DRIFT, ROW_FIRST, ROW_LAST,
  rowY, rowA, rowT, waveY, S_ART, live, heroPhase, heroHeight,
} from '../waveField';

// The hero's sine field: ONE fixed full-viewport canvas behind the page that
// rides the page by drawing itself offset by -scrollY, so it scrolls away
// with the hero. It used to cut every row at the centre line and fly the
// halves into the two pieces; the owner: "the sine waves can be their own
// thing" — the pieces fade in on their own now, and this draws only the field.
//
// Idle rules: it redraws only while something moves — the entrance, the drift
// while the hero is on screen and the tab is visible (~30fps: it moves ten
// pixels a second), the gravity well. Past the hero the canvas is cleared once
// and nothing runs.
//
// The stroke TAPERS down the field (the owner: "a little thicker at the top
// and thinner at the bottom"), from STROKE_TOP to STROKE_BOTTOM css px.
const STROKE_TOP = 3.8, STROKE_BOTTOM = 0.9;   // 0.6 until the bottom rows were asked to fade less (Oct 8)
// The GRAVITY WELL under the cursor (Oct 9; the owner: "have the effect of
// the cursor on the waves feel more like a gravity well kind of effect, so it
// plays along better with the circle around the mouse"). The rows used to
// PART round the pointer, pushed away from it. Now every point of every row
// is pulled TOWARD the centre of the cursor glass, by
//   s(r) = G · r · exp(−r² / L²)
// — nothing at the centre (the lens covers it) and nothing far away, most
// just outside the lens's rim, so the rows bunch round the circle as if
// falling into it. G < 1 keeps a row from folding over itself (r − s(r) only
// grows). The centre is the GLASS's own eased centre, read off the glass bus,
// so the well sits exactly under the lens and travels with it; as the glass
// snaps onto a card or a control, the well lets go. Without the glass (it is
// off on touch screens) the well follows the pointer on its own easing.
const WELL_G = 0.72, WELL_L = 2.1;   // strength (under 1: no fold); falloff, in lens radii
const WELL_R = 64;                   // the lens's radius when there is no glass

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

    // ── the gravity well ────────────────────────────────────────────────
    let tx = null, ty = null;               // the pointer, viewport px
    let wx = null, wy = null;               // the well's centre
    let inHero = false;
    let lens = 0;                           // the well's strength, 0..1
    let drawnAt = '';
    const onMove = e => {
      if (reduce) return;
      const yPage = e.clientY + scrollY;
      inHero = yPage >= 0 && yPage <= heroH;
      tx = e.clientX; ty = e.clientY;
      if (wx === null) { wx = tx; wy = ty; }
      wake();
    };
    const onLeave = () => { inHero = false; wake(); };
    // move the centre and ease the strength; true while either still changes
    const stepLens = dt => {
      if (wx === null && !glassState.on) return false;
      const glass = glassState.on;
      if (glass) { wx = glassState.x; wy = glassState.y; }
      else if (tx !== null) { const k = 1 - Math.exp(-dt * 9); wx += (tx - wx) * k; wy += (ty - wy) * k; }
      const to = reduce || !inHero ? 0 : glass ? 1 - glassState.snap : 1;
      lens += (to - lens) * (1 - Math.exp(-dt * (to > lens ? 6 : 4)));
      if (Math.abs(to - lens) < 0.002) lens = to;
      const at = `${wx},${wy},${lens}`;
      const moved = at !== drawnAt;
      drawnAt = at;
      return moved || (!glass && tx !== null && Math.abs(tx - wx) + Math.abs(ty - wy) > 0.3);
    };

    // ── drawing ─────────────────────────────────────────────────────────
    // A field point at screen x on row i sits at
    //   y = (rowY + wave) * heroH / VH - scrollY
    // with the wave mirrored about the centre: its argument is |xv - VW/2|.
    function fieldY(i, yv, xs, phase, freq) {
      const xv = (xs / W) * VW;
      return (yv + waveY(i, Math.abs(xv - VW / 2), phase, freq)) * (heroH / VH) - scrollY;
    }
    // the well's pull on one point, in place on P (screen px). Past 3L the
    // pull is under a fiftieth of a pixel, so the points there are skipped.
    const P = [0, 0];
    let wellG = 0, wellL2 = 1;
    function pull(x, y) {
      P[0] = x; P[1] = y;
      if (wellG <= 0) return P;
      const dx = x - wx, dy = y - wy, d2 = dx * dx + dy * dy;
      if (d2 > 9 * wellL2) return P;
      const f = wellG * Math.exp(-d2 / wellL2);
      P[0] = x - dx * f; P[1] = y - dy * f;
      return P;
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const s = heroPhase(scrollY);
      if (s >= S_ART) return false;
      const elapsed = now - t0;
      const phase = live.phase, freq = live.freq;
      const R = glassState.on ? glassState.r : WELL_R;
      wellG = lens > 0.001 && wx !== null ? WELL_G * lens : 0;
      wellL2 = (WELL_L * R) ** 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = ink;
      let entering = false;
      for (let i = ROW_FIRST; i <= ROW_LAST; i++) {
        // entrance: each row drops in from above — /portfolio's 50ms stagger
        // and 1200ms cubic-out
        let e = 1;
        if (!reduce) {
          const t = (elapsed - (i - ROW_FIRST) * 50) / 1200;
          if (t < 1) { e = t <= 0 ? 0 : 1 - Math.pow(1 - t, 3); entering = true; }
        }
        if (e <= 0) continue;
        const yv = -50 + (rowY(i) + 50) * e;
        const a = rowA(i) * e * fieldA;
        if (a <= 0.004) continue;
        ctx.globalAlpha = a;
        // eased, so the upper rows stay heavy and the thinning happens lower down
        ctx.lineWidth = STROKE_TOP + (STROKE_BOTTOM - STROKE_TOP) * Math.pow(rowT(i), 0.75);
        // SMOOTH: a point every ~6 px, joined by quadratic curves through the
        // midpoints (straight segments showed their corners on the thick top
        // rows — "I can still see individual segments")
        ctx.beginPath();
        const N = Math.max(120, Math.round(W / 6));
        pull(0, fieldY(i, yv, 0, phase, freq));
        let px = P[0], py = P[1];
        ctx.moveTo(px, py);
        for (let q = 1; q <= N; q++) {
          const xs = (W * q) / N;
          pull(xs, fieldY(i, yv, xs, phase, freq));
          const x = P[0], y = P[1];
          ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
          px = x; py = y;
        }
        ctx.lineTo(px, py);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return entering || lensBusy;      // is anything still moving on its own?
    }

    // ── the loop ────────────────────────────────────────────────────────
    // Runs only while something animates on its own: the entrance, the drift
    // (hero on screen, tab visible, ~30fps), the well. Otherwise the scroll
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
    const stopGlass = onGlass(() => { if (!cleared) wake(); });
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
      stopGlass();
      themeWatch.disconnect();
    };
  }, []);

  return <canvas className="wave-layer" ref={ref} aria-hidden="true" />;
}
