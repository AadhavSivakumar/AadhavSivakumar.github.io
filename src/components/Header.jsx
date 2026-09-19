import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onScroll } from '../scrollDriver';

// One link per page, in page order.
const LINKS = [
  { id: 'experience', label: 'Experience' },
  { id: 'research', label: 'Research' },
  { id: 'projects', label: 'Projects' },
  { id: 'additional-projects', label: 'More' },
  { id: 'resume', label: 'Resume' },
  { id: 'skills', label: 'Skills' },
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
  const [open, setOpen] = useState(false);          // the phone menu
  const navRef = useRef(null);
  const headerRef = useRef(null);

  // The phone menu closes on Escape, on a tap outside the header, and when
  // the viewport grows past the phone breakpoint (the links are inline again
  // and an "open" state would leave them styled as a dropdown).
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    const onDown = e => { if (headerRef.current && !headerRef.current.contains(e.target)) setOpen(false); };
    const mq = window.matchMedia('(min-width: 769px)');
    const onMQ = e => { if (e.matches) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    mq.addEventListener('change', onMQ);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); mq.removeEventListener('change', onMQ); };
  }, [open]);

  // On a phone the nav is wider than the screen and swipes sideways, so the
  // link for the page being read can be out of view. Keep it in view. This
  // sets the nav's own scrollLeft — scrollIntoView would scroll the PAGE too.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const link = nav.querySelector(`a[href="#${active}"]`);
    if (!link) return;
    const left = link.offsetLeft - nav.offsetLeft;
    const target = left - (nav.clientWidth - link.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [active]);

  useEffect(() => {
    return onScroll(y => setScrolled(y > 50));
  }, []);

  // Scroll spy: the section crossing the upper-middle band of the viewport
  // owns the nav highlighter.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    ['hero', ...LINKS.map((l) => l.id)].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className={scrolled ? 'scrolled' : ''}>
      <div className="logo"><a href="#hero">AS.</a></div>
      {/* On a phone the seven links and the toggle are 750px of nav on a
          390px screen. They used to swipe sideways; they are a menu behind
          this button now, at the owner's request. Hidden above 768px by CSS. */}
      <button
        type="button"
        className={`nav-burger${open ? ' is-open' : ''}`}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen(o => !o)}
      >
        <span /><span /><span />
      </button>
      <nav id="site-nav" ref={navRef} className={open ? 'nav--open' : ''}>
        {LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            className={`nav-link ${active === link.id ? 'active' : ''}`}
            onClick={() => setOpen(false)}
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
