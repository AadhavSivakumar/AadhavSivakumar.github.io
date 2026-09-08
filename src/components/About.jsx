import React from 'react';
import LiftCard from './LiftCard';
import { aboutMeData } from '../data/siteData';

// Just the about card now. The six lanyard badges used to hang in a 3D strip
// under it; they hang beside their own rows in the Experience section instead.
export default function About({ onCardClick }) {
  return (
    <section id="about" aria-labelledby="about-title" style={{ padding: '30px 5% 30px 5%' }}>
      {/* The only section without a visible title — its layout is the card
          floating in the lanyard stage. The heading still has to exist, or the
          section has no accessible name and the outline jumps h1 -> h3. */}
      <h2 id="about-title" className="sr-only">About</h2>
      {/* Top row: the about card, centered. */}
      <div className="about-top">
        <div className="about-card-wrapper">
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
        </div>
      </div>
    </section>
  );
}
