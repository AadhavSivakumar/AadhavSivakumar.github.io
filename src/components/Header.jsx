import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const LINKS = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'resume', label: 'Resume' },
  { id: 'contact', label: 'Contact' },
];

// Animated sun <-> moon: the disc shrinks and a masking circle slides across to
// carve out a crescent, while the eight rays retract into the disc. Everything
// is one continuous transition, so the toggle morphs rather than swapping
// glyphs.
const RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

function ThemeIcon({ theme }) {
  const dark = theme === 'dark';
  const spring = { type: 'spring', stiffness: 220, damping: 22 };
  return (
    <motion.svg
      className="theme-icon"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      animate={{ rotate: dark ? -40 : 0 }}
      transition={spring}
    >
      <mask id="theme-icon-mask">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <motion.circle
          r="9"
          fill="black"
          animate={{ cx: dark ? 16 : 26, cy: dark ? 6 : -6 }}
          transition={spring}
        />
      </mask>
      <motion.circle
        cx="12"
        cy="12"
        fill="currentColor"
        stroke="none"
        mask="url(#theme-icon-mask)"
        animate={{ r: dark ? 10 : 5.2 }}
        transition={spring}
      />
      <motion.g animate={{ opacity: dark ? 0 : 1, rotate: dark ? 45 : 0 }} transition={spring} style={{ originX: '12px', originY: '12px' }}>
        {RAYS.map((a, i) => {
          const x = 12 + Math.cos(a);
          const y = 12 + Math.sin(a);
          return (
            <motion.line
              key={i}
              x1={12 + Math.cos(a) * 8}
              y1={12 + Math.sin(a) * 8}
              x2={12 + Math.cos(a) * 10.5}
              y2={12 + Math.sin(a) * 10.5}
              animate={{ opacity: dark ? 0 : 1, x: dark ? (x - 12) * -6 : 0, y: dark ? (y - 12) * -6 : 0 }}
              transition={{ ...spring, delay: dark ? 0 : 0.04 * i }}
            />
          );
        })}
      </motion.g>
    </motion.svg>
  );
}

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
          <ThemeIcon theme={theme} />
        </button>
      </nav>
    </header>
  );
}
