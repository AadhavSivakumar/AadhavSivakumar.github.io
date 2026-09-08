import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';
import ErrorBoundary from './ErrorBoundary';
import useScrollReveal from '../hooks/useScrollReveal';
import { experienceData } from '../data/siteData';
import { badgeByName } from './badgeCards';

// The three.js / rapier stack is lazy so a phone never downloads it — same
// arrangement the About section used before the badges moved here.
const Lanyard = lazy(() => import('./Lanyard/Lanyard'));

// Work and research history: one row per organisation, a big card on the left
// and that organisation's lanyard badge hanging in a small 3D canvas on the
// right. Content lives in siteData.experienceData and is written for a public
// page (see the note there).

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
// including people who never scroll this far; this way each is created as it
// comes into reach and kept from then on.
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

function RowLanyard({ badgeName, wide }) {
  const ref = useRef(null);
  const near = useNearViewport(ref);
  const card = badgeByName[badgeName];
  if (!card) return null;
  return (
    <div ref={ref} className="exp-lanyard" aria-hidden="true">
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

function ExperienceCard({ item, index }) {
  const ref = useScrollReveal({ y: 30, delay: index * 0.08, duration: 650, amount: 0.15 });
  return (
    <article ref={ref} className="exp-card" aria-labelledby={`${item.id}-role`}>
      {/* A <div>, not a <header>: App.css styles the bare `header` element as
          the fixed site header (position: fixed; top: 0), so a <header> inside
          a card is torn out of it and pinned to the top of the page. */}
      <div className="exp-head">
        <div>
          <h3 id={`${item.id}-role`} className="exp-role">{item.role}</h3>
          <p className="exp-org">
            <span className="exp-org-name">{item.org}</span>
            {item.location && <span className="exp-sep" aria-hidden="true">·</span>}
            {item.location && <span className="exp-loc">{item.location}</span>}
          </p>
        </div>
        <p className="exp-period">{item.period}</p>
      </div>
      {item.summary && <p className="exp-summary">{item.summary}</p>}
      <ul className="exp-bullets">
        {item.bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {item.tags?.length > 0 && (
        <div className="project-tags-container exp-tags">
          {item.tags.map((t, i) => <span key={i} className="project-tag">{t}</span>)}
        </div>
      )}
    </article>
  );
}

export default function Experience() {
  const wide = useIsWide();
  return (
    <section id="experience" aria-labelledby="experience-title">
      <SectionTitle id="experience-title">Experience</SectionTitle>
      <Reveal delay={0.1}>
        <p className="exp-intro">
          Edge AI engineer bridging industrial machine vision and robot learning — production
          vision systems on NVIDIA Jetson at manufacturing sites, and research pipelines from
          teleoperation hardware through vision-language-action policy fine-tuning.
        </p>
      </Reveal>
      <div className="exp-list">
        {experienceData.map((item, i) => (
          <div className="exp-row" key={item.id}>
            <ExperienceCard item={item} index={i} />
            <RowLanyard badgeName={item.badge} wide={wide} />
          </div>
        ))}
      </div>
    </section>
  );
}
