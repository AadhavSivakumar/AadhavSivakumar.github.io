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
//
// And only while the page is STILL (Oct 13, the owner: "a bit of lag while
// scrolling"): a job that comes due while the reader is scrolling waits until
// the scroll has stopped for STILL_MS. Building a WebGL renderer or parsing a
// model mid-scroll is a frozen frame under the reader's hand — the Research
// badges came near ~0.65 s into the scroll to Experience, the Atlas near the
// end of the scroll to the last page. Later work uses the same queue.

// the hero's entrance: the waves' last row lands ~3.2 s after they start
// (50 ms a row, 1.2 s each); the name, portrait and chips are done by 2 s
const ENTRANCE_MS = 3200;

const STILL_MS = 250;

let opened = false;
let started = false;
let lastScroll = -1e9;
let pending = false;
const jobs = [];

const idle = (fn, timeout) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(fn, { timeout })
  : setTimeout(fn, 1));

// one chain at a time: the next job, at the next idle period, after `ms`
function schedule(ms = 0) {
  if (pending) return;
  pending = true;
  const go = () => idle(runNext, 600);
  if (ms > 0) setTimeout(go, ms); else go();
}

// Still means no scroll for STILL_MS AND none in the frame after: one long
// frame spaces the events of a scroll in progress further apart than
// STILL_MS, and a job run then lands mid-scroll (seen in the software-GPU
// harness). A frame's scroll events are dispatched before its animation
// callbacks, so the frame also shows the scroll held up behind a long job.
function runNext() {
  if (!jobs.length) { pending = false; return; }
  const wait = STILL_MS - (performance.now() - lastScroll);
  if (wait > 0) { pending = false; schedule(wait); return; }
  const mark = lastScroll;
  requestAnimationFrame(() => {
    pending = false;
    if (lastScroll !== mark) { schedule(STILL_MS); return; }
    const job = jobs.shift();
    if (job) { try { job(); } catch (e) { setTimeout(() => { throw e; }); } }
    if (jobs.length) schedule();
  });
}

function open() {
  if (opened) return;
  opened = true;
  schedule();
}

function onScroll() {
  lastScroll = performance.now();
  if (!opened && scrollY > 0) open();
}

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

// run `fn` once the opening is over, at the next idle moment with the page
// still; returns a cancel. `first` puts it at the head of the queue (the
// badges: the biggest one-off cost, built before the reader is likely to
// scroll on)
export function whenOpened(fn, first = false) {
  if (first) jobs.unshift(fn); else jobs.push(fn);
  if (opened) schedule();
  return () => { const i = jobs.indexOf(fn); if (i >= 0) jobs.splice(i, 1); };
}
