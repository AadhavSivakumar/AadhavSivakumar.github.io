// Whether the project-card cover videos play.
//
// WCAG 2.2.2 asks for a way to pause anything that starts moving on its own and
// runs longer than five seconds. There are up to 17 looping covers on the
// Projects page, so the control is page-level rather than per card: a button on
// each card would also be an interactive element nested inside a card that is
// itself a button, which is worse than the problem it solves.
//
// A module-level store rather than context, because the only consumers are the
// covers and the one toggle, and threading a provider through App for that is
// more plumbing than it is worth.

const KEY = 'aadhav:covers-playing';

export const prefersReduce = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function initial() {
  if (typeof window === 'undefined') return false;
  if (prefersReduce()) return false;
  try {
    // An explicit pause is remembered; anything else plays.
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true; // storage can throw (private mode, blocked cookies)
  }
}

let playing = initial();
const subscribers = new Set();

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function getPlaying() {
  return playing;
}

// Server snapshot: never claim to be playing before hydration.
export function getServerPlaying() {
  return false;
}

export function setPlaying(next) {
  if (next === playing) return;
  playing = next;
  try {
    window.localStorage.setItem(KEY, next ? 'on' : 'off');
  } catch {
    /* not being able to remember the choice must not break making it */
  }
  subscribers.forEach(fn => fn());
}
