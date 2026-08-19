// One scroll driver for the whole page.
//
// Before this there were four handlers on `scroll` — the progress bar, the
// header's shadow, and one per side flourish — each with its own rAF or, worse,
// none at all. Two of them read `document.documentElement.scrollHeight` inside
// the handler, which forces a layout flush on every single scroll event, and
// the progress bar then wrote to an anime.js timeline synchronously in the same
// handler. Scrolling therefore cost a layout and a style write per event rather
// than per frame.
//
// So: ONE passive listener, at most ONE rAF in flight, and the document height
// measured on resize instead of on every event. Subscribers are called with
// (scrollY, progress) from inside that single frame, which is also the only
// place any of them may touch the DOM.
//
// The height cannot simply be cached once — it changes when images finish
// loading, when the modal locks body scroll, and when a section reflows. A
// ResizeObserver on <body> catches those; that is the whole reason the old code
// could get away with reading it per event.

const subscribers = new Set();

let raf = 0;
let maxScroll = 1;
let listening = false;
let ro = null;

function measure() {
  maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

function flush() {
  raf = 0;
  const y = window.scrollY;
  const p = Math.min(1, Math.max(0, y / maxScroll));
  // Copy first: a subscriber may unsubscribe itself while we iterate.
  for (const fn of [...subscribers]) fn(y, p);
}

function request() {
  if (!raf) raf = requestAnimationFrame(flush);
}

function onResize() {
  measure();
  request();
}

function start() {
  if (listening) return;
  listening = true;
  measure();
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(onResize);
    ro.observe(document.body);
  }
}

function stop() {
  if (!listening) return;
  listening = false;
  window.removeEventListener('scroll', request);
  window.removeEventListener('resize', onResize);
  ro?.disconnect();
  ro = null;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

// Subscribe to scroll. `fn(scrollY, progress)` runs inside the shared rAF.
// Returns an unsubscribe function. Calls `fn` once immediately with the
// current position so callers do not have to prime themselves.
export function onScroll(fn) {
  start();
  subscribers.add(fn);
  fn(window.scrollY, Math.min(1, Math.max(0, window.scrollY / maxScroll)));
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) stop();
  };
}

// For anything that needs the measurement the driver already has.
export function scrollProgress() {
  return Math.min(1, Math.max(0, window.scrollY / maxScroll));
}
