import React from 'react';
import LiftCard from './LiftCard';

export default function SkillGroupCard({ group, onCardClick, index = 0 }) {
  const MAX_SKILLS = 8;

  return (
    <LiftCard
      className="skill-group-card project-modal-trigger"
      delay={(index % 3) * 0.09}
      onClick={(e) => onCardClick(e.currentTarget, group, 'skill-group')}
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
    </LiftCard>
  );
}
