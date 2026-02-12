import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function Modal({ isOpen, itemData, itemType, cardRect, onClose }) {
  const backdropRef = useRef(null);
  const animatorRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const savedCardRect = useRef(null);
  const animationDuration = 650;

  // Open animation
  useEffect(() => {
    if (isOpen && cardRect) {
      savedCardRect.current = { ...cardRect };
      setIsRendered(true);
      setIsAnimating(true);

      // Use requestAnimationFrame to ensure DOM is updated before animation
      requestAnimationFrame(() => {
        const modal = animatorRef.current;
        if (!modal) return;

        document.body.style.overflow = 'hidden';

        // Set initial position (matching clicked card)
        modal.style.transition = 'none';
        modal.style.top = `${cardRect.top}px`;
        modal.style.left = `${cardRect.left}px`;
        modal.style.width = `${cardRect.width}px`;
        modal.style.height = `${cardRect.height}px`;
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';

        // Force reflow
        void modal.offsetHeight;

        // Re-enable transitions and animate to final position
        modal.style.transition = '';
        const finalWidth = Math.min(1280, window.innerWidth * 0.9);
        const finalHeight = Math.min(window.innerHeight * 0.9, 1080);
        modal.style.top = `${(window.innerHeight - finalHeight) / 2}px`;
        modal.style.left = `${(window.innerWidth - finalWidth) / 2}px`;
        modal.style.width = `${finalWidth}px`;
        modal.style.height = `${finalHeight}px`;

        setTimeout(() => {
          setIsAnimating(false);
          setIsContentVisible(true);
        }, animationDuration);
      });
    }
  }, [isOpen, cardRect]);

  const handleClose = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsContentVisible(false);

    const modal = animatorRef.current;
    const rect = savedCardRect.current;

    if (modal && rect) {
      modal.style.top = `${rect.top}px`;
      modal.style.left = `${rect.left}px`;
      modal.style.width = `${rect.width}px`;
      modal.style.height = `${rect.height}px`;
      modal.style.opacity = '0';
    }

    if (backdropRef.current) {
      backdropRef.current.classList.remove('visible');
    }

    setTimeout(() => {
      setIsAnimating(false);
      setIsRendered(false);
      document.body.style.overflow = '';
      onClose();
    }, animationDuration);
  }, [isAnimating, onClose]);

  // Escape key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !isAnimating) handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isAnimating, handleClose]);

  if (!isRendered && !isOpen) return null;

  // Determine modal type class
  let modalTypeClass = '';
  if (itemType === 'skill-group') modalTypeClass = 'skill-group-modal';
  else if (itemType === 'skill') modalTypeClass = 'skill-modal';
  else if (itemType === 'resume') modalTypeClass = 'resume-modal';
  else modalTypeClass = 'project-modal';

  const renderContent = () => {
    if (!itemData) return null;

    if (itemType === 'skill-group') {
      return (
        <>
          <div className="modal-image-container" style={{ display: itemData.cardImageUrl ? 'block' : 'none' }}>
            <img
              src={itemData.cardImageUrl}
              alt={itemData.title}
              className="modal-image"
              onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x400/F7F5F2/BFA181?text=Img+Error'; }}
            />
          </div>
          <div className="modal-text-content">
            <h2>{itemData.title}</h2>
            <div className="modal-skill-group-items-container">
              {itemData.items.map((skill, i) => {
                let skillImageSrc = skill.imageUrl;
                if (skillImageSrc.includes('iconify.design')) {
                  const iconColor = getComputedStyle(document.documentElement).getPropertyValue('--icon-resting-color').trim().replace('#', '');
                  if (skillImageSrc.includes('?')) {
                    skillImageSrc += `&color=${iconColor}`;
                  } else {
                    skillImageSrc += `?color=${iconColor}`;
                  }
                }
                return (
                  <div key={i} className="skill-group-item">
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
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    // Project / About / Resume modals
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
          <div className="modal-image-container">
            {mediaEl}
          </div>
        )}
        <div className="modal-text-content">
          <h2>{title}</h2>
          {itemData.modalContent?.map((content, i) => {
            if (content.type === 'text') {
              return <p key={i} className="modal-dynamic-text">{content.value}</p>;
            } else if (content.type === 'button') {
              return (
                <a key={i} href={content.link} className="modal-dynamic-button" target="_blank" rel="noopener noreferrer">
                  {content.text}
                </a>
              );
            } else if (content.type === 'embed') {
              return (
                <iframe
                  key={i}
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
                <img
                  key={i}
                  src={content.value}
                  alt={content.alt || ''}
                  className="modal-dynamic-image"
                />
              );
            }
            return null;
          })}
        </div>
      </>
    );
  };

  return (
    <>
      <div
        ref={backdropRef}
        className={`modal-backdrop ${isOpen && !isAnimating ? 'visible' : isOpen ? 'visible' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      />
      <div
        ref={animatorRef}
        className={`modal-animator ${modalTypeClass} visible ${isContentVisible ? 'open' : ''}`}
      >
        <div className="modal-content">
          <button className="modal-close" onClick={handleClose} aria-label="Close modal">&times;</button>
          <div className="modal-content-wrapper">
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
}
