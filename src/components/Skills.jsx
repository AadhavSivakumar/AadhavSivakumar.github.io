import React, { useEffect, useRef, useState } from 'react';
import SectionTitle from './SectionTitle';
import PageNext from './PageNext';
import StarBorder from './reactbits/StarBorder';
import useScrollReveal from '../hooks/useScrollReveal';
import { skillGroupsData, resumeDocsData } from '../data/siteData';

// The RESUME page (the owner: "just make it resume section. The resume should
// take up most of the space and the skills should be minor in comparison").
// The resume itself fills most of the page — the PDFs from this repo
// (Resume/), shown as page images, with tabs for the extended CV and the two
// transcripts — and beside it, small, the transcripts again (they switch the
// viewer) and the skill groups as chips (each opens the shared modal). The
// section keeps its id, `skills`, because the art's acts, the settle and the
// nav are keyed on it.
// The Resume: one page WITH TEXT on it (a heading bar and lines). The
// Extended CV: the same page with two more cascading behind it. (Oct 6, the
// owner: "a page with text on it… multiple cascading pages".)
const PageWithText = ({ x = 0, y = 0, back = false }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M4 1.5h11l5 5V25a1.5 1.5 0 0 1-1.5 1.5h-14.5A1.5 1.5 0 0 1 2.5 25V3A1.5 1.5 0 0 1 4 1.5z"
      fill={back ? 'var(--surface-color)' : 'var(--surface-color)'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M15 1.5v5h5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    {!back && <>
      <rect x="6" y="8.5" width="7" height="2.2" rx="0.6" fill="currentColor" />
      <path d="M6 14h10M6 17h10M6 20h7.5M6 23h9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />
    </>}
  </g>
);
const ResumeIcon = () => (
  <svg className="resume-bigdoc__icon" viewBox="0 0 30 30" aria-hidden="true"><PageWithText x={3} y={1} /></svg>
);
const CVIcon = () => (
  <svg className="resume-bigdoc__icon" viewBox="0 0 30 30" aria-hidden="true">
    <g opacity="0.45"><PageWithText x={8} y={0} back /></g>
    <g opacity="0.7"><PageWithText x={5} y={1.5} back /></g>
    <PageWithText x={2} y={3} />
  </svg>
);
const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export default function Skills({ onCardClick, next }) {
  const docs = resumeDocsData;
  const transcripts = docs.filter(d => d.id.endsWith('transcript'));
  const [tab, setTabRaw] = useState(0);
  // the viewer shows a DOCUMENT or a SKILL GROUP (Oct 6; the owner: skills
  // "just show up on the left side where the resume is" — no modal)
  const [skill, setSkill] = useState(null);
  const setTab = i => { setSkill(null); setTabRaw(i); };
  const [near, setNear] = useState(false);
  const pageRef = useRef(null);
  const viewerRef = useScrollReveal({ y: 20, duration: 500, amount: 0.2 });
  const sideRef = useScrollReveal({ y: 20, delay: 0.1, duration: 500, amount: 0.2 });
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    // mounted only once the page is actually ON screen and the reader has
    // paused there: the Drive viewer's load is a long main-thread task, and
    // loading it 600px early put it in the middle of the scroll through
    // Additional Projects — frames of 170-200ms, measured
    let t = 0;
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(t);
      if (e.isIntersecting) t = setTimeout(() => { setNear(true); io.disconnect(); }, 450);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);
  const doc = docs[tab] || docs[0];
  return (
    <section id="skills" ref={pageRef} className="page page--wide resume-page" aria-labelledby="skills-title">
      <SectionTitle id="skills-title">Resume</SectionTitle>
      <div className="resume-layout">
        <div className="resume-viewer" ref={viewerRef}>
          {skill ? (
            <div className="resume-frame resume-skills" key={skill.id}>
              <div className="resume-skills__inner" tabIndex={0} aria-label={`${skill.title} skills`}>
                <h3 className="resume-skills__title">
                  <span className="skill-icon-mono resume-skills__head" aria-hidden="true" style={{ WebkitMaskImage: `url(${skill.cardImageUrl})`, maskImage: `url(${skill.cardImageUrl})` }} />
                  {skill.title}
                </h3>
                <div className="resume-skills__grid">
                  {skill.items.map((it, i) => {
                    const mono = /\/icons\/(mdi|simple-icons)--/.test(it.imageUrl);
                    return (
                      <div key={i} className="resume-skill" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                        {mono
                          ? <span role="img" aria-label={it.name} className="resume-skill__icon skill-icon-mono" style={{ WebkitMaskImage: `url(${it.imageUrl})`, maskImage: `url(${it.imageUrl})` }} />
                          : <img src={it.imageUrl} alt="" className="resume-skill__icon" loading="lazy" />}
                        <div>
                          <strong>{it.name}</strong>
                          <p>{it.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
          <div className="resume-frame">
            {/* the PAGES as images (scripts/pdf-previews.mjs), scrolling inside
                the frame: a PDF in an iframe is blank on Android and one page
                on iOS; the PDF itself is behind Open PDF / Download */}
            <div className="resume-pages" key={doc.id} tabIndex={0} aria-label={`${doc.title}, ${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''}`}>
              {doc.pages.map((src, i) => (
                <a key={src} href={doc.embedUrl} target="_blank" rel="noopener noreferrer">
                  <img src={src} alt={i === 0 ? `${doc.title}, page 1` : `page ${i + 1}`} loading={i === 0 && near ? 'eager' : 'lazy'} />
                </a>
              ))}
            </div>
          </div>
          )}
        </div>
        <aside className="resume-side" ref={sideRef}>
          {/* the documents as LARGE buttons in the side column (Oct 6; the
              owner: "have large Resume and Extended CV buttons above
              transcripts, and remove the little navbar above the resume") —
              they switch the viewer, as the transcript buttons do */}
          <div className="resume-bigdocs">
            {docs.filter(d => !d.id.endsWith('transcript')).map(d => (
              <button key={d.id} className={`resume-bigdoc${!skill && docs[tab] === d ? ' is-on' : ''}`} aria-pressed={!skill && docs[tab] === d} onClick={() => setTab(docs.indexOf(d))}>
                {d.id === 'doc-cv' ? <CVIcon /> : <ResumeIcon />}
                <span className="resume-bigdoc__text">
                  <strong>{d.title}</strong>
                  <small>{d.pages.length} page{d.pages.length > 1 ? 's' : ''} · PDF</small>
                </span>
              </button>
            ))}
          </div>
          {/* the shown document's actions (they lived in the removed bar) */}
          <div className="resume-actions">
            <a className="resume-open" href={doc.embedUrl} target="_blank" rel="noopener noreferrer">Open PDF ↗</a>
            {/* React Bits' StarBorder: a light that runs round the primary action's edge */}
            <StarBorder as="a" className="resume-star" href={doc.embedUrl} download color="#D4B47C" speed="5s">Download</StarBorder>
          </div>
          <h3 className="resume-side-title">Transcripts</h3>
          {transcripts.map(d => (
            <button key={d.id} className={`resume-doc${!skill && docs[tab] === d ? ' is-on' : ''}`} aria-pressed={!skill && docs[tab] === d} onClick={() => setTab(docs.indexOf(d))}>
              <DocIcon /><span>{d.title}</span>
            </button>
          ))}
          <h3 className="resume-side-title">Skills</h3>
          <div className="skill-chips">
            {skillGroupsData.map(g => (
              <button key={g.id} className={`skill-chip${skill === g ? ' is-on' : ''}`} aria-pressed={skill === g} onClick={() => setSkill(g)}>
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
