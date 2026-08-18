import React, { Suspense, lazy, useEffect, useState } from 'react';
import LiftCard from './LiftCard';
import ErrorBoundary from './ErrorBoundary';
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
  { side: 'right', slot: 0, image: roboflowImg, badge: { name: 'Roboflow', role: 'Edge AI Engineer', id: 'Universe', exp: 'Present' } },
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

      {/* The 3D lanyards span their own full-width horizontal strip below the
          card. `spreadStep` groups the badges at a fixed spacing near the
          center (education left / work right) instead of stretching them out
          to the viewport edges. */}
      {isWide && (
        <div className="about-lanyard-strip">
          {/* The boundary sits OUTSIDE the Suspense so it catches both ways
              this can fail: the WebGL context that THREE.WebGLRenderer cannot
              create on a machine without a usable GPU, and a failed fetch of
              the lazy chunk. Either one used to unmount the entire page. The
              fallback is the same empty strip mobile already gets. */}
          <ErrorBoundary label="Lanyard">
            <Suspense fallback={null}>
              <Lanyard
                position={[0, 0, 30]}
                gravity={[0, -40, 0]}
                cards={badgeCards}
                clearCenterPx={0}
                sizeMul={1.5}
                lanyardWidth={0.5}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </section>
  );
}
