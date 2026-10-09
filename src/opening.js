// The OPENING: the first seconds of a visit belong to the hero's entrance —
// the name and the line over it coming out of a blur, the portrait, the
// chips, the waves dropping in row by row. All of that runs on the main
// thread, and a cold load used to spend those same seconds building things
// nobody could see yet (the owner, Oct 9: "the opening of the site is really
// rough"): the 3D lanyard's WebGL renderer and its shaders (it counted as
// "near" because the Experience page starts just under the hero), the five
// robot meshes, the left film's first clips. Measured on a cold load: the
// main thread blocked 6.5 s of the first 7, one frame 2 s long, the name
// frozen half-blurred, the waves arriving all at once.
//
// So work that is not for the first screen waits for `whenOpened`: the
// entrance is over and the browser is idle — or the reader has started to
// scroll, which is the moment it is needed. The waiting jobs then run ONE
// PER IDLE PERIOD, so they do not stack into one long stall.

// the hero's entrance: the waves' last row lands ~3.2 s after they start
// (50 ms a row, 1.2 s each); the name, portrait and chips are done by 2 s
const ENTRANCE_MS = 3200;

let opened = false;
let started = false;
const jobs = [];

const idle = (fn, timeout) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(fn, { timeout })
  : setTimeout(fn, 1));

function runNext() {
  const job = jobs.shift();
  if (!job) return;
  try { job(); } catch (e) { setTimeout(() => { throw e; }); }
  if (jobs.length) idle(runNext, 600);
}

function open() {
  if (opened) return;
  opened = true;
  removeEventListener('scroll', onScroll);
  idle(runNext, 600);
}

function onScroll() { if (scrollY > 0) open(); }

// Called once the app has mounted. The entrance's clock starts with the
// first frame the browser draws, not with the module.
export function startOpening() {
  if (started || typeof window === 'undefined') return;
  started = true;
  addEventListener('scroll', onScroll, { passive: true });
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => setTimeout(() => idle(open, 1500), reduce ? 300 : ENTRANCE_MS));
}

export const isOpened = () => opened;

// run `fn` once the opening is over (at once if it is); returns a cancel
export function whenOpened(fn) {
  if (opened) { jobs.push(fn); if (jobs.length === 1) idle(runNext, 600); }
  else jobs.push(fn);
  return () => { const i = jobs.indexOf(fn); if (i >= 0) jobs.splice(i, 1); };
}
