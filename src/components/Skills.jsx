import React, { useEffect, useRef, useState } from 'react';
import SectionTitle from './SectionTitle';
import PageNext from './PageNext';
import useScrollReveal from '../hooks/useScrollReveal';
import { skillGroupsData, resumeDocsData } from '../data/siteData';

// The RESUME page (the owner: "just make it resume section. The resume should
// take up most of the space and the skills should be minor in comparison").
// The resume itself fills most of the page — its live Google Drive preview,
// with a tab for the extended CV — and beside it, small, the transcripts and
// the skill groups as chips. Everything opens in the shared modal. The
// section keeps its id, `skills`, because the art's acts, the settle and the
// nav are keyed on it.
//
// The preview is COVERED by a button: a cross-origin iframe swallows the
// wheel, so the page could not be scrolled past it, and a click opens the
// document full size instead. It is only mounted once the page is near, so
// the Drive viewer is not fetched on load.
const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export default function Skills({ onCardClick, next }) {
  const docs = resumeDocsData.filter(d => d.id === 'doc-resume' || d.id === 'doc-cv');
  const transcripts = resumeDocsData.filter(d => !docs.includes(d));
  const [tab, setTab] = useState(0);
  const [near, setNear] = useState(false);
  const pageRef = useRef(null);
  const viewerRef = useScrollReveal({ y: 20, duration: 500, amount: 0.2 });
  const sideRef = useScrollReveal({ y: 20, delay: 0.1, duration: 500, amount: 0.2 });
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const openDoc = (el, doc) => onCardClick(el, {
    id: doc.id,
    title: doc.title,
    modalContent: [{ type: 'embed', value: doc.embedUrl, title: doc.title }],
  }, 'resume');
  const doc = docs[tab] || docs[0];
  return (
    <section id="skills" ref={pageRef} className="page page--wide resume-page" aria-labelledby="skills-title">
      <SectionTitle id="skills-title">Resume</SectionTitle>
      <div className="resume-layout">
        <div className="resume-viewer" ref={viewerRef}>
          <div className="resume-tabs" role="tablist" aria-label="Documents">
            {docs.map((d, i) => (
              <button key={d.id} role="tab" aria-selected={i === tab} className={`resume-tab${i === tab ? ' is-on' : ''}`} onClick={() => setTab(i)}>{d.title}</button>
            ))}
            <button className="resume-open" onClick={e => openDoc(e.currentTarget.closest('.resume-viewer'), doc)}>Open full size ↗</button>
          </div>
          <div className="resume-frame">
            {near && <iframe key={doc.id} src={doc.embedUrl} title={doc.title} loading="lazy" tabIndex={-1} />}
            <button className="resume-cover" aria-label={`Open the ${doc.title} full size`} onClick={e => openDoc(e.currentTarget.closest('.resume-viewer'), doc)} />
          </div>
        </div>
        <aside className="resume-side" ref={sideRef}>
          <h3 className="resume-side-title">Transcripts</h3>
          {transcripts.map(d => (
            <button key={d.id} className="resume-doc project-modal-trigger" onClick={e => openDoc(e.currentTarget, d)}>
              <DocIcon /><span>{d.title}</span>{d.badge && <span className="doc-tile-badge">{d.badge}</span>}
            </button>
          ))}
          <h3 className="resume-side-title">Skills</h3>
          <div className="skill-chips">
            {skillGroupsData.map(g => (
              <button key={g.id} className="skill-chip project-modal-trigger" onClick={e => onCardClick(e.currentTarget, g, 'skill-group')}>
                <i style={{ WebkitMaskImage: `url(${g.cardImageUrl})`, maskImage: `url(${g.cardImageUrl})` }} aria-hidden="true" />
                {g.title}
              </button>
            ))}
          </div>
        </aside>
      </div>
      {next && <PageNext to={next.to} label={next.label} />}
    </section>
  );
}
