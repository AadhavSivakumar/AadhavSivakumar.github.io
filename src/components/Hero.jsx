import React, { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { motion } from 'motion/react';
import HeroChip from './HeroChip';
import DecryptedText from './reactbits/DecryptedText';
import portrait from '../../Media/hero/frontpagepfp.webp';

// Keyword chips under the tagline, like the live /portfolio hero — clicking
// one jumps to the section where that topic lives. These are the fields the
// owner is looking for work in, in their words ("reinforcement learning,
// world models, simulation, VLAs, embodied AI"), plus robotics itself; the
// tagline says the same thing in a sentence.
const KEYWORDS = [
  { label: 'Robotics', target: 'projects' },
  { label: 'VLAs', target: 'skills' },
  { label: 'World Models', target: 'research' },
  { label: 'Reinforcement Learning', target: 'research' },
  { label: 'Simulation', target: 'projects' },
  { label: 'Embodied AI', target: 'experience' },
];

const NAME = 'Aadhav Sivakumar';

export default function Hero() {
  const heroRef = useRef(null);
  const [heroOnScreen, setHeroOnScreen] = useState(true);
  const nameRef = useRef(null);
  const glassRef = useRef(null);

  useEffect(() => {
    if (!nameRef.current) return;
    // anime.js is outside <MotionConfig>: honour reduced motion here (the
    // letters are visible by default, so skipping is all it takes)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    animate(nameRef.current.querySelectorAll('.hero-letter'), {
      y: { from: '0.8em' },
      opacity: { from: 0 },
      rotate: { from: 6 },
      duration: 950,
      delay: stagger(34, { start: 120 }),
      ease: 'outExpo',
    });
  }, []);

  // Ambient "living glass": the shared displacement filter the chips refract
  // through ripples slowly. It used to be an anime.js loop calling
  // setAttribute on the filter every frame — ~170 DOM mutations a second on a
  // still hero (Oct 3 review). Now it is SMIL <animate> inside the filter
  // (no DOM writes), paused while the hero is off screen and removed under
  // reduced motion.
  useEffect(() => {
    const svg = glassRef.current;
    if (!svg) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      svg.querySelectorAll('animate').forEach(n => n.remove());
      return undefined;
    }
    const section = svg.closest('#hero');
    if (!section || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => {
      try { e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations(); } catch { /* no SMIL */ }
    }, { threshold: 0.01 });
    io.observe(section);
    return () => io.disconnect();
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });


  // The scroll cue is a motion loop writing inline styles, so it has to be
  // told when the hero leaves the screen — it was still running ~37 writes a
  // second with the hero scrolled off the top of the page. rAF is throttled
  // when the TAB is hidden, never when something merely scrolls out of view.
  // (The aurora blobs and the SVG wave field this observer used to pause are
  // gone: the field is the WaveField canvas now, which idles itself.)
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([e]) => setHeroOnScreen(e.isIntersecting),
      // NOT an outward margin: sitting on the Experience page puts the hero's
      // bottom edge exactly at the top of the screen, and with 80px of margin
      // it still counted as on screen — the cue kept bobbing on a still page
      { threshold: 0.02 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);


  return (
    <section id="hero" data-idle={heroOnScreen ? undefined : "1"} ref={heroRef} aria-labelledby="hero-title">
      {/* The sine field behind this is the WaveField canvas in App.jsx — fixed
          to the viewport so it can leave the hero and become the two side
          pieces. The glass chips refract it through backdrop-filter. */}

      {/* Shared liquid-glass displacement filter. As a backdrop-filter, its
          SourceGraphic IS the backdrop, so feDisplacementMap warps the wave
          field seen through every chip. */}
      <svg
        ref={glassRef}
        className="hero-glass-defs"
        aria-hidden="true"
        width="0" height="0"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          <filter
            id="hero-liquid-glass"
            x="-25%" y="-25%" width="150%" height="150%"
            colorInterpolationFilters="sRGB"
            primitiveUnits="userSpaceOnUse"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.006 0.0096"
              numOctaves="2" seed="7" stitchTiles="stitch"
              result="noise"
            >
              <animate attributeName="baseFrequency" dur="11.2s" repeatCount="indefinite"
                values="0.005 0.008; 0.009 0.0144; 0.005 0.008" calcMode="spline" keyTimes="0; 0.5; 1" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />
            </feTurbulence>
            <feGaussianBlur in="noise" stdDeviation="0.5" result="softNoise" />
            <feDisplacementMap
              in="SourceGraphic" in2="softNoise"
              scale="22" xChannelSelector="R" yChannelSelector="G"
            >
              <animate attributeName="scale" dur="11.2s" repeatCount="indefinite"
                values="18; 30; 18" calcMode="spline" keyTimes="0; 0.5; 1" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />
            </feDisplacementMap>
          </filter>
        </defs>
      </svg>

      {/* The portrait, as on /portfolio: a 224px disc above the name. */}
      <motion.div
        className="hero-photo"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <img src={portrait} alt="" width="480" height="480" decoding="async" fetchpriority="high" />
      </motion.div>

      {/* ONE line of who and where over the name (the owner: "consolidate the
          information" — the serif statement and the descriptive line under
          the name are gone; the chips carry the fields) */}
      <motion.div
        className="hero-eyebrow"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* React Bits' DecryptedText: the line resolves out of scrambled
            characters once, left to right, then stays still */}
        <DecryptedText text="New York & San Francisco" animateOn="view" sequential revealDirection="start" speed={38}
          characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\_-" encryptedClassName="hero-eyebrow__scramble" />
      </motion.div>

      <h1 id="hero-title" ref={nameRef} aria-label={NAME}>
        {NAME.split(' ').map((word, wi, words) => (
          <React.Fragment key={wi}>
            <span className="hero-word" aria-hidden="true">
              {word.split('').map((ch, i) => (
                <span key={i} className="hero-letter">{ch}</span>
              ))}
            </span>
            {wi < words.length - 1 ? ' ' : null}
          </React.Fragment>
        ))}
      </h1>

      <div className="hero-chips">
        {KEYWORDS.map((k, i) => (
          <HeroChip
            key={k.label}
            label={k.label}
            index={i}
            onClick={() => scrollTo(k.target)}
          />
        ))}
      </div>

      <motion.button
        className="hero-scroll-cue"
        aria-label="Scroll to Experience"
        onClick={() => scrollTo('experience')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
      >
        {/* a CSS bob (compositor only, no DOM writes); paused with the rest
            of the hero's loops via #hero[data-idle] and under reduced motion */}
        <span className="hero-scroll-cue__bob">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </motion.button>
    </section>
  );
}
