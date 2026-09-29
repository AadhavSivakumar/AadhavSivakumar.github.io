import React, { useEffect, useRef } from 'react';
import { onScroll } from '../scrollDriver';
import { onSettle } from '../scrollSnap';
import { actAt, heroPhase, win, smooth } from '../waveField';

// The LEFT stage, rendered in Manim (the owner: "refactor the whole left side
// animation in manim"). The scenes are in manim/left.py and the clips are
// encoded by scripts/render-left.sh into Media/web/leftfilm/<theme>/.
//
// Five ACTS, one per page boundary (actAt, the same timeline the right-hand
// robots use), each a clip whose frame is SET FROM THE SCROLL — every frame of
// an act clip is a keyframe, so a seek lands at once. When the page settles
// on a section, the matching IDLE clip loops instead (the pick-and-place, the
// latent pulse, the twins re-randomising …). Two <video>s: the scrub clip and
// the idle clip, swapped by opacity; nothing plays or seeks on a still page.
// Both themes are rendered; a theme toggle swaps the sources.
const BASE = '/Media/web/leftfilm/';
const ACTS = ['Act0', 'Act1', 'Act2', 'Act3', 'Act4'];
const IDLES = ['IdleRest', 'IdleUntrained', 'IdleTwin', 'IdleData', 'IdleTrain', 'IdleReal'];   // held state before act 0, then after each act
const FPS = 30;
// An act counts as FINISHED a hair before its end: a snap on a real screen
// can land a fraction of a pixel short of the section top (fractional
// device pixels), which left t at 0.999 — the idle loop never started and
// the scrub sat one frame short of the finished text (the owner: "the last
// letter… is not fully loaded in when at the snap points… only the very last
// one is [animated]"; the last page is held by the bottom of the document).
const DONE = 0.985;

const themeNow = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Each clip is fetched WHOLE and played from a blob URL: the clips are small
// (0.2-0.9 MB), and a blob is seekable everywhere, whatever the server does
// with byte ranges (a server without them left the act clips stuck on their
// first frame). H.264 where the browser has it, VP9 where it does not.
let FMT = null;
const fmt = () => {
  if (FMT) return FMT;
  const v = document.createElement('video');
  FMT = v.canPlayType('video/mp4; codecs="avc1.42E01E"') ? 'mp4' : 'webm';
  return FMT;
};
const blobs = new Map();          // url -> Promise<objectURL>
const clipURL = url => {
  if (!blobs.has(url)) blobs.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.blob(); }).then(b => URL.createObjectURL(b)));
  return blobs.get(url);
};
function setSrc(v, theme, name, onReady) {
  const key = `${theme}/${name}`;
  if (v.dataset.clip === key) { if (onReady && v.readyState >= 1) onReady(); else if (onReady) v.addEventListener('loadedmetadata', onReady, { once: true }); return; }
  v.dataset.clip = key;
  // HIDDEN until the new clip has landed on its frame: until then the OLD
  // clip's last frame was on screen — the camera, on a page far from it
  // (the owner: "the 3d camera is reappearing at additional projects")
  v.style.visibility = 'hidden';
  v.removeAttribute('poster');
  clipURL(`${BASE}${key}.${fmt()}`).then(u => {
    if (v.dataset.clip !== key) return;
    const reveal = () => { if (v.dataset.clip === key) v.style.visibility = ''; };
    v.addEventListener('loadedmetadata', () => {
      if (onReady) onReady();
      // revealed on the seek the callback started, or on the first frame
      v.addEventListener('seeked', reveal, { once: true });
      v.addEventListener('loadeddata', reveal, { once: true });
    }, { once: true });
    v.src = u;
  }).catch(() => {});
}
const prefetch = (theme, name) => { clipURL(`${BASE}${theme}/${name}.${fmt()}`).catch(() => {}); };

