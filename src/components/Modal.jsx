import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';

const EXPAND_EASE = [0.22, 1, 0.36, 1];

// Content population: children stagger in once the modal is fully expanded,
// and stagger back out (quickly, in reverse) before it collapses.
const contentContainer = {
  hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const contentItem = {
  hidden: { opacity: 0, y: 24, transition: { duration: 0.18, ease: 'easeIn' } },
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
export default function Modal({ isOpen, itemData, itemType, cardRect, onClose }) {
  const [phase, setPhase] = useState('closed');
  const savedRect = useRef(null);

  useEffect(() => {
    if (isOpen && cardRect && phase === 'closed') {
      savedRect.current = { ...cardRect };
      document.body.style.overflow = 'hidden';
      setPhase('lift');
    }
  }, [isOpen, cardRect, phase]);

  const handleClose = useCallback(() => {
    setPhase((p) => (p === 'open' ? 'departing' : p));
  }, []);

  // Give the content stagger-out a moment before collapsing the surface.
  useEffect(() => {
    if (phase !== 'departing') return;
    const t = setTimeout(() => setPhase('collapse'), 260);
    return () => clearTimeout(t);
  }, [phase]);

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
    collapse: { ...lifted, transition: { duration: 0.5, ease: EXPAND_EASE } },
    settle: {
      top: r.top,
      scale: 1,
      opacity: 0,
      boxShadow: '0 5px 15px rgba(0, 0, 0, 0)',
      transition: { duration: 0.24, ease: 'easeIn' },
    },
  };

  const advance = () => {
    if (phase === 'lift') setPhase('expand');
    else if (phase === 'expand') setPhase('open');
    else if (phase === 'collapse') setPhase('settle');
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
            <motion.h2 variants={contentItem}>{itemData.title}</motion.h2>
            <div className="modal-skill-group-items-container">
              {itemData.items.map((skill, i) => {
                let skillImageSrc = skill.imageUrl;
                if (skillImageSrc.includes('iconify.design')) {
                  const iconColor = getComputedStyle(document.documentElement).getPropertyValue('--icon-resting-color').trim().replace('#', '');
                  skillImageSrc += (skillImageSrc.includes('?') ? '&' : '?') + `color=${iconColor}`;
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
                      <h4 className="skill-group-item-name">{skill.name}</h4>
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
    if (!isResume) {
      if (isMp4) {
        mediaEl = <video src={itemData.imageUrl} className="modal-image" controls autoPlay loop />;
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
        {!isResume && (
          <motion.div variants={contentItem} className="modal-image-container">
            {mediaEl}
          </motion.div>
        )}
        <div className="modal-text-content">
          <motion.h2 variants={contentItem}>{title}</motion.h2>
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
        className={`modal-animator ${modalTypeClass}`}
        initial={{ ...r, scale: 1, opacity: 1, boxShadow: '0 5px 15px rgba(0, 0, 0, 0.15)' }}
        animate={animatorTargets[phase]}
        onAnimationComplete={advance}
      >
        <div className="modal-content">
          <motion.button
            className="modal-close"
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
            animate={phase === 'open' ? 'show' : 'hidden'}
          >
            {renderContent()}
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
