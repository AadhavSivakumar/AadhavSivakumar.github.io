import React from 'react';
import useScrollReveal from '../hooks/useScrollReveal';
import { resumeDocsData } from '../data/siteData';

// The resume, extended CV and transcripts as a row of compact tiles at the
// foot of the Skills & Resume page. They were a page of their own — four
// 180px tiles on an otherwise empty screen — until the owner merged the two.
// Each opens its Google Drive preview in the shared modal (`itemType`
// 'resume' picks the modal's iframe layout).
const DocIcon = () => (
  <svg className="doc-tile-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

function DocTile({ doc, index, onOpen }) {
  const ref = useScrollReveal({ y: 16, delay: index * 0.06, duration: 450, amount: 0.3 });
  return (
    <button ref={ref} className="doc-tile doc-tile--compact project-modal-trigger" onClick={(e) => onOpen(e, doc)}>
      <DocIcon />
      <span className="doc-tile-label">{doc.title}</span>
      {doc.badge && <span className="doc-tile-badge">{doc.badge}</span>}
    </button>
  );
}

export default function DocStrip({ onCardClick }) {
  const openDoc = (e, doc) => {
    onCardClick(e.currentTarget, {
      id: doc.id,
      title: doc.title,
      modalContent: [{ type: 'embed', value: doc.embedUrl, title: doc.title }],
    }, 'resume');
  };
  return (
    <div className="docs-strip" role="group" aria-label="Resume and documents">
      <span className="docs-strip-lead">Documents</span>
      {resumeDocsData.map((doc, i) => (
        <DocTile key={doc.id} doc={doc} index={i} onOpen={openDoc} />
      ))}
    </div>
  );
}
