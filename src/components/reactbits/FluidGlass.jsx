// After React Bits' FluidGlass (reactbits.dev/components/fluid-glass) —
// Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0
// (see ./LICENSE.md): used here as part of this website; not to be sold,
// sublicensed or redistributed.
//
// Its LENS mode as the site's cursor (the owner, Oct 9: "replace the current
// cursor animation with this"), and on a card the glass grows over the whole
// card ("when hovering over a card, have it expand to the whole card").
//
// REBUILT, not copied. Upstream is a three.js scene (@react-three/fiber,
// drei's MeshTransmissionMaterial, a lens.glb) whose glass bends only what
// is inside that scene: its own pictures and text, rendered to a buffer
// behind the lens. This page is HTML, and a WebGL canvas cannot read it, so
// over the site upstream's lens would bend nothing. Here the glass refracts
// the PAGE ITSELF through an SVG filter used as a backdrop-filter (the
// technique GlassSurface uses for the navbar and the tags): a displacement
// map drawn for the glass's current shape — a lens that magnifies a little
// in the middle and bends hard at its rim; over a card, a slab whose middle
// is flat, so the card stays readable, with the same bent rim — applied once
// per colour channel at slightly different strengths for upstream's
// chromatic aberration (0.1). Upstream's too: the lens chases the pointer on
// maath's damp (smoothTime 0.15), and it is clear glass, not frosted.
//
// The rest of the rules are the site's: the system cursor stays; nothing
// runs while nothing moves (one rAF loop that stops when everything has
// arrived, so a resting pointer writes nothing); a card's 3D tilt is copied
// onto the glass so the two stay one shape; hidden until the pointer first
// moves and while it is outside the page or over an iframe; absent on touch
// screens and under reduced motion. Chromium only refracts: Firefox and
// Safari cannot filter a backdrop through SVG, so there the glass is its rim
// and glint (FluidGlass.css), with no map drawn at all.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onScroll } from '../../scrollDriver';
import './FluidGlass.css';

const FILTER_ID = 'fluid-glass-filter';
// copies of a card that fly in the modal carry its classes: not targets
const NOT_CARDS = '.modal-animator, [role="dialog"]';

const MAG = 0.1;        // the lens's middle is magnified ~11%
const RIM = 0.45;       // the lens's bent rim, as a fraction of its radius
const BEND = 0.45;      // how far in the very edge samples, as a fraction of the rim
const CA = 0.1;         // chromatic aberration (upstream's lensProps)
const FOLLOW = 0.15;    // the lens chasing the pointer (upstream's damp)
const GROW = 0.14;      // growing over a card and back
const SLIDE = 0.12;     // from one card straight to the next

const lerp = (a, b, t) => a + (b - a) * t;
const cardRim = (w, h) => Math.min(26, 0.2 * Math.min(w, h));

// maath's damp (Unity's SmoothDamp: critically damped, no overshoot).
// Returns whether it is still moving.
function damp(o, to, st, dt, eps) {
  const w = 2 / st, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const c = o.x - to, t = (o.v + w * c) * dt;
  o.v = (o.v - w * t) * e;
  o.x = to + (c + t) * e;
  if (Math.abs(o.x - to) < eps && Math.abs(o.v) < eps * 10) { o.x = to; o.v = 0; return false; }
  return true;
}
const dv = x => ({ x, v: 0 });

