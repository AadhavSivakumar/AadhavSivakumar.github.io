import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import SectionTitle from './SectionTitle';
import ErrorBoundary from './ErrorBoundary';
import LiftCard from './LiftCard';
import { CoverVideo } from './ProjectCard';
import PageNext from './PageNext';
import { experienceData } from '../data/siteData';
import { badgeByName } from './badgeCards';

// The three.js / rapier stack is lazy so a phone never downloads it.
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

// Can this browser make a WebGL context at all? Checked once. Where it cannot
// (GPU blocklisted, hardware acceleration off, a remote session) the 3D badge
// used to render NOTHING — the error boundary's fallback was null — and the
// owner reported "I can no longer see the lanyards". Now the badge is drawn
// flat instead (BadgeFallback), so it is never silently missing.
let webglOK = null;
const canWebGL = () => {
  if (webglOK !== null) return webglOK;
  try { const c = document.createElement('canvas'); webglOK = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { webglOK = false; }
  return webglOK;
};

// The flat badge: the same card, photo, name, role, ID and EXP, on a strap.
function BadgeFallback({ card }) {
  const b = card.badge;
  return (
    <div className="badge-flat">
      <span className="badge-flat__strap" />
      <div className="badge-flat__card">
        <img src={card.image} alt="" className="badge-flat__photo" />
        <strong className="badge-flat__name">{b.name}</strong>
        <span className="badge-flat__role">{b.role}</span>
        <span className="badge-flat__meta"><b>ID</b> {b.id}<br /><b>EXP</b> {b.exp}</span>
      </div>
    </div>
  );
}

// ONE canvas in the left column, spanning both rows, holding BOTH badges:
// the first hangs beside the first card, the second is hung one row lower so
// it sits beside the second card (the owner: "make the starship id badge align
// with the starship card… put all of the lanyards on the left side"). One tall
// canvas rather than one per row, because the canvas HEIGHT sets the badge's
// size, and a row-high canvas drew each badge at half its size.
function RowLanyard({ badgeNames, wide }) {
  const ref = useRef(null);
  const near = useNearViewport(ref);
  const [lost, setLost] = useState(false);
  const cards = badgeNames.map(n => badgeByName[n]).filter(Boolean);
  const card = cards[0];
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
  useEffect(() => {
    if (!wide || !near) return undefined;
    let canvas = null;
    const onLost = () => setLost(true);
    const t = setInterval(() => {
      canvas = ref.current && ref.current.querySelector('canvas');
      if (canvas) { canvas.addEventListener('webglcontextlost', onLost); clearInterval(t); }
    }, 500);
    return () => { clearInterval(t); if (canvas) canvas.removeEventListener('webglcontextlost', onLost); };
  }, [wide, near]);
  if (!card) return null;
  const flat = !canWebGL() || lost;
  return (
    <div ref={ref} className="exp-lanyard exp-lanyard--pair" aria-hidden="true">
      {wide && near && flat && cards.map((c, i) => <div key={i} className="badge-flat-slot">{<BadgeFallback card={c} />}</div>)}
      {wide && near && !flat && rowPx > 0 && (
        // The boundary sits OUTSIDE the Suspense so it catches both a WebGL
        // context that cannot be created and a failed fetch of the lazy chunk.
        <ErrorBoundary label={`Lanyard (${badgeNames.join(', ')})`} fallback={cards.map((c, i) => <div key={i} className="badge-flat-slot"><BadgeFallback card={c} /></div>)}>
          <Suspense fallback={null}>
            <Lanyard
              position={[0, 0, 30]}
              gravity={[0, -40, 0]}
              cards={cards.map((c, i) => ({ ...c, side: 'center', slot: 0, dropPx: i * rowPx - 45 }))}
              clearCenterPx={0}
              sizeMul={1.1}
              lanyardWidth={0.32}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}

// What the modal shows: everything, in reading order.
const toModal = item => ({
  id: item.id,
  title: item.role,
  imageUrl: item.video,             // the card's video is the modal's top media (and flies into it)
  modalContent: [
    { type: 'meta', value: [item.org, item.location, item.period].filter(Boolean).join('  ·  ') },
    item.degree && { type: 'meta', value: item.degree },
    item.summary && { type: 'text', value: item.summary },
    { type: 'list', items: item.bullets },
    item.tags?.length && { type: 'tags', items: item.tags },
  ].filter(Boolean),
});

const SHOWN = 2;        // highlights on the card; the rest are in the modal
const SHOWN_TAGS = 5;
const SHOWN_TAGS_MEDIA = 3;   // beside a video the tag row is narrower, and it must stay ONE row for the page to fit

// Each card carries a VIDEO beside its text (the owner: "have a video for the
// Roboflow card, the Starship card, the NYU card and the UCSC card"): the
// same lazy, poster-first, pause-control-aware <video> the project covers
// use. `item.video` is a root-relative .mp4 with a `-poster.webp` beside it.
function ExperienceCard({ item, index, onCardClick }) {
  const more = item.bullets.length - SHOWN;
  return (
    <LiftCard
      className={`exp-card exp-card--${index}${item.video ? ' exp-card--media' : ''} project-modal-trigger`}
      delay={index * 0.08}
      onClick={(e) => onCardClick(e.currentTarget, toModal(item), 'experience')}
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
        <p className="exp-period">{item.period}</p>
      </div>
      {item.summary && <p className="exp-summary">{item.summary}</p>}
      <ul className="exp-bullets">
        {item.bullets.slice(0, SHOWN).map((b, i) => <li key={i}><span>{b}</span></li>)}
      </ul>
      <div className="exp-foot">
        {item.tags?.length > 0 && (
          <div className="project-tags-container exp-tags">
            {item.tags.slice(0, item.video ? SHOWN_TAGS_MEDIA : SHOWN_TAGS).map((t, i) => <span key={i} className="project-tag">{t}</span>)}
          </div>
        )}
        <span className="exp-more">
          {more > 0 ? `+${more} more highlight${more > 1 ? 's' : ''}` : 'Details'}
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
        <RowLanyard badgeNames={rows.map(r => r.badge)} wide={wide} />
      </div>
      {next && <PageNext to={next.to} label={next.label} />}
    </section>
  );
}
