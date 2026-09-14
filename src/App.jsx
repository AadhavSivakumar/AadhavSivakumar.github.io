import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MotionConfig } from 'motion/react';
import Header from './components/Header';
import Hero from './components/Hero';
import Experience from './components/Experience';
import Projects from './components/Projects';
import Skills from './components/Skills';
import Resume from './components/Resume';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Modal from './components/Modal';
import ScrollProgress from './components/ScrollProgress';
import Flourish3D from './components/Flourish3D';
import WaveField from './components/WaveField';
import { useTheme } from './hooks/useTheme';

function App() {
  const { theme, toggleTheme } = useTheme();
  // Each flourish is one canvas doing its own projection, so the cost is CPU
  // maths rather than layout — but it is still a few thousand segments a frame
  // on every scroll. They are decoration, so on a low-core machine the cheapest
  // honest fix is not to draw them at all.
  const [canAfford3D] = useState(
    () => typeof navigator === 'undefined' || (navigator.hardwareConcurrency ?? 8) > 4
  );
  const lastClickedCardRef = useRef(null);
  const [modalState, setModalState] = useState({
    isOpen: false,
    itemData: null,
    itemType: null,
    cardRect: null,
  });

  useEffect(() => {
    if (history.scrollRestoration) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);


  const handleCardClick = useCallback((cardElement, itemData, itemType) => {
    const rect = cardElement.getBoundingClientRect();
    // Add animating-out class to card for visual effect
    cardElement.classList.add('animating-out');
    lastClickedCardRef.current = cardElement;
    setModalState({
      isOpen: true,
      itemData,
      itemType,
      cardRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    });
  }, []);

  const handleModalClose = useCallback(() => {
    if (lastClickedCardRef.current) {
      const card = lastClickedCardRef.current;
      card.classList.remove('animating-out');
      // Return focus to the card that opened the modal. The card is hidden
      // (visibility) while the modal is up, so the browser had dropped focus to
      // <body> — without this a keyboard user is dumped back at the top of the
      // document every time they close something.
      requestAnimationFrame(() => card.focus?.({ preventScroll: true }));
      lastClickedCardRef.current = null;
    }
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    // reducedMotion="user" makes motion/react drop transform and layout
    // animations for anyone who asked the OS for less movement: the nav pill,
    // the theme-toggle swap, the hero, and the modal's lift/expand sequence.
    // It is set once here rather than component by component so a new
    // motion component cannot quietly opt out of it.
    <MotionConfig reducedMotion="user">
      <ScrollProgress />
      {/* Page-wide decorative flourishes: one canvas per side, fixed to the
          viewport behind all content, scrubbed by page scroll. NOT gated on
          width any more — they were invisible on every phone. The stage sizes
          itself from CSS and the renderer scales to match, so a phone gets a
          smaller and cheaper canvas rather than none at all. About.jsx keeps
          its own width gate for the lanyard, which genuinely cannot run
          there. */}
      <div className="page-flourish-layer" aria-hidden="true">
        {/* The hero's sine field lives here too, not in the hero: it is what
            the two pieces are made FROM. Scroll, and each row is cut at the
            centre — the left half flies straight into the camera, the right
            half into the motor. The field is drawn on every machine; the
            pieces stay gated. */}
        <WaveField />
        {canAfford3D && <Flourish3D side="left" />}
        {canAfford3D && <Flourish3D side="right" />}
      </div>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header theme={theme} toggleTheme={toggleTheme} />
      <main id="main">
        <Hero />
        {/* One screen each, in the owner's order: industry experience, research,
            major projects, additional projects, resume, skills, contact. Each
            page but the last ends in a down button to the next (`next`). The
            about card is in the contact page now. */}
        <Experience id="experience" title="Experience" group="industry" onCardClick={handleCardClick} next={{ to: 'research', label: 'Research' }} />
        <Experience id="research" title="Research" group="research" onCardClick={handleCardClick} next={{ to: 'projects', label: 'Major Projects' }} />
        <Projects onCardClick={handleCardClick} />
        <Resume onCardClick={handleCardClick} next={{ to: 'skills', label: 'Technical Skills' }} />
        <Skills onCardClick={handleCardClick} next={{ to: 'contact', label: 'Get In Touch' }} />
        <Contact onCardClick={handleCardClick} />
      </main>
      <Footer />
      <Modal
        isOpen={modalState.isOpen}
        itemData={modalState.itemData}
        itemType={modalState.itemType}
        cardRect={modalState.cardRect}
        onClose={handleModalClose}
      />
    </MotionConfig>
  );
}

export default App;
