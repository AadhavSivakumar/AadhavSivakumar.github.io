import React, { useEffect, useRef, useState } from 'react';
import { onScroll } from '../scrollDriver';
import { heroPhase, actAt, smooth, clamp01 } from '../waveField';

// The two canvas pieces' home. On a desktop it is the same fixed, behind-
// everything layer it always was (CSS: inset 0, z-index -1) and this
// component is invisible. On a PHONE (≤768px) the pieces ride IN THE NAVBAR
// (the owner, Oct 8: "on mobile, just have the animations play in the little
// empty space in the navbar"): the header leaves a stretch, `.header-art`,
// between the theme toggle and the profiles, and the dock is laid exactly
// over it, both stages side by side. It was a band across the bottom of the
// screen before that.
//
// The bar turns solid page colour as the pieces begin to fade in (a third of
// the hero scrolled, the point LeftFilm's and Flourish3D's fade starts from):
// the left film is rendered on the page colour, and over the frosted bar its
// frame showed as a box. That is `html.dock-solid`, in CSS.

// FRAMING. The bar is ~54px tall, and the whole 340x660 drawing at that
// height put a robot 20px high at the bottom of it (the SO-ARM's ink is rows
// 386-571 of 660). So each stage shows the box its ink fills ON THIS PAGE,
// in drawing units [x0, y0, x1, y1]: measured at every settled page (the
// work loops over ~24 s) and every act (eight moments each), in SwiftShader
// Chromium at 1440x900, plus 8 units of margin. PAGE[k] is the k-th page
// from Experience; ACT[k] is the box that holds everything act k draws
// between page k and page k+1 (the camera's exploding parts in act 0 still
// leave it, as they leave the film's frame on a desktop). Re-measure if a
// scene moves.
const FRAMES = {
  left: {
    PAGE: [[28, 83, 312, 433], [19, 191, 321, 487], [29, 18, 312, 487], [14, 18, 317, 629], [16, 18, 323, 588], [19, 18, 321, 487]],
    ACT: [[19, 18, 321, 487], [19, 18, 321, 487], [14, 18, 317, 633], [14, 18, 323, 629], [16, 18, 323, 590]],
  },
  right: {
    PAGE: [[37, 290, 219, 527], [107, 378, 267, 579], [72, 330, 233, 542], [40, 233, 298, 519], [12, 156, 319, 572], [44, 101, 313, 542]],
    ACT: [[37, 290, 277, 579], [66, 288, 267, 579], [40, 233, 298, 542], [12, 156, 319, 573], [12, 92, 319, 572]],
  },
};
const lerp4 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// the box at scroll y: a page's box while settled; across an act, eased from
// one page's box to the next, opening out to the act's box in the middle
function frameAt(side, y) {
  const F = FRAMES[side];
  const { i, t } = actAt(y);
  if (i < 0) return F.PAGE[0];
  if (t >= 1) return F.PAGE[Math.min(i + 1, F.PAGE.length - 1)];
  const base = lerp4(F.PAGE[i], F.PAGE[i + 1], smooth(t));
  const open = smooth(clamp01(t / 0.25)) * smooth(clamp01((1 - t) / 0.25));
  return lerp4(base, F.ACT[i], open);
}
const GAP = 12, PAD = 4, AIR = 8;   // between the stages; at the stretch's ends; above + below in the bar

