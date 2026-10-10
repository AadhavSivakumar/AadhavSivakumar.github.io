import { onScroll } from './scrollDriver';

// Links to a page, and to a card's modal (the owner, Oct 10: "When the modal
// is open, have it so pasting the url somewhere else automatically opens to
// that specific project/modal. Also do the same for each section"):
//
//   aadhav.dev/#research                            the Research page
//   aadhav.dev/#projects/real2sim2real-so-arm101    that card's modal, open
//
// The part after the slash is the card's `data-link` (a project's title,
// slugged; an experience row's id without "exp-"; "about"), the part before
// it the page the card is on. Following a link scrolls to the page and then
// opens the card exactly as a click does, so the modal still lifts out of
// the card on screen. A link to a card that has gone (a renamed project)
// still lands on its page.
//
// Scrolling REPLACES the hash, it never adds a history entry. Opening a
// modal PUSHES one, so the browser's Back closes it (on a phone that is how
// people close things); closing it with × or Escape goes back over that
// entry, so Back never lands on a dead "modal" entry. Hash URLs rather than
// paths: GitHub Pages (the development copy) has no fallback for unknown
// paths, and the nav's links are already #page anchors.

const IDS = ['hero', 'experience', 'research', 'projects', 'additional-projects', 'skills', 'contact'];

export const slugify = s => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const hashOf = (page, slug) => (slug ? `#${page}/${slug}` : page && page !== 'hero' ? `#${page}` : '');
function parse(hash) {
  let h = (hash || '').replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch { /* a malformed escape: use it as it is */ }
  const [page, slug] = h.split('/');
  return IDS.includes(page) ? { page, slug: slug || null } : { page: null, slug: null };
}
// Safari throws past ~100 history calls in 30 s; a URL a moment stale is harmless
const write = (how, hash, state = null) => {
  try { history[how](state, '', location.pathname + location.search + hash); } catch { /* rate-limited */ }
};

let api = null;         // { open(card), close() }, from App
let modal = null;       // the open modal: { hash, pushed }
let page = 'hero';      // the page the URL names
let following = null;   // the card a link is opening
let busy = false;       // following a link: the scroll is ours
let skipPop = false;    // our own history.back() is on its way

// the page under the middle of the screen
function pageAt() {
  let at = 'hero';
  for (const id of IDS) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= innerHeight / 2) at = id;
  }
  return at;
}

function track() {
  if (modal || busy) return;
  const at = pageAt();
  if (at === page) return;
  page = at;
  write('replaceState', hashOf(at));
}

const topOf = el => el.getBoundingClientRect().top + scrollY;

// the card is on screen and its entrance has finished (useScrollReveal holds
// it at opacity 0 until it is in view, then slides it up): the modal measures
// the card where it rests
function whenShown(card) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const check = () => {
      const r = card.getBoundingClientRect();
      const shown = card.style.opacity !== '0' && !card.getAnimations().length && r.bottom > 0 && r.top < innerHeight;
      if (shown || performance.now() - t0 > 4000) requestAnimationFrame(() => resolve());
      else setTimeout(check, 80);
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(check);
  });
}

async function follow({ page: to, slug }, smooth) {
  const el = document.getElementById(to);
  if (!el) return;
  busy = true;
  page = to;
  scrollTo({ top: topOf(el), behavior: smooth ? 'smooth' : 'instant' });
  const card = slug ? el.querySelector(`[data-link="${CSS.escape(slug)}"]`) : null;
  if (!card) {
    busy = false;
    write('replaceState', hashOf(to), history.state);
    return;
  }
  await whenShown(card);
  // the layout can still have moved under a cold load (fonts): land again
  if (Math.abs(topOf(el) - scrollY) > 2) scrollTo({ top: topOf(el), behavior: 'instant' });
  busy = false;
  if (modal) return;
  following = card;
  api.open(card);
}

function onPop() {
  if (skipPop) { skipPop = false; return; }
  const to = parse(location.hash);
  if (modal) {
    // Back (or an edited URL) away from the open modal closes it
    if (hashOf(to.page, to.slug) !== modal.hash) { modal.pushed = false; api.close(); }
    return;
  }
  if (!to.page) return;
  if (to.slug) follow(to, false);
  else {
    // Back and Forward between pages (the nav's links each add an entry)
    page = to.page;
    write('replaceState', hashOf(to.page), history.state);
    const el = document.getElementById(to.page);
    if (el && to.page !== pageAt()) scrollTo({ top: topOf(el) });   // smooth by the page's own scroll-behavior (instant under reduced motion)
  }
}

// App calls these as a modal opens and once it has closed
export function linkOpened(card) {
  const at = card.closest('section[id]')?.id, slug = card.dataset.link;
  if (!at || !slug) return;
  const hash = hashOf(at, slug);
  const fromLink = card === following;
  following = null;
  page = at;
  if (fromLink) {
    // already at this URL (a pasted link, or Forward onto a modal's entry)
    modal = { hash, pushed: history.state?.modal === hash };
    write('replaceState', hash, history.state);
  } else {
    modal = { hash, pushed: true };
    write('pushState', hash, { modal: hash });
  }
}

export function linkClosed() {
  if (!modal) return;
  const { hash, pushed } = modal;
  modal = null;
  if (pushed && history.state?.modal === hash) { skipPop = true; history.back(); }
  else write('replaceState', hashOf(page));
}

// Start once the page has mounted. Follows the URL's link, if it has one;
// otherwise the page opens at the top, as it always has.
export function startLinks(handlers) {
  api = handlers;
  addEventListener('popstate', onPop);
  const to = parse(location.hash);
  if (to.page) follow(to, false);
  else { scrollTo(0, 0); if (location.hash) write('replaceState', ''); }
  // after the link is under way (`busy`), or the first call (onScroll calls
  // at once) would name whatever page the browser had scrolled to
  const off = onScroll(track);
  return () => { removeEventListener('popstate', onPop); off(); };
}
