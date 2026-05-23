import React from 'react';
import { resumeData } from '../data/siteData';
import { useInView } from '../hooks/useInView';

export default function Resume({ onCardClick }) {
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
    <section id="resume" ref={sectionRef} className={sectionInView ? 'visible' : ''}>
      <h2 className="section-title">My Résumé</h2>
      <p>Explore my professional experience, skills, and qualifications in detail. Click the card below to view my resume.</p>
      <div className="major-projects-grid" style={{ maxWidth: '410px', margin: '40px auto 0' }}>
        <div
          ref={cardRef}
          className={`major-project-card project-modal-trigger ${cardInView ? 'in-view' : ''}`}
          onClick={(e) => onCardClick(e.currentTarget, resumeData, 'resume')}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <img
            src={resumeData.imageUrl}
            alt={resumeData.title}
            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/F7F5F2/BFA181?text=R%C3%A9sum%C3%A9'; }}
          />
          <div className="project-content">
            <h4>{resumeData.title}</h4>
            <p>{resumeData.cardDescription}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