export default function RobotDock({ children }) {
  const ref = useRef(null);
  const [solid, setSolid] = useState(false);

  useEffect(() => onScroll(y => setSolid(heroPhase(y) > 0.3)), []);
  useEffect(() => { document.documentElement.classList.toggle('dock-solid', solid); }, [solid]);

  // Lay the dock over the header's free stretch and frame the stages in it.
  // The stretch is whatever the toggle and the profiles leave on that phone
  // (~140px on a 390px screen, ~76 on a 320), so it is measured, and again
  // when the header or the stretch changes size. Framing is redone on scroll
  // (only while the page moves) and nothing is written unless a number
  // changed. On wider screens the stretch is not rendered: nothing is done,
  // and anything written for a phone is cleared.
  useEffect(() => {
    const dock = ref.current;
    const slot = document.querySelector('.header-art');
    const head = slot && slot.closest('header');
    if (!dock || !slot || !head) return undefined;
    let geo = null, lastGeo = '', lastFrame = '';
    const stages = () => ['left', 'right'].map(side => ({ side, el: dock.querySelector(`.f3d--${side}`) })).filter(s => s.el);

    // the scale each stage is drawn at for a set of boxes: both fill the same
    // height, AIR short of the bar's, unless the stretch is too narrow for
    // that (then the pair fills its width)
    const fit = boxes => {
      const aspect = boxes.reduce((a, b) => a + (b[2] - b[0]) / (b[3] - b[1]), 0);
      const room = geo.w - 2 * PAD - GAP * (boxes.length - 1);
      return Math.max(1, Math.min(geo.h - AIR, room / aspect));
    };

    const frame = y => {
      if (!geo) return;
      const ss = stages();
      const boxes = ss.map(s => frameAt(s.side, y));
      const band = fit(boxes);
      const widths = boxes.map(b => (b[2] - b[0]) * band / (b[3] - b[1]));
      let x = (geo.w - widths.reduce((a, w) => a + w, 0) - GAP * (ss.length - 1)) / 2;
      const top = (geo.h - band) / 2;
      const out = ss.map((s, k) => {
        const b = boxes[k], k0 = s.el.__dockK || 1;      // the stage's own layout scale (px per drawing unit)
        const sc = band / (b[3] - b[1]);                  // px per drawing unit now
        const m = sc / k0;
        const tx = x - b[0] * sc, ty = top - b[1] * sc;
        x += widths[k] + GAP;
        return [s.el, `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${m.toFixed(4)})`,
          `inset(${(b[1] * k0).toFixed(2)}px ${((340 - b[2]) * k0).toFixed(2)}px ${((660 - b[3]) * k0).toFixed(2)}px ${(b[0] * k0).toFixed(2)}px)`];
      });
      const key = out.map(o => o[1] + o[2]).join();
      if (key === lastFrame) return;
      lastFrame = key;
      out.forEach(([el, tf, clip]) => { el.style.transform = tf; el.style.clipPath = clip; });
    };

    const place = () => {
      const s = slot.getBoundingClientRect();
      if (!s.width) {
        if (geo) {      // left the phone layout: hand the stages back to the CSS
          geo = null; lastGeo = ''; lastFrame = '';
          stages().forEach(({ el }) => { ['transform', 'clip-path', '--fw', '--fh'].forEach(p => el.style.removeProperty(p)); el.__dockK = 0; });
        }
        return;
      }
      const h = head.getBoundingClientRect();
      const v = [s.left, h.top + head.clientTop, s.width, head.clientHeight].map(n => Math.round(n * 10) / 10);
      const key = v.join();
      if (key === lastGeo) return;
      lastGeo = key;
      ['--dock-l', '--dock-t', '--dock-w', '--dock-hh'].forEach((name, i) => dock.style.setProperty(name, `${v[i]}px`));
      geo = { w: v[2], h: v[3] };
      // each stage's layout size is its CLOSEST framing (every frame after is
      // a scale-down of it, so the canvas and the film stay sharp); it changes
      // only here, on a resize, so the canvas is not reallocated on scroll
      const ss = stages();
      ss.forEach(({ side, el }, k) => {
        const F = FRAMES[side];
        let best = 0;
        F.PAGE.forEach((_, p) => {
          const boxes = ss.map(o => FRAMES[o.side].PAGE[p]);
          best = Math.max(best, fit(boxes) / (F.PAGE[p][3] - F.PAGE[p][1]));
        });
        el.__dockK = best;
        el.style.setProperty('--fw', `${(340 * best).toFixed(2)}px`);
        el.style.setProperty('--fh', `${(660 * best).toFixed(2)}px`);
      });
      lastFrame = '';
      frame(window.scrollY);
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (ro) { ro.observe(slot); ro.observe(head); }
    window.addEventListener('resize', place);
    const stopScroll = onScroll(y => frame(y));
    return () => { stopScroll(); if (ro) ro.disconnect(); window.removeEventListener('resize', place); };
  }, []);

  return <div ref={ref} className="f3d-dock" aria-hidden="true">{children}</div>;
}
