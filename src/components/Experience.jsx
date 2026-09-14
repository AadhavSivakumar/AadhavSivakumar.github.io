import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import SectionTitle from './SectionTitle';
import ErrorBoundary from './ErrorBoundary';
import LiftCard from './LiftCard';
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

function RowLanyard({ badgeName, wide, index }) {
  const ref = useRef(null);
  const near = useNearViewport(ref);
  const card = badgeByName[badgeName];
  if (!card) return null;
  return (
    <div ref={ref} className={`exp-lanyard exp-lanyard--${index}`} aria-hidden="true">
      {wide && near && (
        // The boundary sits OUTSIDE the Suspense so it catches both a WebGL
        // context that cannot be created and a failed fetch of the lazy chunk.
        <ErrorBoundary label={`Lanyard (${badgeName})`}>
          <Suspense fallback={null}>
            <Lanyard
              position={[0, 0, 30]}
              gravity={[0, -40, 0]}
              cards={[{ ...card, side: 'center', slot: 0 }]}
              clearCenterPx={0}
              sizeMul={1.6}
              lanyardWidth={0.5}
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

function ExperienceCard({ item, index, onCardClick }) {
  const more = item.bullets.length - SHOWN;
  return (
    <LiftCard
      className={`exp-card exp-card--${index} project-modal-trigger`}
      delay={index * 0.08}
      onClick={(e) => onCardClick(e.currentTarget, toModal(item), 'experience')}
    >
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
            {item.tags.slice(0, SHOWN_TAGS).map((t, i) => <span key={i} className="project-tag">{t}</span>)}
          </div>
        )}
        <span className="exp-more">
          {more > 0 ? `+${more} more highlight${more > 1 ? 's' : ''}` : 'Details'}
          <span aria-hidden="true"> →</span>
        </span>
      </div>
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
          left beside the second. That lets each lanyard canvas keep its full
          460px height — the height its composition and drag clamp were tuned
          and tested at — while two rows share one screen: each canvas spans
          both rows, in a column of its own. */}
      <div className="exp-grid">
        {rows.map((item, i) => (
          <React.Fragment key={item.id}>
            <ExperienceCard item={item} index={i} onCardClick={onCardClick} />
            <RowLanyard badgeName={item.badge} wide={wide} index={i} />
          </React.Fragment>
        ))}
      </div>
      {next && <PageNext to={next.to} label={next.label} />}
    </section>
  );
}
