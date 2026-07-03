import React from 'react';
import LiftCard from './LiftCard';

export default function ProjectCard({ project, isMajor, itemType, onCardClick, index = 0 }) {
  const isMp4 = project.imageUrl?.toLowerCase().endsWith('.mp4');
  const isGif = !isMp4 && project.imageUrl?.toLowerCase().endsWith('.gif');
  const placeholder = isMajor
    ? 'https://placehold.co/600x400/F7F5F2/BFA181?text=Image+Not+Found'
    : 'https://placehold.co/400x400/F7F5F2/BFA181?text=Image';

  let media;
  if (isMp4) {
    media = <video src={project.imageUrl} autoPlay loop muted playsInline />;
  } else {
    media = (
      <img
        src={project.imageUrl}
        alt={project.title}
        className={isGif ? 'is-gif' : ''}
        loading="lazy"
        onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
      />
    );
  }

  const tagsToShow = isMajor ? project.tags : project.tags?.slice(0, 3);
  const hasMoreTags = !isMajor && project.tags?.length > 3;
  const statusClass = project.status?.toLowerCase().replace(/ /g, '-');

  let cardDesc = '';
  if (!isMajor && project.modalContent?.[0]?.type === 'text') {
    const text = project.modalContent[0].value;
    cardDesc = text.substring(0, 70) + (text.length > 70 ? '...' : '');
  }

  return (
    <LiftCard
      className={`${isMajor ? 'major-project-card' : 'small-project-card'} project-modal-trigger`}
      delay={(index % 3) * 0.09}
      onClick={(e) => onCardClick(e.currentTarget, project, itemType)}
    >
      {media}
      {isMajor ? (
        <div className="project-content">
          <h4>{project.title}</h4>
          <p>{project.cardDescription}</p>
          {tagsToShow?.length > 0 && (
            <div className="project-tags-container">
              {tagsToShow.map((tag, i) => <span key={i} className="project-tag">{tag}</span>)}
            </div>
          )}
          {project.status && (
            <div className="project-status-container">
              <span className={`project-tag status-${statusClass}`}>{project.status}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="small-project-content">
          <h4>{project.title}</h4>
          <p>{cardDesc}</p>
          {tagsToShow?.length > 0 && (
            <div className="project-tags-container">
              {tagsToShow.map((tag, i) => <span key={i} className="project-tag">{tag}</span>)}
              {hasMoreTags && <span className="project-tag">...</span>}
            </div>
          )}
          {project.status && (
            <div className="project-status-container">
              <span className={`project-tag status-${statusClass}`}>{project.status}</span>
            </div>
          )}
        </div>
      )}
    </LiftCard>
  );
}