// The displacement map for a W x H glass with corner radius R. Red and green
// carry the x and y offset each pixel takes the backdrop from (0.5 = none) as
// a fraction of `scale`. Inside the rim band the offset points INWARD, rising
// steeply toward the edge — the edge shows the content just inside it,
// stretched, which is what a thick glass edge does; `mag` adds a pull toward
// the middle (magnification). Offsets are smooth, so the map is drawn at a
// fraction of the size and stretched by the filter.
let canvas = null;
const cache = new Map();
function mapFor(W, H, R, rim, mag) {
  const key = `${W}x${H}r${R}b${rim}m${mag}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const q = Math.max(0.2, Math.min(0.5, 80 / Math.min(W, H)));
  const w = Math.max(2, Math.round(W * q)), h = Math.max(2, Math.round(H * q));
  const A = rim * BEND;
  const scale = 2 * (A + (mag * Math.max(W, H)) / 2) + 2;
  canvas = canvas || document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  const hx = W / 2 - R, hy = H / 2 - R, k255 = 255 / scale;
  for (let j = 0; j < h; j++) {
    const y = ((j + 0.5) / h) * H - H / 2;
    for (let i = 0; i < w; i++) {
      const x = ((i + 0.5) / w) * W - W / 2;
      const qx = Math.abs(x) - hx, qy = Math.abs(y) - hy;
      let nx, ny, e;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); nx = (qx / l) * Math.sign(x); ny = (qy / l) * Math.sign(y); e = R - l; }
      else if (qx > qy) { nx = Math.sign(x); ny = 0; e = R - qx; }
      else { nx = 0; ny = Math.sign(y); e = R - qy; }
      const u = Math.max(0, 1 - Math.max(0, e) / rim);
      const o = A * u * u;
      const p = (j * w + i) * 4;
      d[p] = 127.5 + (-nx * o - x * mag) * k255;
      d[p + 1] = 127.5 + (-ny * o - y * mag) * k255;
      d[p + 2] = 128;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const out = { href: canvas.toDataURL(), scale };
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  cache.set(key, out);
  return out;
}

// the card's UNtransformed box (centre and size) and its transform, read off
// the page: its on-screen box is the bounding box of the transformed one, so
// the transform's own corner spread is subtracted back out of it
function cardBox(el) {
  const r = el.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  const cs = getComputedStyle(el);
  const tf = cs.transform && cs.transform !== 'none' ? cs.transform : 'none';
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;
  if (tf === 'none') return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w, h, radius, tf, origin: '50% 50%' };
  const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
  const M = new DOMMatrixReadOnly(tf);
  let x0 = Infinity, y0 = Infinity;
  for (const [cx, cy] of [[0, 0], [w, 0], [w, h], [0, h]]) {
    const p = M.transformPoint(new DOMPoint(cx - ox, cy - oy, 0, 1));
    x0 = Math.min(x0, p.x / p.w); y0 = Math.min(y0, p.y / p.w);
  }
  const left = r.left - ox - x0, top = r.top - oy - y0;
  // the origin as a fraction, so it lands in the same place on a glass that
  // is still growing toward the card's size
  return { cx: left + w / 2, cy: top + h / 2, w, h, radius, tf, origin: `${((ox / w) * 100).toFixed(2)}% ${((oy / h) * 100).toFixed(2)}%` };
}

function supportsSVGBackdrop() {
  const ua = navigator.userAgent;
  if ((/Safari/.test(ua) && !/Chrome/.test(ua)) || /Firefox/.test(ua)) return false;
  const div = document.createElement('div');
  div.style.backdropFilter = `url(#${FILTER_ID})`;
  return div.style.backdropFilter !== '';
}

export default function FluidGlass({ cardSelector = '.lift-card', size = 128 }) {
  const glassRef = useRef(null);
  const mapRef = useRef(null);
  const chanRefs = [useRef(null), useRef(null), useRef(null)];
  const [enabled] = useState(() => typeof window !== 'undefined' && !!window.matchMedia
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [svg] = useState(() => enabled && supportsSVGBackdrop());

  useEffect(() => {
    const el = glassRef.current;
    if (!enabled || !el) return undefined;
    const feImage = mapRef.current;
    const chans = chanRefs.map(r => r.current);
    const LENS_RIM = (size / 2) * RIM;

    let mx = 0, my = 0, shown = false;
    const px = dv(0), py = dv(0);                  // the lens, chasing the pointer
    const m = dv(0);                               // 0 = the lens, 1 = over the card
    const box = { cx: dv(0), cy: dv(0), w: dv(0), h: dv(0) };   // the card's box, eased between cards
    let card = null;     // the card under the pointer
    let last = null;     // the card the glass is (or was last) over, until it is a lens again
    let lastRead = null, raf = 0, prev = 0;
    const drawn = {};

    const set = (k, v, apply) => { if (drawn[k] !== v) { drawn[k] = v; apply(v); } };

    const tick = now => {
      raf = 0;
      const dt = prev ? Math.min(0.05, Math.max(0.001, (now - prev) / 1000)) : 1 / 60;
      prev = now;
      let busy = false;
      busy = damp(px, mx, FOLLOW, dt, 0.02) | busy;
      busy = damp(py, my, FOLLOW, dt, 0.02) | busy;

      if (card && !card.isConnected) release();
      let cb = null;
      if (last) {
        cb = cardBox(last);
        const read = `${cb.cx},${cb.cy},${cb.w},${cb.h},${cb.tf}`;
        if (read !== lastRead) { busy = true; lastRead = read; }      // the card is tilting, scaling or scrolling
        if (m.x < 0.001) for (const k of ['cx', 'cy', 'w', 'h']) { box[k].x = cb[k]; box[k].v = 0; }
        for (const k of ['cx', 'cy', 'w', 'h']) busy = damp(box[k], cb[k], SLIDE, dt, 0.02) | busy;
      }
      busy = damp(m, card ? 1 : 0, GROW, dt, 0.0005) | busy;
      if (!card && m.x === 0) { last = null; lastRead = null; }

      const t = last ? m.x : 0;
      const cx = lerp(px.x, box.cx.x, t), cy = lerp(py.x, box.cy.x, t);
      const w = lerp(size, box.w.x, t), h = lerp(size, box.h.x, t);
      const r = lerp(size / 2, cb ? Math.min(cb.radius, w / 2, h / 2) : size / 2, t);
      set('tr', `${(cx - w / 2).toFixed(1)}px ${(cy - h / 2).toFixed(1)}px`, v => { el.style.translate = v; });
      set('w', `${w.toFixed(1)}px`, v => { el.style.width = v; });
      set('h', `${h.toFixed(1)}px`, v => { el.style.height = v; });
      set('r', `${r.toFixed(1)}px`, v => { el.style.borderRadius = v; });
      set('tf', t > 0 && cb ? cb.tf : 'none', v => { el.style.transform = v; });
      set('or', t > 0 && cb ? cb.origin : '50% 50%', v => { el.style.transformOrigin = v; });
      if (svg) {
        const rim = Math.round(lerp(LENS_RIM, cardRim(w, h), t));
        const map = mapFor(Math.round(w), Math.round(h), Math.round(r), Math.max(1, rim), +(MAG * (1 - t)).toFixed(3));
        set('map', map.href, v => {
          // the map's box in the glass's own pixels: the filter's user space
          // is the glass's border box, and a percentage here resolved
          // against the 0x0 <svg> instead
          feImage.setAttribute('width', Math.round(w));
          feImage.setAttribute('height', Math.round(h));
          feImage.setAttribute('href', v);
          chans.forEach((c, i) => c.setAttribute('scale', (map.scale * (1 + (i - 1) * CA)).toFixed(2)));
        });
      }

      if (busy) raf = requestAnimationFrame(tick);
      else prev = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    function release() { card = null; kick(); }
    const enter = c => {
      if (c === card) return;
      // straight on from another card, the box slides from that one (tick)
      card = c; last = c; lastRead = null;
      kick();
    };

    const onMove = e => {
      mx = e.clientX; my = e.clientY;
      if (!shown) {
        shown = true;
        px.x = mx; py.x = my; px.v = py.v = 0;
        el.classList.add('is-on');
      }
      kick();
    };
    const hide = () => {
      if (!shown) return;
      shown = false;
      el.classList.remove('is-on');
      card = null; last = null; lastRead = null; m.x = 0; m.v = 0;
    };
    const cardAt = node => {
      const c = node instanceof Element ? node.closest(cardSelector) : null;
      return c && !c.closest(NOT_CARDS) ? c : null;
    };
    // no relatedTarget: the pointer left the window, or went into an iframe
    const onOut = e => { if (!e.relatedTarget) hide(); };
    const onOver = e => {
      const c = cardAt(e.target);
      if (c) enter(c); else if (card) release();
    };
    // a click opens the card's modal: the glass goes back to being a lens
    const onClick = e => { if (card && card.contains(e.target)) release(); };
    // scrolled out from under the pointer (no mouse event says so), or the
    // card moved: follow it, or let go
    const stopScroll = onScroll(() => {
      if (!card && !last) return;
      if (card) {
        const under = cardAt(document.elementFromPoint(mx, my));
        if (under !== card) { if (under) enter(under); else release(); }
      }
      kick();
    });

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    window.addEventListener('click', onClick, { capture: true, passive: true });
    window.addEventListener('blur', hide);
    return () => {
      stopScroll();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('blur', hide);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, svg, cardSelector, size]);

  if (!enabled) return null;
  return createPortal(
    <>
      {svg && (
        <svg className="fluid-glass__defs" aria-hidden="true" focusable="false">
          <filter id={FILTER_ID} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%" primitiveUnits="userSpaceOnUse">
            <feImage ref={mapRef} x="0" y="0" width="128" height="128" preserveAspectRatio="none" result="map" />
            <feDisplacementMap ref={chanRefs[0]} in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="dispR" />
            <feColorMatrix in="dispR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feDisplacementMap ref={chanRefs[1]} in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="dispG" />
            <feColorMatrix in="dispG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feDisplacementMap ref={chanRefs[2]} in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="dispB" />
            <feColorMatrix in="dispB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" />
          </filter>
        </svg>
      )}
      <div ref={glassRef} className={`fluid-glass ${svg ? 'fluid-glass--svg' : 'fluid-glass--plain'}`} aria-hidden="true" />
    </>,
    document.body
  );
}
