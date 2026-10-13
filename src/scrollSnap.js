import { onScroll } from './scrollDriver';

// Scroll settles onto a page, and tells the art when it has.
//
// Stop with a section half in frame and, IDLE_MS later, the page glides
// until that section fills the screen. Every page is one screen tall (see
// CLAUDE.md, "Pages"), so a settled page always shows exactly one — and that
// is also where the two canvas pieces are at a keypoint: the waves have just
// finished becoming the camera and the motor at the top of Experience, and
// act two has just finished at the top of Research. What runs while settled
// (the motor spinning its fan, the camera taking a picture) is in
// Flourish3D.jsx, driven by `onSettle` below.
//
// It must never fight the reader. It only acts after the scroll has been
// STILL for two seconds, and not at all when:
//   - a modal has locked the page (`body.style.overflow`)
//   - a lanyard badge is being dragged (`body.style.cursor`)
//   - a text field or an embedded frame has focus
//   - the nearest section does not fit the screen (a phone, a short laptop in
//     landscape): pulling someone to its top would skip what they are reading
//   - the pull would be more than MAX_PULL of a screen — they are mid-section
//     on purpose, not near a boundary
//   - the reader asked for reduced motion, in which case nothing moves on its
//     own at all
const IDLE_MS = 700;       // stillness before it pulls a misaligned page into frame
const REST_MS = 120;       // stillness before an ALIGNED page counts as settled
const ALIGN_TOL = 8;       // px: close enough, leave it alone
const MAX_PULL = 0.55;     // of a viewport
const RETRY_MS = 600;      // while something is in the way
const FIT = 1.05;          // a section counts as "fits" up to this much of one

// The glide is a SIGMOID in time (Oct 13, the owner: "have the snapping to a
// section be more gradual, like a sigmoid"): it leaves slowly, is quickest
// halfway and eases into the page, over GLIDE_MIN..GLIDE_MAX ms by distance.
// It was the browser's own smooth scroll — off the mark at full speed, and
// ~0.3 s in Firefox. A logistic curve, rescaled to run exactly 0 -> 1.
const GLIDE_MIN = 750, GLIDE_MAX = 1300, GLIDE_PER_PX = 1.1;   // ms, ms, ms a px
const SIG_K = 8;           // steepness: higher waits longer at both ends
const logistic = x => 1 / (1 + Math.exp(-SIG_K * (x - 0.5)));
const L0 = logistic(0), L1 = logistic(1);
const sigmoid = u => (logistic(u) - L0) / (L1 - L0);

const IDS = ['hero', 'experience', 'research', 'projects', 'additional-projects', 'skills', 'contact'];

const listeners = new Set();
let settled = false;

function setSettled(v) {
  if (v === settled) return;
  settled = v;
  for (const fn of [...listeners]) fn(v);
}

// Subscribe to "the page is sitting still on a section". Calls back with the
// current state immediately; returns an unsubscribe.
export function onSettle(fn) {
  listeners.add(fn);
  fn(settled);
  return () => listeners.delete(fn);
}

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

// a finger on the screen: a phone's pages fit one screen too (Oct 8), so the
// snap runs there, and must not pull the page while the reader holds it
let touching = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', e => { touching = e.touches.length; }, { passive: true });
  window.addEventListener('touchend', e => { touching = e.touches.length; }, { passive: true });
  window.addEventListener('touchcancel', () => { touching = 0; }, { passive: true });
}

function blocked() {
  if (touching > 0) return true;                                   // a finger is down
  if (document.body.style.overflow === 'hidden') return true;      // modal open
  if (document.body.style.cursor === 'grabbing') return true;      // dragging a badge
  const ae = document.activeElement;
  if (!ae) return false;
  const tag = ae.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'IFRAME' || ae.isContentEditable === true;
}

