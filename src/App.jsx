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
import { useTheme } from './hooks/useTheme';

function App() {
  const { theme, toggleTheme } = useTheme();
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
      lastClickedCardRef.current.classList.remove('animating-out');
      lastClickedCardRef.current = null;
    }
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <>
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
