import React from 'react';
import SineWave from './SineWave';
import { aboutMeData } from '../data/siteData';
import { useInView } from '../hooks/useInView';

export default function About({ onCardClick }) {
  const [sectionRef, sectionInView] = useInView();
  const [cardRef, cardInView] = useInView();

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const maxRotate = 8;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const rotateX = ((mouseY - rect.height / 2) / (rect.height / 2)) * -maxRotate;
    const rotateY = ((mouseX - rect.width / 2) / (rect.width / 2)) * maxRotate;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.transform = '';
  };

  return (
    <section id="about" ref={sectionRef} className={sectionInView ? 'visible' : ''} style={{ padding: '30px 5% 30px 5%' }}>
      <div className="about-card-wrapper">
        <SineWave isLeft={true} />
        <div
          className={`major-project-card project-modal-trigger about-me-card ${cardInView ? 'in-view' : ''}`}
          ref={cardRef}
          onClick={(e) => onCardClick(e.currentTarget, aboutMeData, 'about')}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
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
        </div>
        <SineWave isLeft={false} />
      </div>
    </section>
  );
}