// The section to settle onto: the nearest one whose top is within reach and
// which fits the screen.
function candidate(y) {
  const h = window.innerHeight;
  let best = null;
  for (const id of IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.offsetHeight > h * FIT) continue;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const d = Math.abs(top - y);
    if (d <= h * MAX_PULL && (!best || d < best.d)) best = { top, d, id };
  }
  return best;
}

export function startScrollSnap() {
  if (typeof window === 'undefined' || prefersReduced()) return () => {};
  let timer = 0;
  let watch = 0;
  // True while OUR glide is in flight. Without it, the scroll events it
  // emits would reschedule everything and cancel it.
  let self = false;

  // The glide: one frame at a time on the sigmoid, an INSTANT scroll per
  // frame (html's scroll-behavior is smooth, and 'auto' would hand every
  // step to the browser's own easing). It holds the target for two more
  // frames before letting go, so its last scroll events land while `self`
  // still says they are ours. It replaced the browser's smooth scroll, which
  // could also be DROPPED on the first scroll after a load (one section in
  // eight failed to snap) and needed an arrival watch to re-issue it.
  const glide = target => {
    const from = window.scrollY;
    const dur = Math.min(GLIDE_MAX, GLIDE_MIN + Math.abs(target - from) * GLIDE_PER_PX);
    const t0 = performance.now();
    let hold = 0;
    self = true;
    const step = now => {
      watch = 0;
      const u = Math.min(1, Math.max(0, (now - t0) / dur));
      const y = u < 1 ? from + (target - from) * sigmoid(u) : target;
      if (Math.abs(window.scrollY - y) >= 0.5) window.scrollTo({ top: y, behavior: 'instant' });
      if (u >= 1 && ++hold > 2) { self = false; setSettled(true); return; }
      watch = requestAnimationFrame(step);
    };
    watch = requestAnimationFrame(step);
  };

  // Any real input hands control straight back to the reader.
  const yieldToUser = () => {
    if (!self) return;
    self = false;
    if (watch) { cancelAnimationFrame(watch); watch = 0; }
  };
  const INPUTS = ['wheel', 'touchstart', 'keydown', 'mousedown'];
  for (const ev of INPUTS) window.addEventListener(ev, yieldToUser, { passive: true });

  // One attempt, after the page has been still. If something is in the way —
  // a modal, a drag — it tries again shortly rather than giving up: closing a
  // modal fires no scroll event, and without the retry the page would sit
  // misaligned until the reader scrolled again.
  const attempt = () => {
    if (blocked()) { timer = setTimeout(attempt, RETRY_MS); return; }
    const y = window.scrollY;
    const c = candidate(y);
    if (!c || Math.abs(c.top - y) <= ALIGN_TOL) { setSettled(true); return; }
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const target = Math.max(0, Math.min(max, Math.round(c.top)));
    if (Math.abs(target - y) <= ALIGN_TOL) { setSettled(true); return; }
    glide(target);
  };

  // A page that is ALREADY in frame is settled as soon as the scroll stops
  // (REST_MS), so what runs while settled — the robots working, the shutter —
  // starts the moment the reader arrives. Only a misaligned page waits the
  // longer IDLE_MS before being pulled into frame; the owner found the
  // original two seconds "taking too long".
  const aligned = () => {
    const c = candidate(window.scrollY);
    return !c || Math.abs(c.top - window.scrollY) <= ALIGN_TOL;
  };
  const stop = onScroll(() => {
    if (self) return;                  // our own glide; it owns the scroll
    setSettled(false);
    if (watch) { cancelAnimationFrame(watch); watch = 0; }
    clearTimeout(timer);
    timer = setTimeout(() => { if (aligned()) attempt(); else timer = setTimeout(attempt, IDLE_MS - REST_MS); }, REST_MS);
  });

  return () => {
    stop();
    clearTimeout(timer);
    if (watch) cancelAnimationFrame(watch);
    for (const ev of INPUTS) window.removeEventListener(ev, yieldToUser);
    setSettled(false);
  };
}
