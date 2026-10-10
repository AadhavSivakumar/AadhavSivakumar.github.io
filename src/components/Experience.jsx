import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { isOpened, whenOpened } from '../opening';
import SectionTitle from './SectionTitle';
import LiftCard from './LiftCard';
import { CoverVideo } from './ProjectCard';
import PageNext from './PageNext';
import { experienceData } from '../data/siteData';
import { badgeByName } from './badgeCards';

import MotionLanyard from './MotionLanyard';
import ErrorBoundary from './ErrorBoundary';
import GlassTag from './GlassTag';

// React Bits' 3D lanyard (three.js + rapier), back since Oct 9 (the owner:
// "can you use the reactbits lanyards?"). Lazy, so a phone never downloads it.
const Lanyard = lazy(() => import('./Lanyard/Lanyard'));

// One PAGE of experience: two organisations, each a card with its lanyard
// badge hanging beside it, the pair sized to fit one screen. Rendered twice
// from App.jsx — group 'industry' (Roboflow, Starship) as Experience and
// group 'research' (NYU, UCSC) as Research.
//
// The card is a teaser: role, organisation, period, the summary and the first
// two highlights, each clamped. The whole entry — every bullet and tag —
// opens in the shared modal, which is what the owner originally asked for ("one
// big modal box for Roboflow with the lanyard next to it"). Content lives in
// siteData.experienceData and is written for a public page (see the note there).

function useIsWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 992);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 992);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
}

// Mount a row's canvas only once the row is within a screen of the viewport.
// Four WebGL contexts created on page load would be paid for by everyone,
// including people who never scroll this far.
function useNearViewport(ref, margin = '600px') {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near, margin]);
  return near;
}

// Does this browser have WebGL at all? Where it does not, the badges are the
// motion ones (MotionLanyard.jsx) and the 3D chunk is never fetched. This
// used to CREATE a WebGL context to find out — a whole context, made and
// thrown away (and, until Oct 9, never released), 360 ms of the main thread
// in the software-GPU harness. A browser that has the API but cannot make a
// context (a blocklisted driver, headless Firefox here) is caught by the
// ErrorBoundary below when the renderer fails, and gets the same badges.
let webglOK = null;
const canWebGL = () => {
  if (webglOK === null) webglOK = typeof window !== 'undefined' && ('WebGL2RenderingContext' in window || 'WebGLRenderingContext' in window);
  return webglOK;
};

// The left column, spanning both rows, holding BOTH badges: the first beside
// the first card, the second hung one card-row lower beside the second (the
// owner: "make the starship id badge align with the starship card… put all
// of the lanyards on the left side"). ONE canvas for both, because the
// canvas HEIGHT sets a 3D badge's size.
function RowLanyard({ rows, wide }) {
  const ref = useRef(null);
  // "near" is true on arrival (this page starts just under the hero), and
  // building the 3D badges — a WebGL renderer, its shaders, the physics —
  // took seconds of the main thread in the middle of the hero's entrance;
  // they hang once the opening is over, or as soon as the reader scrolls
  const near = useNearViewport(ref);
  const [opened, setOpened] = useState(isOpened);
  useEffect(() => whenOpened(() => setOpened(true)), []);
  // the front prints the name and a year (badgeCards.js); the BACK, what a
  // flip is for, the row's role, the exact dates and a QR code to the
  // organisation's site
  const cards = useMemo(() => rows.map(r => { const c = badgeByName[r.badge]; return c && { ...c, back: { role: r.role, dates: c.badge.dates, site: c.badge.site, siteLabel: c.badge.siteLabel } }; }).filter(Boolean), [rows]);
  // one card row + the grid gap, in px: how far below the first badge the
  // second hangs, so each is level with its own card
  const [rowPx, setRowPx] = useState(0);
  useEffect(() => {
    const grid = ref.current && ref.current.parentElement;
    const measure = () => { const c = grid && grid.querySelectorAll('.exp-card'); if (c && c.length > 1) setRowPx(c[1].getBoundingClientRect().top - c[0].getBoundingClientRect().top); };
    measure(); window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  // a context LOST later (the GPU process resets, too many contexts) is not
  // an exception, so the error boundary never sees it; watch the canvas
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if (!wide || !near || !opened) return undefined;
    let canvas = null;
    const onLost = () => setLost(true);
    const t = setInterval(() => {
      canvas = ref.current && ref.current.querySelector('canvas');
      if (canvas) { canvas.addEventListener('webglcontextlost', onLost); clearInterval(t); }
    }, 500);
    return () => { clearInterval(t); if (canvas) canvas.removeEventListener('webglcontextlost', onLost); };
  }, [wide, near, opened]);
  const placed = useMemo(() => cards.map((c, i) => ({ ...c, side: 'center', slot: 0, dropPx: i * rowPx - 45 })), [cards, rowPx]);
  if (!cards.length) return null;
  const flat = lost || (wide && near && opened ? !canWebGL() : webglOK === false);
  const motionBadges = <MotionLanyard cards={cards} rowPx={rowPx} />;
  return (
    <div ref={ref} className={`exp-lanyard exp-lanyard--pair${flat ? '' : ' exp-lanyard--3d'}`} aria-hidden={flat ? undefined : 'true'}>
      {wide && near && opened && rowPx > 0 && (flat ? motionBadges : (
        // The boundary sits OUTSIDE the Suspense so it catches both a WebGL
        // context that cannot be created and a failed fetch of the lazy chunk.
        <ErrorBoundary label="Lanyard" fallback={motionBadges}>
          <Suspense fallback={null}>
            <Lanyard position={[0, 0, 30]} gravity={[0, -40, 0]} cards={placed} clearCenterPx={0} sizeMul={1.1} lanyardWidth={0.32} />
          </Suspense>
        </ErrorBoundary>
      ))}
    </div>
  );
}

