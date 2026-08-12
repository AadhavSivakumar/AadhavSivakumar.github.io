import React, { useEffect, useRef, useState } from 'react';
import LiftCard from './LiftCard';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Every .mp4 cover in Media/web/projects ships a `<name>-poster.webp` beside
// it (see siteData.js). The poster is what the card actually costs until the
// card scrolls into view: the video itself is preload="none" and only starts
// fetching when we call play().
const posterFor = (src) => src.replace(/\.(mp4|webm)$/i, '-poster.webp');

// Autoplaying every cover on mount used to fetch several MB of video for cards
// far below the fold — <video> has no `loading="lazy"` equivalent, so playback
// has to be driven manually.
function CoverVideo({ src, title, placeholder }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const poster = posterFor(src);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const p = el.play();
          if (p && p.catch) p.catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Under reduced motion the cover stays a still frame — no loop, no fetch.
  if (reduceMotion() || failed) {
    return (
      <img
        src={failed ? placeholder : poster}
        alt={title}
        loading="lazy"
        onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
      />
    );
  }

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      preload="none"
      loop
      muted
      playsInline
      onError={() => setFailed(true)}
    />
  );
}

export default function ProjectCard({ project, isMajor, itemType, onCardClick, index = 0 }) {
  const isMp4 = project.imageUrl?.toLowerCase().endsWith('.mp4');
  const isGif = !isMp4 && project.imageUrl?.toLowerCase().endsWith('.gif');
  const placeholder = isMajor
    ? 'https://placehold.co/600x400/F7F5F2/BFA181?text=Image+Not+Found'
    : 'https://placehold.co/400x400/F7F5F2/BFA181?text=Image';

  let media;
  if (isMp4) {
    media = <CoverVideo src={project.imageUrl} title={project.title} placeholder={placeholder} />;
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
    // Trim back to a word boundary — a raw substring(0, 70) cut mid-word.
    cardDesc = text.length > 70
      ? text.slice(0, 70).replace(/\s+\S*$/, '') + '…'
      : text;
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
