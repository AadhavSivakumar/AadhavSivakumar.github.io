import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onScroll } from '../scrollDriver';

// One link per page, in page order.
const LINKS = [
  { id: 'experience', label: 'Experience' },
  { id: 'research', label: 'Research' },
  { id: 'projects', label: 'Projects' },
  { id: 'additional-projects', label: 'More' },
  { id: 'skills', label: 'Resume' },
  { id: 'contact', label: 'Contact' },
];

// The owner's profiles in the header (LinkedIn, GitHub, email, and the
// resume PDF from the repo) as their real marks IN THEIR OWN COLOURS (the
// owner, Oct 4: "have the socials icons be the color of what they are"):
// LinkedIn blue with white letters, GitHub in the page's ink, Gmail's
// four-colour M, a PDF-red document. On a phone they sit in the menu panel.
const SOCIALS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/aadhav-s/', cls: 'social--linkedin',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2" fill="#fff" /><path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg> },
  { label: 'GitHub', href: 'https://github.com/AadhavSivakumar', cls: 'social--github',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg> },
  { label: 'Email', href: 'mailto:sivakumaadhav@gmail.com', cls: 'social--gmail',
    icon: <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4caf50" d="M45 16.2l-5 2.75-5 4.75V40h7c1.66 0 3-1.34 3-3V16.2z" /><path fill="#1e88e5" d="M3 16.2l3.61 1.71L13 23.7V40H6c-1.66 0-3-1.34-3-3V16.2z" /><path fill="#e53935" d="M35 11.2l-11 8.25-11-8.25-1 5.8 1 6.7 11 8.25 11-8.25 1-6.7z" /><path fill="#c62828" d="M3 12.3v3.9l10 7.5V11.2L9.88 8.86A4.3 4.3 0 0 0 7.3 8 4.3 4.3 0 0 0 3 12.3z" /><path fill="#fbc02d" d="M45 12.3v3.9l-10 7.5V11.2l3.12-2.34A4.3 4.3 0 0 1 40.7 8 4.3 4.3 0 0 1 45 12.3z" /></svg> },
  { label: 'Resume (PDF)', href: '/Resume/Aadhav_Sivakumar_Resume.pdf', cls: 'social--pdf',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="7" width="14" height="10" fill="#fff" /><path fill="#E5252A" d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M9.5 11.5C9.5 12.3 8.8 13 8 13H7V15H5.5V9H8C8.8 9 9.5 9.7 9.5 10.5V11.5M14.5 13.5C14.5 14.3 13.8 15 13 15H10.5V9H13C13.8 9 14.5 9.7 14.5 10.5V13.5M18.5 10.5H17V11.5H18.5V13H17V15H15.5V9H18.5V10.5M12 10.5H13V13.5H12V10.5M7 10.5H8V11.5H7V10.5Z" /></svg> },
];
function Socials({ className }) {
  return (
    <div className={`socials ${className || ''}`}>
      {SOCIALS.map(s => (
        <a key={s.label} href={s.href} className={`social ${s.cls}`} aria-label={s.label} title={s.label}
          {...(s.href.startsWith('http') || s.href.endsWith('.pdf') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {s.icon}
        </a>
      ))}
    </div>
  );
}

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
    return onScroll(y => setScrolled(y > 12));   // large at the very top, compact as soon as the page moves
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
        <Socials className="socials--menu" />
      </nav>
      {/* right: the profiles and the theme toggle; the links are centred */}
      <div className="header-end">
        <Socials className="socials--bar" />
        <button id="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          <ThemeIcon theme={theme} />
        </button>
      </div>
    </header>
  );
}
