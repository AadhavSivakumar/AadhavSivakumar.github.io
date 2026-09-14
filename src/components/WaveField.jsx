import React, { useEffect, useRef } from 'react';
import { onScroll as onPageScroll } from '../scrollDriver';
import {
  ROWS, VW, VH, STROKE, FIELD_A, BULGE, FREQ_LAND, FREQ_PORT, DRIFT,
  rowY, rowA, waveY, S_MORPH, S_ART, win, smooth, live, heroPhase, heroHeight,
  targets, partStart, partT, strandFade, PART_SPAN,
} from '../waveField';

// The hero's sine field, as ONE fixed full-viewport canvas behind the page —
// and the canvas that turns it into the two pieces.
//
// Scroll, and every row is cut at the centre line. The LEFT half of each row
// flies straight from the big field into the camera, the RIGHT half into the
// motor, part by part, top to bottom. This canvas draws every strand the
// whole way, because it is the only one that spans both the field and the two
// stages; the pieces (Flourish3D.jsx) publish where the strands land and fade
// each part's real drawing in as its strands arrive.
//
// A row that has to leave the hero and land on a fixed element cannot live
// inside the hero, so the field is fixed and RIDES the page by offsetting
// itself by -scrollY.
//
// Idle rules: it redraws only while something moves — the entrance, the drift
// while the hero is on screen and the tab is visible (~30fps: it moves ten
// pixels a second), the mouse bulge. Past the morph the canvas is cleared once
// and nothing runs.

const STAGE_W = 340;          // the pieces' drawing units (Flourish3D W)
const SIDES = ['left', 'right'];

// Resample a polyline (flat x,y pairs) to n points evenly along its length.
function resample(pts, n) {
  const m = pts.length / 2;
  if (m === n) return pts;
  const out = new Float64Array(n * 2);
  const cum = new Float64Array(m);
  for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  const L = cum[m - 1];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = L * (n > 1 ? k / (n - 1) : 0);
    while (j < m - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j];
    const t = seg > 1e-9 ? (d - cum[j]) / seg : 0;
    out[k * 2] = pts[j * 2] + (pts[j * 2 + 2] - pts[j * 2]) * t;
    out[k * 2 + 1] = pts[j * 2 + 1] + (pts[j * 2 + 3] - pts[j * 2 + 1]) * t;
  }
  return out;
}

