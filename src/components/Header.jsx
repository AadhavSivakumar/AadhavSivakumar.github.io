import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const LINKS = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'resume', label: 'Resume' },
  { id: 'contact', label: 'Contact' },
];

export default function Header({ theme, toggleTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll spy: the section crossing the upper-middle band of the viewport
  // owns the nav highlighter.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id === 'additional-projects' ? 'projects' : entry.target.id;
            setActive(id);
          }
        });
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    ['hero', 'additional-projects', ...LINKS.map((l) => l.id)].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header className={scrolled ? 'scrolled' : ''}>
      <div className="logo"><a href="#hero">AS.</a></div>
      <nav>
        {LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            className={`nav-link ${active === link.id ? 'active' : ''}`}
          >
            {active === link.id && (
              <motion.span
                layoutId="nav-pill"
                className="nav-pill"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="nav-link-label">{link.label}</span>
          </a>
        ))}
        <button id="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              style={{ display: 'inline-block' }}
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25 }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </motion.span>
          </AnimatePresence>
        </button>
      </nav>
    </header>
  );
}
