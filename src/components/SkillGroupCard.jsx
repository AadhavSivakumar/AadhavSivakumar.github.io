import React from 'react';
import { useInView } from '../hooks/useInView';

export default function SkillGroupCard({ group, onCardClick }) {
  const [ref, inView] = useInView();
  const MAX_SKILLS = 8;

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
    <div
      ref={ref}
      className={`skill-group-card project-modal-trigger ${inView ? 'in-view' : ''}`}
      onClick={(e) => onCardClick(e.currentTarget, group, 'skill-group')}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="skill-group-card-image-wrapper">
        <div
          role="img"
          aria-label={`${group.title} icon`}
          className="skill-group-card-image"
          style={{
            WebkitMaskImage: `url(${group.cardImageUrl})`,
            maskImage: `url(${group.cardImageUrl})`
          }}
        />
      </div>
      <h4 className="skill-group-card-title">{group.title}</h4>
      <div className="skill-group-card-tags-container">
        {group.items.slice(0, MAX_SKILLS).map((skill, i) => (
          <span key={i} className="project-tag">{skill.name}</span>
        ))}
      </div>
      {group.items.length > MAX_SKILLS && (
        <p className="skill-group-more-info">...and {group.items.length - MAX_SKILLS} more</p>
      )}
    </div>
  );
}
