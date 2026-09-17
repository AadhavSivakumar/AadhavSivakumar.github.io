import { onScroll } from './scrollDriver';

// Scroll settles onto a page, and tells the art when it has.
//
// Stop with a section half in frame and, two seconds later, the page eases
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
const IDLE_MS = 2000;      // stillness before it acts
const ALIGN_TOL = 8;       // px: close enough, leave it alone
const MAX_PULL = 0.55;     // of a viewport
const RETRY_MS = 600;      // while something is in the way
const FIT = 1.05;          // a section counts as "fits" up to this much of one

const IDS = ['hero', 'experience', 'research', 'projects', 'additional-projects', 'resume', 'skills', 'contact'];

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

function blocked() {
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

  // After the eased scroll is issued, watch for the arrival rather than
  // waiting out another two seconds — the art should come alive as soon as
  // the page stops.
  const watchArrival = target => {
    let hits = 0;
    const step = () => {
      watch = 0;
      if (Math.abs(window.scrollY - target) <= 2) hits += 1; else hits = 0;
      if (hits >= 3) { setSettled(true); return; }
      watch = requestAnimationFrame(step);
    };
    watch = requestAnimationFrame(step);
  };

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
    window.scrollTo({ top: target, behavior: 'smooth' });
    watchArrival(target);
  };

  const stop = onScroll(() => {
    setSettled(false);
    if (watch) { cancelAnimationFrame(watch); watch = 0; }
    clearTimeout(timer);
    timer = setTimeout(attempt, IDLE_MS);
  });

  return () => {
    stop();
    clearTimeout(timer);
    if (watch) cancelAnimationFrame(watch);
    setSettled(false);
  };
}