export default function LeftFilm() {
  const hostRef = useRef(null);
  const scrubRef = useRef(null);
  const idleRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current, scrub = scrubRef.current, idle = idleRef.current;
    if (!host || !scrub || !idle) return undefined;
    let theme = themeNow();
    let state = { i: -1, t: 0 };
    let settled = false;
    let raf = 0;

    const showIdle = on => {
      idle.style.opacity = on ? '1' : '0';
      scrub.style.opacity = on ? '0' : '1';
      if (!on) idle.pause();
    };
    // ONE seek in flight at a time: a seek per scroll frame queued decodes
    // faster than a software decoder could deliver them (p90 frames of 33-49
    // ms in headless Firefox); the next seek goes when the last has landed,
    // to wherever the scroll is by then
    let want = null, seeking = false;
    const pump = () => {
      if (seeking || want === null) return;
      if (Math.abs(scrub.currentTime - want) <= 0.5 / FPS) { want = null; return; }
      seeking = true;
      scrub.currentTime = want;
      want = null;
    };
    scrub.addEventListener('seeked', () => { seeking = false; pump(); });
    scrub.addEventListener('emptied', () => { seeking = false; });
    // put the scrub clip on the frame for (i, t)
    const seek = () => {
      const { i, t } = state;
      setSrc(scrub, theme, ACTS[Math.max(0, i)], () => {
        const d = scrub.duration;
        if (!d || !isFinite(d)) return;
        // at the end of an act, the clip's TRUE last frame (the finished
        // text): `d - 1/FPS` could land on the frame before it
        want = i < 0 ? 0 : state.t >= DONE ? d - 0.25 / FPS : Math.min(d - 1 / FPS, Math.max(0, state.t * d));
        pump();
      });
    };
    // the held state the page is sitting in, if any: before act 0, or at the end of an act
    const heldIndex = () => (state.i < 0 ? 0 : state.t >= DONE ? state.i + 1 : null);
    const update = () => {
      raf = 0;
      // where the page is NOW: on a fresh load straight onto a section the
      // first measurement ran before the layout had grown, said "before act
      // 0", and the camera's idle loop played on Additional Projects until
      // something scrolled
      state = actAt(window.scrollY);
      const hi = heldIndex();
      if (settled && hi !== null && !reduced()) {
        idle.loop = true;
        setSrc(idle, theme, IDLES[hi], () => { showIdle(true); idle.play().catch(() => {}); });
      } else {
        showIdle(false);
        seek();
      }
      // every act clip once the reader is past the hero (under 1 MB in all),
      // so a jump across pages never waits on a download; the next idle too
      if (state.i >= 0 || scrollY > 200) ACTS.forEach(a => prefetch(theme, a));
      const n = Math.max(0, state.i + 1);
      prefetch(theme, IDLES[Math.min(IDLES.length - 1, n)]);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

    const stopScroll = onScroll(y => {
      // the stage fades in as the hero leaves (it used to form from the waves)
      // DIMMED to a background texture while the lanyard badges share its
      // column (Experience and Research): the camera showed through the gaps
      // around the badges and read as clutter; full strength again as the
      // reader leaves Research
      const ex = document.getElementById('experience'), pr = document.getElementById('projects');
      let dim = 1;
      if (ex && pr) {
        const a = ex.offsetTop - innerHeight * 0.5, z = pr.offsetTop - innerHeight * 0.35;
        dim = y < a || y > z ? 1 : 0.28 + 0.72 * Math.max(smooth(win(a + innerHeight * 0.4 - y, 0, innerHeight * 0.4)), smooth(win(y, z - innerHeight * 0.4, innerHeight * 0.4)));
      }
      host.style.opacity = String(0.95 * smooth(win(heroPhase(y), 0.3, 0.62)) * dim);
      const s = actAt(y);
      if (s.i === state.i && Math.abs(s.t - state.t) < 0.002) return;
      state = s;
      schedule();
    });
    const stopSettle = onSettle(v => { settled = !!v; schedule(); });
    // the page's layout settling (images, fonts, the lazy sections) moves
    // the act boundaries; re-place the stage when it does
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null;
    if (ro) ro.observe(document.body);
    const mo = new MutationObserver(() => { theme = themeNow(); scrub.dataset.clip = ''; idle.dataset.clip = ''; schedule(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    schedule();
    return () => { stopScroll(); stopSettle(); mo.disconnect(); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); idle.pause(); };
  }, []);

  return (
    <div ref={hostRef} className="f3d f3d--left f3d--film" aria-hidden="true" style={{ opacity: 0 }}>
      <video ref={scrubRef} className="film-v" muted playsInline preload="auto" />
      <video ref={idleRef} className="film-v" muted playsInline preload="none" style={{ opacity: 0 }} />
    </div>
  );
}
