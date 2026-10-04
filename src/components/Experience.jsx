import React, { useEffect, useRef, useState } from 'react';
import SectionTitle from './SectionTitle';
import LiftCard from './LiftCard';
import { CoverVideo } from './ProjectCard';
import PageNext from './PageNext';
import { experienceData } from '../data/siteData';
import { badgeByName } from './badgeCards';

import MotionLanyard from './MotionLanyard';

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

// The left column, spanning both rows, holding BOTH badges: the first beside
// the first card, the second hung one card-row lower beside the second (the
// owner: "make the starship id badge align with the starship card… put all
// of the lanyards on the left side"). The badges are motion (Framer Motion)
// components now — see MotionLanyard.jsx; they were a three.js + rapier
// scene in a WebGL canvas.
// the badge's back has one line for tags: take them in order, skipping any
// that would overflow it, rather than cutting one off with an ellipsis
const fitTags = (tags = [], max = 26) => tags.reduce((out, t) => {
  const len = out.join(' · ').length + (out.length ? 3 : 0) + t.length;
  return out.length < 3 && len <= max ? [...out, t] : out;
}, []);

function RowLanyard({ rows, wide }) {
  const ref = useRef(null);
  const near = useNearViewport(ref);
  // each badge carries its row's DATES (the owner: "just have the dates on
  // the ID cards" — they came off the cards)
  const cards = rows.map(r => badgeByName[r.badge] && { ...badgeByName[r.badge], period: r.period,
    // the back of the badge: what a flip is for
    back: { org: r.org, role: r.role, degree: r.degree, location: r.location, tags: fitTags(r.tags) } }).filter(Boolean);
  // one card row + the grid gap, in px: how far below the first badge the
  // second hangs, so each is level with its own card
  const [rowPx, setRowPx] = useState(0);
  useEffect(() => {
    const grid = ref.current && ref.current.parentElement;
    const measure = () => { const c = grid && grid.querySelectorAll('.exp-card'); if (c && c.length > 1) setRowPx(c[1].getBoundingClientRect().top - c[0].getBoundingClientRect().top); };
    measure(); window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  if (!cards.length) return null;
  return (
    <div ref={ref} className="exp-lanyard exp-lanyard--pair">
      {wide && near && rowPx > 0 && <MotionLanyard cards={cards} rowPx={rowPx} />}
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
            {item.tags.slice(0, item.video ? SHOWN_TAGS_MEDIA : SHOWN_TAGS).map((t, i) => <span key={i} className="project-tag">{t}</span>)}
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
