import React, { Suspense, lazy, useEffect, useState } from 'react';
import LiftCard from './LiftCard';
import AboutFlourish from './AboutFlourish';
import { aboutMeData } from '../data/siteData';
import dhsImg from '../../Media/lanyardimgs/DHS.jpg';
import ucscImg from '../../Media/lanyardimgs/UCSC.png';
import nyuImg from '../../Media/lanyardimgs/NYU.jpg';
import roboflowImg from '../../Media/lanyardimgs/Roboflow.png';
import starshipImg from '../../Media/lanyardimgs/Starship.jpg';
import researcherImg from '../../Media/lanyardimgs/Researcher.jpg';

// Lazy-loaded so the three.js/rapier bundle and card model are only
// downloaded on wide screens — mobile gets just the about card.
const Lanyard = lazy(() => import('./Lanyard/Lanyard'));

// Badge content mirrors the hanging badges on the live /portfolio page:
// education on the left of the about card, work on the right. `slot` 0 is
// the badge closest to the card on each side.
const badgeCards = [
  { side: 'left', slot: 2, image: dhsImg, badge: { name: 'Dublin High', role: 'High School', id: '2016-2020', exp: '2020' } },
  { side: 'left', slot: 1, image: ucscImg, badge: { name: 'UCSC', role: 'Undergraduate', id: '2020-2024', exp: '2024' } },
  { side: 'left', slot: 0, image: nyuImg, badge: { name: 'NYU', role: 'Graduate', id: '2024-2026', exp: '2026' } },
  { side: 'right', slot: 0, image: roboflowImg, badge: { name: 'Roboflow', role: 'Field Engineer', id: 'Universe', exp: '???' } },
  { side: 'right', slot: 1, image: starshipImg, badge: { name: 'Starship', role: 'Robot Technician', id: 'Technician', exp: '2025' } },
  { side: 'right', slot: 2, image: researcherImg, badge: { name: 'Researcher', role: 'TML @ UCSC, CREO @ NYU', id: 'Research', exp: '2024/6' } },
];

export default function About({ onCardClick }) {
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 992);

  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth >= 992);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <section id="about" style={{ padding: '30px 5% 30px 5%' }}>
      {/* Full-height decorative layer: the two anime.js flourishes travel down
          this layer (following the screen) and morph as the section scrolls. */}
      {isWide && (
        <div className="about-flourish-layer" aria-hidden="true">
          <AboutFlourish side="left" />
          <AboutFlourish side="right" />
        </div>
      )}

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
              onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/480x420/F7F5F2/BFA181?text=Image+Not+Found'; }}
            />
            <div className="project-content">
              <h4>{aboutMeData.cardTitle}</h4>
              <p>{aboutMeData.cardTeaser}</p>
            </div>
          </LiftCard>
        </div>
      </div>

      {/* The 3D lanyards span their own full-width horizontal strip below the
          card. `spreadStep` groups the badges at a fixed spacing near the
          center (education left / work right) instead of stretching them out
          to the viewport edges. */}
      {isWide && (
        <div className="about-lanyard-strip">
          <Suspense fallback={null}>
            <Lanyard
              position={[0, 0, 30]}
              gravity={[0, -40, 0]}
              cards={badgeCards}
              clearCenterPx={0}
              spreadStep={2.2}
              lanyardWidth={0.35}
            />
          </Suspense>
        </div>
      )}
    </section>
  );
}
