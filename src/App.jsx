import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  // The flourishes are ~350 elements across two preserve-3d trees, and every
  // camera change makes the browser re-sort and re-rasterise all of them.
  // Measured, that is about one 60fps frame budget per side while scrolling —
  // fine on a desktop GPU, not fine on a low-core machine. They are decoration,
  // so the cheapest honest fix is not to draw them there at all.
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
      lastClickedCardRef.current.classList.remove('animating-out');
      lastClickedCardRef.current = null;
    }
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <>
      <ScrollProgress />
      {/* Page-wide decorative 3D flourishes: real CSS-3D assemblies driven by
          anime.js, fixed to the viewport one per side, behind all content —
          exploding and reassembling as the whole page scrolls. */}
      {isWide && canAfford3D && (
        <div className="page-flourish-layer" aria-hidden="true">
          <Flourish3D side="left" />
          <Flourish3D side="right" />
        </div>
      )}
      <Header theme={theme} toggleTheme={toggleTheme} />
      <main>
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
    </>
  );
}

export default App;
