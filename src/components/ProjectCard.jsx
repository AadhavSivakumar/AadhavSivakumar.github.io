import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import LiftCard from './LiftCard';
import { subscribe, getPlaying, getServerPlaying } from '../coverPlayback';
import GlassTag from './GlassTag';

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
// Cards play a LIGHT copy of their cover (`<name>-card.mp4`: twice the card's
// display size, a few seconds, no audio — Oct 6, 14.9 MB of card video down
// to 5.7 MB); the modal still shows the full file, and the shared clock
// (App.jsx / Modal.jsx) carries the playback time across the swap. The build
// fails if a card copy is missing (scripts/copy-static.mjs).
export const cardSrc = src => src.replace(/\.mp4$/i, '-card.mp4');

export function CoverVideo({ src, title, placeholder }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const onScreen = useRef(false);
  const poster = posterFor(src);
  // The page-level pause control (WCAG 2.2.2). A cover plays only when it is
  // both on screen and allowed to — visibility alone decides the fetch, this
  // decides the motion.
  const playing = useSyncExternalStore(subscribe, getPlaying, getServerPlaying);

  // The POSTER waits until the card is within a screen of the viewport. A
  // poster is not lazy: all sixteen (~400 KB) were fetched on arrival, ahead
  // of the hero's own fonts and portrait, for pages several screens down.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near || typeof IntersectionObserver === 'undefined') { if (!near) setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: '100% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen.current = entry.isIntersecting;
        if (entry.isIntersecting && playing) {
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
  }, [playing]);

  // Toggling the control acts on covers that are already on screen; the ones
  // off screen are handled by the observer when they arrive.
  useEffect(() => {
    const el = ref.current;
    if (!el || !onScreen.current) return;
    if (playing) {
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      el.pause();
    }
  }, [playing]);

  // Under reduced motion the cover stays a still frame — no loop, no fetch.
  // A video the browser cannot play (no H.264 in many Linux Chromium builds)
  // falls back to its POSTER, which every .mp4 cover ships beside it; it used
  // to fall straight through to the "Image Not Found" placeholder.
  if (reduceMotion() || failed) {
    return (
      <img
        src={poster}
        alt={title}
        loading="lazy"
        onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
      />
    );
  }

  return (
    <video
      ref={ref}
      src={cardSrc(src)}
      poster={near ? poster : undefined}
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

  // Small cards carry their first two tags on one line: thirteen of them share
  // one screen now, and the rest are in the modal.
  const tagsToShow = isMajor ? project.tags : project.tags?.slice(0, 2);


  return (
    <LiftCard
      className={`${isMajor ? 'major-project-card' : 'small-project-card'} project-modal-trigger`}
      delay={(index % 3) * 0.09}
      onClick={(e) => onCardClick(e.currentTarget, project, itemType)}
      // React Bits' TiltedCard (see LiftCard): a small card tilts like its demo; a
      // wide major row only a little
      tilt={isMajor ? { amp: 4, scale: 1.015 } : { amp: 12, scale: 1.06 }}
    >
      {media}
      {isMajor ? (
        <div className="project-content">
          <h3>{project.title}</h3>
          <p>{project.cardDescription}</p>
          {/* status first, then the tags, on one line: the card is a short
              sideways row now */}
          <div className="project-tags-container">
            {tagsToShow?.map((tag, i) => <GlassTag key={i}>{tag}</GlassTag>)}
          </div>
        </div>
      ) : (
        <div className="small-project-content">
          <h3>{project.title}</h3>
          {/* One row: status first, then the first two tags. The description
              lives in the modal — thirteen cards share one screen. */}
          <div className="project-tags-container">
            {tagsToShow?.map((tag, i) => <GlassTag key={i}>{tag}</GlassTag>)}
          </div>
        </div>
      )}
    </LiftCard>
  );
}
