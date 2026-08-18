import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MotionConfig } from 'motion/react';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Projects from './components/Projects';
import Skills from './components/Skills';
import Resume from './components/Resume';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Modal from './components/Modal';
import ScrollProgress from './components/ScrollProgress';
import Flourish3D from './components/Flourish3D';
import { useTheme } from './hooks/useTheme';

function App() {
  const { theme, toggleTheme } = useTheme();
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 992);
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

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 992);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
          viewport behind all content, scrubbed by page scroll. */}
      {isWide && canAfford3D && (
        <div className="page-flourish-layer" aria-hidden="true">
          <Flourish3D side="left" />
          <Flourish3D side="right" />
        </div>
      )}
      <a className="skip-link" href="#main">Skip to content</a>
      <Header theme={theme} toggleTheme={toggleTheme} />
      <main id="main">
        <Hero />
        <About onCardClick={handleCardClick} />
        <Projects onCardClick={handleCardClick} />
        <Skills onCardClick={handleCardClick} />
        <Resume onCardClick={handleCardClick} />
        <Contact />
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
