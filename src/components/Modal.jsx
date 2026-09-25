import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';

const EXPAND_EASE = [0.22, 1, 0.36, 1];

// Content population: children stagger in once the modal is fully expanded,
// and stagger back out (quickly, in reverse) before it collapses.
const contentContainer = {
  hidden: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.28 } },   // starts while the surface is still growing, as the card copy fades
};
const contentItem = {
  hidden: { opacity: 0, y: 12, transition: { duration: 0.16, ease: 'easeIn' } },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EXPAND_EASE } },
};

function finalRect() {
  const width = Math.min(1280, window.innerWidth * 0.9);
  const height = Math.min(window.innerHeight * 0.9, 1080);
  return {
    top: (window.innerHeight - height) / 2,
    left: (window.innerWidth - width) / 2,
    width,
    height,
  };
}

// Open: lift (card rises off the page) -> expand (grows to modal size)
// -> open (content staggers in). Close runs the same steps in reverse:
// departing (content staggers out) -> collapse (shrinks back to the card)
// -> settle (drops back onto the page and hands off to the real card).
export default function Modal({ isOpen, itemData, itemType, cardRect, cardHTML, cardClass, onLanding, onClose }) {
  const [phase, setPhase] = useState('closed');
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  // Move focus INTO the dialog once it is open. Until this, focus stayed on
  // <body> (the trigger card gets visibility:hidden while the modal is up), so
  // a screen reader or keyboard user was never taken to the content at all.
  useEffect(() => {
    if (phase !== 'open') return;
    closeRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // Keep Tab inside the dialog. Without it, tabbing walks straight out into the
  // page behind the backdrop, which is still fully interactive.
  const trapTab = useCallback(e => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const items = [...root.querySelectorAll(
      'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, []);
  const savedRect = useRef(null);

  useEffect(() => {
    if (isOpen && cardRect && phase === 'closed') {
      savedRect.current = { ...cardRect };
      document.body.style.overflow = 'hidden';
      setPhase('lift');
    }
  }, [isOpen, cardRect, phase]);

  const handleClose = useCallback(() => {
    // straight to collapse: the content fades out WHILE the surface shrinks and
    // the card copy fades back in, instead of an empty modal waiting 260ms for
    // its content to leave first (the close "isn't fully smooth")
    setPhase((p) => (p === 'open' ? 'collapse' : p));
  }, []);

  // Give the content stagger-out a moment before collapsing the surface.
  useEffect(() => {
    if (phase !== 'departing') return;
    const t = setTimeout(() => setPhase('collapse'), 260);
    return () => clearTimeout(t);
  }, [phase]);

  // NB: Escape cannot be caught while focus is inside one of the embedded
  // Google Drive iframes — a cross-origin frame receives the key and the parent
  // never sees it. Verified. The user is not stuck (Shift+Tab returns focus to
  // this document, and the close button is always reachable), but it is why
  // this handler cannot be the only way out.
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  if (phase === 'closed') return null;

  const r = savedRect.current;
  const expanded = {
    ...finalRect(),
    scale: 1,
    opacity: 1,
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
    transition: { duration: 0.6, ease: EXPAND_EASE },
  };
  const lifted = {
    top: r.top - 12,
    left: r.left,
    width: r.width,
    height: r.height,
    scale: 1.05,
    opacity: 1,
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.35)',
    transition: { duration: 0.28, ease: 'easeOut' },
  };
  const animatorTargets = {
    lift: lifted,
    expand: expanded,
    open: expanded,
    departing: expanded,
    collapse: { ...lifted, transition: { duration: 0.55, ease: EXPAND_EASE } },
    settle: {
      top: r.top,
      scale: 1,
      opacity: 0,                   // lands on the card, which is already revealed underneath (onLanding), and fades off it
      boxShadow: '0 5px 15px rgba(0, 0, 0, 0)',
      transition: { top: { duration: 0.3, ease: EXPAND_EASE }, scale: { duration: 0.3, ease: EXPAND_EASE }, boxShadow: { duration: 0.3 }, opacity: { duration: 0.22, delay: 0.24 } },
    },
  };

  const advance = () => {
    if (phase === 'lift') setPhase('expand');
    else if (phase === 'expand') setPhase('open');
    else if (phase === 'collapse') { if (onLanding) onLanding(); setPhase('settle'); }
    else if (phase === 'settle') {
      document.body.style.overflow = '';
      setPhase('closed');
      onClose();
    }
  };

  let modalTypeClass = 'project-modal';
  if (itemType === 'skill-group') modalTypeClass = 'skill-group-modal';
  else if (itemType === 'skill') modalTypeClass = 'skill-modal';
  else if (itemType === 'resume') modalTypeClass = 'resume-modal';

  const renderContent = () => {
    if (!itemData) return null;

    if (itemType === 'skill-group') {
      return (
        <>
          <motion.div variants={contentItem} className="modal-image-container" style={{ display: itemData.cardImageUrl ? 'block' : 'none' }}>
            <img
              src={itemData.cardImageUrl}
              alt={itemData.title}
              className="modal-image"
              onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x400/F7F5F2/BFA181?text=Img+Error'; }}
            />
          </motion.div>
          <div className="modal-text-content">
            <motion.h2 id="modal-title" variants={contentItem}>{itemData.title}</motion.h2>
            <div className="modal-skill-group-items-container">
              {itemData.items.map((skill, i) => {
                let skillImageSrc = skill.imageUrl;
                if (skillImageSrc.includes('iconify.design')) {
                  const iconColor = getComputedStyle(document.documentElement).getPropertyValue('--icon-resting-color').trim().replace('#', '');
                  // Strip any colour the data already carries: two `color`
                  // params make the Iconify API answer 500, not a fallback SVG.
                  const base = skillImageSrc.split('?')[0];
                  skillImageSrc = `${base}?color=${iconColor}`;
                }
                return (
                  <motion.div key={i} variants={contentItem} className="skill-group-item">
                    <img
                      src={skillImageSrc}
                      alt={skill.name}
                      className="skill-group-item-image"
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/60x60/F7F5F2/BFA181?text=?'; }}
                    />
                    <div className="skill-group-item-text">
                      <h3 className="skill-group-item-name">{skill.name}</h3>
                      <p className="skill-group-item-description">{skill.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    const title = itemData.title || itemData.modalTitle;
    const isResume = itemType === 'resume';
    const isMp4 = itemData.imageUrl?.toLowerCase().endsWith('.mp4');

    let mediaEl = null;
    // An entry with no cover (an Experience row) gets no media block at all —
    // an <img> with no src fell through to the "Img Error" placeholder.
    if (!isResume && itemData.imageUrl) {
      if (isMp4) {
        // `muted` is required or the browser blocks the autoplay outright.
        mediaEl = (
          <video
            src={itemData.imageUrl}
            poster={itemData.imageUrl.replace(/\.(mp4|webm)$/i, '-poster.webp')}
            className="modal-image"
            controls
            autoPlay
            loop
            muted
            playsInline
          />
        );
      } else {
        mediaEl = (
          <img
            src={itemData.imageUrl}
            alt={title}
            className="modal-image"
            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x400/F7F5F2/BFA181?text=Img+Error'; }}
          />
        );
      }
    }

    return (
      <>
        {mediaEl && (
          <motion.div variants={contentItem} className="modal-image-container">
            {mediaEl}
          </motion.div>
        )}
        <div className="modal-text-content">
          <motion.h2 id="modal-title" variants={contentItem}>{title}</motion.h2>
          {itemData.modalContent?.map((content, i) => {
            if (content.type === 'text') {
              return <motion.p key={i} variants={contentItem} className="modal-dynamic-text">{content.value}</motion.p>;
            } else if (content.type === 'button') {
              return (
                <motion.a key={i} variants={contentItem} href={content.link} className="modal-dynamic-button" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
                  {content.text}
                </motion.a>
              );
            } else if (content.type === 'embed') {
              // An embed with no src rendered as a large empty bordered box.
              if (!content.value) return null;
              return (
                <motion.iframe
                  key={i}
                  variants={contentItem}
                  src={content.value}
                  title={content.title || 'Embedded Content'}
                  className="modal-dynamic-embed"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  id={isResume ? 'resume-modal-iframe' : undefined}
                />
              );
            } else if (content.type === 'meta') {
              return <motion.p key={i} variants={contentItem} className="modal-meta">{content.value}</motion.p>;
            } else if (content.type === 'list') {
              return (
                <motion.ul key={i} variants={contentItem} className="modal-dynamic-list">
                  {content.items.map((item, j) => <li key={j}>{item}</li>)}
                </motion.ul>
              );
            } else if (content.type === 'tags') {
              return (
                <motion.div key={i} variants={contentItem} className="project-tags-container modal-tags">
                  {content.items.map((t, j) => <span key={j} className="project-tag">{t}</span>)}
                </motion.div>
              );
            } else if (content.type === 'video') {
              return (
                <motion.video key={i} variants={contentItem} className="modal-dynamic-video" src={content.value}
                  poster={content.value.replace(/\.mp4$/i, '-poster.webp')} autoPlay muted loop playsInline controls />
              );
            } else if (content.type === 'image') {
              return (
                <motion.img key={i} variants={contentItem} src={content.value} alt={content.alt || ''} className="modal-dynamic-image" />
              );
            }
            return null;
          })}
        </div>
      </>
    );
  };

  const backdropOn = phase === 'lift' || phase === 'expand' || phase === 'open';
  // The GHOST: the clicked card's own markup, at the card's size, filling the
  // surface while it lifts, then scaling up with it and fading out as the
  // real content fades in — and back again on close. The card turns into the
  // modal instead of an empty panel appearing and filling. (The owner: "don't
  // have the content just disappear and reappear. The card should lift off the
  // page and turn into the modal.")
  const ghostOn = phase === 'lift' || phase === 'collapse' || phase === 'settle';
  const fr = finalRect();
  const ghostScale = phase === 'expand' || phase === 'open' || phase === 'departing' ? Math.min(fr.width / r.width, fr.height / r.height) : 1;
  const contentOn = phase === 'expand' || phase === 'open';

  return (
    <>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: backdropOn ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        style={{ pointerEvents: phase === 'open' ? 'auto' : 'none' }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={trapTab}
        className={`modal-animator ${modalTypeClass}`}
        initial={{ ...r, scale: 1, opacity: 1, boxShadow: '0 5px 15px rgba(0, 0, 0, 0.15)' }}
        animate={animatorTargets[phase]}
        onAnimationComplete={advance}
      >
        {cardHTML && (
          <motion.div
            className={`modal-ghost ${cardClass || ''}`}
            aria-hidden="true"
            style={{ width: r.width, height: r.height, transformOrigin: '0 0' }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: ghostOn ? 1 : 0, scale: ghostScale }}
            // the scale runs on the SAME clock as the surface (0.6 open, 0.55
            // close) so the copy never over- or under-fills it; on close it
            // fades in at once, as the content fades out
            transition={{ opacity: { duration: 0.28, delay: phase === 'collapse' ? 0 : ghostOn ? 0.15 : 0.1 }, scale: { duration: phase === 'collapse' ? 0.55 : 0.6, ease: EXPAND_EASE } }}
            dangerouslySetInnerHTML={{ __html: cardHTML }}
          />
        )}
        <div className="modal-content">
          <motion.button
            className="modal-close"
            ref={closeRef}
            onClick={handleClose}
            aria-label="Close modal"
            animate={{ opacity: phase === 'open' ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          >
            &times;
          </motion.button>
          <motion.div
            className="modal-content-wrapper"
            variants={contentContainer}
            initial="hidden"
            animate={contentOn ? 'show' : 'hidden'}
          >
            {renderContent()}
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
