import React from 'react';
import LiftCard from './LiftCard';
import { aboutMeData } from '../data/siteData';

// The about card: portrait, name, a teaser; the full bio opens in the modal.
// It used to be a section of its own right under the hero. It lives in the
// Get In Touch page now (Contact.jsx), at the owner's request — the last page
// is where a reader decides to reach out, and the card is who they would be
// reaching.
export default function AboutCard({ onCardClick }) {
  return (
    <LiftCard
      className="major-project-card project-modal-trigger about-me-card"
      onClick={(e) => onCardClick(e.currentTarget, aboutMeData, 'about')}
    >
      <img
        src={aboutMeData.imageUrl}
        alt="Aadhav Sivakumar"
        width={480}
        height={420}
        loading="lazy"
        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/480x420/F7F5F2/BFA181?text=Image+Not+Found'; }}
      />
      <div className="project-content">
        <h3>{aboutMeData.cardTitle}</h3>
        <p>{aboutMeData.cardTeaser}</p>
      </div>
    </LiftCard>
  );
}
