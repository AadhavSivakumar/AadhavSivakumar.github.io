import React from 'react';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';
import useScrollReveal from '../hooks/useScrollReveal';
import { resumeDocsData } from '../data/siteData';

const DocIcon = () => (
  <svg className="doc-tile-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

function DocTile({ doc, index, onOpen }) {
  const ref = useScrollReveal({ y: 30, scale: 0.95, delay: index * 0.09, duration: 550, amount: 0.3 });
  return (
    <button ref={ref} className="doc-tile project-modal-trigger" onClick={(e) => onOpen(e, doc)}>
      {doc.badge && <span className="doc-tile-badge">{doc.badge}</span>}
      <DocIcon />
      <span className="doc-tile-label">{doc.title}</span>
    </button>
  );
}

export default function Resume({ onCardClick }) {
  const openDoc = (e, doc) => {
    onCardClick(e.currentTarget, {
      id: doc.id,
      title: doc.title,
      modalContent: [{ type: 'embed', value: doc.embedUrl, title: doc.title }],
    }, 'resume');
  };

  return (
    <section id="resume">
      <SectionTitle>Resume, CV & Transcripts</SectionTitle>
      <Reveal delay={0.1}>
        <p>
          For a detailed overview of my work experience, education, and professional background,
          please view my resume. For a more comprehensive version, my extended CV is also available.
          You can also view my academic transcripts below.
        </p>
      </Reveal>
      <div className="docs-grid">
        {resumeDocsData.map((doc, i) => (
          <DocTile key={doc.id} doc={doc} index={i} onOpen={openDoc} />
        ))}
      </div>
    </section>
  );
}