// What the modal shows: everything, in reading order.
const toModal = item => ({
  id: item.id,
  title: item.role,
  imageUrl: item.video,             // the card's video is the modal's top media (and flies into it)
  gallery: item.gallery,            // more footage, after it, in the modal's gallery strip
  modalContent: [
    { type: 'meta', value: [item.org, item.location, item.period].filter(Boolean).join('  ·  ') },
    item.degree && { type: 'meta', value: item.degree },
    item.summary && { type: 'text', value: item.summary },
    { type: 'list', items: item.bullets },
    item.tags?.length && { type: 'tags', items: item.tags },
    ...(item.links || []).map(l => ({ type: 'button', text: l.text, link: l.link })),
  ].filter(Boolean),
});

const SHOWN_TAGS = 5;
const SHOWN_TAGS_MEDIA = 3;   // beside a video the tag row is narrower, and it must stay ONE row for the page to fit

// Each card carries a VIDEO beside its text (the owner: "have a video for the
// Roboflow card, the Starship card, the NYU card and the UCSC card"): the
// same lazy, poster-first, pause-control-aware <video> the project covers
// use. `item.video` is a root-relative .mp4 with a `-poster.webp` beside it.
function ExperienceCard({ item, index, onCardClick }) {
  return (
    <LiftCard
      className={`exp-card exp-card--${index}${item.video ? ' exp-card--media' : ''} project-modal-trigger`}
      delay={index * 0.08}
      onClick={(e) => onCardClick(e.currentTarget, toModal(item), 'experience')}
      data-link={item.id.replace(/^exp-/, '')}   // its modal's URL: #experience/roboflow (deepLink.js)
      tilt={{ amp: 3, scale: 1.012 }}
    >
     <div className="exp-body">
      {/* A <div>, not a <header>: App.css styles the bare `header` element as
          the fixed site header (position: fixed; top: 0), so a <header> inside
          a card is torn out of it and pinned to the top of the page. */}
      <div className="exp-head">
        <div>
          <h3 className="exp-role">{item.role}</h3>
          <p className="exp-org">
            <span className="exp-org-name">{item.org}</span>
            {item.location && <span className="exp-sep" aria-hidden="true">·</span>}
            {item.location && <span className="exp-loc">{item.location}</span>}
          </p>
          {item.degree && <p className="exp-degree">{item.degree}</p>}
        </div>
      </div>
      {/* the card is a short PARAGRAPH; every bullet is in the modal (the
          owner: "on the cards… have a small paragraph and have the bullet
          points show up in the modal") */}
      {item.summary && <p className="exp-summary">{item.summary}</p>}
      <div className="exp-foot">
        {item.tags?.length > 0 && (
          <div className="project-tags-container exp-tags">
            {item.tags.slice(0, item.video ? SHOWN_TAGS_MEDIA : SHOWN_TAGS).map((t, i) => <GlassTag key={i}>{t}</GlassTag>)}
          </div>
        )}
        <span className="exp-more">
          {/* the owner, Oct 4: "click to learn more" instead of a highlights count */}
          Learn more
          <span aria-hidden="true"> →</span>
        </span>
      </div>
     </div>
      {item.video && (
        <div className="exp-media" aria-hidden="true">
          <CoverVideo src={item.video} title={item.org} placeholder="" />
        </div>
      )}
    </LiftCard>
  );
}

export default function Experience({ id, title, group, onCardClick, next }) {
  const wide = useIsWide();
  const rows = experienceData.filter(e => e.group === group);
  return (
    <section id={id} className="page page--wide exp-page" aria-labelledby={`${id}-title`}>
      <SectionTitle id={`${id}-title`}>{title}</SectionTitle>
      {/* The cards stack in the middle column and the badges ZIG-ZAG: the
          first hangs on the right beside the first card, the second on the
          left beside the second. Each canvas spans both rows in a column of
          its own, so it can be taller than either row (460-600px; the height
          IS the badge size — see .exp-lanyard) while two rows share one
          screen. */}
      <div className="exp-grid">
        {rows.map((item, i) => <ExperienceCard key={item.id} item={item} index={i} onCardClick={onCardClick} />)}
        <RowLanyard rows={rows} wide={wide} />
      </div>
      {next && <PageNext to={next.to} label={next.label} />}
    </section>
  );
}