export default function WaveField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 1, H = 1, dpr = 1, portrait = false;
    const stages = { left: null, right: null };
    let heroH = heroHeight();
    let scrollY = window.scrollY;
    const t0 = performance.now();
    let plan = null;

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
      for (const side of SIDES) {
        const el = document.querySelector(`.f3d--${side}`);
        const r = el && el.getBoundingClientRect();
        stages[side] = r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
      }
      plan = null;
    };

    // ── the plan: which piece of which row becomes which line ───────────
    // Built from each piece's published targets. A side's lines are ranked by
    // part (top to bottom on screen), then dealt across the 25 rows in that
    // order — so each part forms from its own band of rows — and each half-row
    // is cut into one fragment per line it owns, in proportion to the lines'
    // widths. A fragment and its line are resampled to the same point count.
    function buildPlan() {
      plan = { v: targets.v, sides: {} };
      for (const side of SIDES) {
        const T = targets[side], S = stages[side];
        if (!T || !S || !T.recs.length) continue;
        const k = S.w / STAGE_W;                         // drawing units -> css px
        const n = T.order.length;
        const rank = new Map(T.order.map((id, i) => [id, i]));
        const recs = T.recs.slice().sort((A, B) => (rank.get(A.id) - rank.get(B.id)) || (A.cy - B.cy));
        const x0 = side === 'left' ? 0 : W / 2, x1 = side === 'left' ? W / 2 : W;
        const rows = [];
        for (let i = 0; i < ROWS; i++) {
          const a = Math.floor((recs.length * i) / ROWS), b = Math.floor((recs.length * (i + 1)) / ROWS);
          const own = recs.slice(a, b).sort((A, B) => A.cx - B.cx);
          const total = own.reduce((acc, r) => acc + r.bw, 0) || 1;
          let x = x0;
          rows.push(own.map((r, j) => {
            const wpx = (r.bw / total) * (x1 - x0);
            const xa = x, xb = x + wpx; x = xb;
            const np = Math.max(r.pts.length / 2, Math.ceil(wpx / 7) + 1);
            const src = resample(r.pts, np);
            const tgt = new Float64Array(np * 2);
            for (let q = 0; q < np; q++) { tgt[q * 2] = S.x + src[q * 2] * k; tgt[q * 2 + 1] = S.y + src[q * 2 + 1] * k; }
            // run the fragment the way the line runs, so ends meet ends
            const dir = tgt[0] <= tgt[(np - 1) * 2] ? 1 : -1;
            // where it lands: on the line's midpoint, along its direction
            // (first->last, or first->middle for a closed ring), at its length
            const h = (np >> 1) * 2, e = (np - 1) * 2;
            let L = 0;
            for (let q = 2; q <= e; q += 2) L += Math.hypot(tgt[q] - tgt[q - 2], tgt[q + 1] - tgt[q - 1]);
            let vx = tgt[e] - tgt[0], vy = tgt[e + 1] - tgt[1];
            if (Math.hypot(vx, vy) < 0.3 * L) { vx = tgt[h] - tgt[0]; vy = tgt[h + 1] - tgt[1]; }
            const ang = Math.atan2(vy, vx);
            const rk = rank.get(r.id);
            return {
              xa, xb, np, dir, tgt,
              ca: Math.cos(ang), sa: Math.sin(ang), tmx: tgt[h], tmy: tgt[h + 1],
              g: Math.max(0.15, Math.min(1.6, (Math.hypot(vx, vy) || L) / Math.max(1, wpx))),
              rank: rk,
              // a little stagger inside a part, so its strands do not move as a block
              lead: partStart(rk, n) + (own.length > 1 ? j / (own.length - 1) : 0) * 0.04,
              rgb: r.rgb, a: r.a, w: r.w * k,
            };
          }));
        }
        plan.sides[side] = { rows, n };
      }
    }

    measure();

    // ── the mouse bulge, from /portfolio ────────────────────────────────
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
    // A field point at screen x on row i sits at
    //   y = (rowY + wave) * heroH / VH - scrollY
    // with the wave mirrored about the centre: its argument is |xv - VW/2|.
    function fieldY(i, yv, xs, phase, freq, bulgeH) {
      const xv = (xs / W) * VW;
      let w = waveY(i, Math.abs(xv - VW / 2), phase, freq);
      if (bulgeH > 0 && mx !== null) {
        const dx = xv - mx, dy = yv - my, d2 = dx * dx + dy * dy;
        if (d2 < BULGE.cutoff2) w -= bulgeH * Math.exp(-d2 / (2 * BULGE.radius * BULGE.radius));
      }
      return (yv + w) * (heroH / VH) - scrollY;
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const s = heroPhase(scrollY);
      if (s >= S_ART) return false;
      const m = win(s, S_MORPH[0], S_MORPH[1]);
      if (!reduce && (!plan || plan.v !== targets.v)) buildPlan();
      const elapsed = now - t0;
      const phase = live.phase, freq = live.freq;
      const bulgeH = (portrait ? BULGE.port : BULGE.land) * (1 - m);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

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
        const srcA = rowA(i) * e * fieldA;

        for (const side of SIDES) {
          const P = !reduce && m > 0 && plan ? plan.sides[side] : null;
          const frags = P && P.rows[i];
          const x0 = side === 'left' ? 0 : W / 2, x1 = side === 'left' ? W / 2 : W;
          if (!frags || !frags.length) {
            // A plain half-row: the field before the morph, and any half with
            // nothing to become (no piece on this machine, or reduced motion)
            // simply fades as the morph runs.
            const a = srcA * (1 - smooth(m));
            if (a <= 0.004) continue;
            ctx.globalAlpha = a; ctx.strokeStyle = ink; ctx.lineWidth = STROKE;
            ctx.beginPath();
            const N = 50;
            for (let q = 0; q <= N; q++) {
              const xs = x0 + ((x1 - x0) * q) / N;
              const y = fieldY(i, yv, xs, phase, freq, bulgeH);
              if (q) ctx.lineTo(xs, y); else ctx.moveTo(xs, y);
            }
            ctx.stroke();
            continue;
          }
          for (const f of frags) {
            const pt = partT(m, f.rank, P.n);
            const fade = strandFade(pt);
            // style rides the second half of the move, so a strand is still
            // gold while it travels
            const st = smooth(win(pt, 0.35, 0.65));
            const a = (srcA + (f.a - srcA) * st) * fade;
            if (a <= 0.004) continue;
            const mk = win(m, f.lead, PART_SPAN);
            const e1 = smooth(win(mk, 0, 0.62));      // fly, still a wave
            const e2 = smooth(win(mk, 0.42, 0.58));   // bend into the line
            ctx.globalAlpha = a;
            ctx.strokeStyle = `rgb(${Math.round(inkRGB[0] + (f.rgb[0] - inkRGB[0]) * st)},${Math.round(inkRGB[1] + (f.rgb[1] - inkRGB[1]) * st)},${Math.round(inkRGB[2] + (f.rgb[2] - inkRGB[2]) * st)})`;
            ctx.lineWidth = STROKE + (f.w - STROKE) * st;
            ctx.beginPath();
            // 1 · FLY: the strand travels as a rigid wave, turned to its
            //     line's direction, scaled to its length, centred on its
            //     midpoint — every line has its own midpoint, so nothing piles
            //     up. 2 · BEND: from there to the line is a short distance.
            const xm = (f.xa + f.xb) / 2, ym = fieldY(i, yv, xm, phase, freq, bulgeH);
            for (let q = 0; q < f.np; q++) {
              const t = f.np > 1 ? q / (f.np - 1) : 0;
              const xs = f.dir > 0 ? f.xa + (f.xb - f.xa) * t : f.xb - (f.xb - f.xa) * t;
              const ys = fieldY(i, yv, xs, phase, freq, bulgeH);
              const ox = (xs - xm) * f.g, oy = (ys - ym) * f.g;
              const fx = f.tmx + ox * f.ca - oy * f.sa, fy = f.tmy + ox * f.sa + oy * f.ca;
              const X1 = xs + (fx - xs) * e1, Y1 = ys + (fy - ys) * e1;
              const x = X1 + (f.tgt[q * 2] - X1) * e2, y = Y1 + (f.tgt[q * 2 + 1] - Y1) * e2;
              if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      return entering || (mx !== null && m < 1);      // is anything still moving on its own?
    }

    // ── the loop ────────────────────────────────────────────────────────
    // Runs only while something animates on its own: the entrance, the drift
    // (hero on screen, tab visible, ~30fps), the bulge. Otherwise the scroll
    // driver is the only thing that redraws.
    let raf = 0, prev = 0, lastDraw = 0, needDraw = true;
    const DRIFT_MS = 31;
    const heroOnScreen = () => scrollY < heroH;
    function tick(now) {
      raf = 0;
      const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 0;
      prev = now;
      const drifting = !reduce && heroOnScreen() && document.visibilityState !== 'hidden';
      if (drifting) live.phase -= DRIFT * dt;
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
