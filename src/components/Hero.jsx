import React, { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { motion } from 'motion/react';
import HeroChip from './HeroChip';
import portrait from '../../Media/hero/frontpagepfp.webp';

// Keyword chips under the tagline, like the live /portfolio hero — clicking
// one jumps to the section where that topic lives.
const KEYWORDS = [
  { label: 'Edge AI', target: 'experience' },
  { label: 'Computer Vision', target: 'skills' },
  { label: 'Robot Learning', target: 'experience' },
  { label: 'Robotics', target: 'projects' },
  { label: 'Machine Vision', target: 'skills' },
];

const NAME = 'Aadhav Sivakumar';

export default function Hero() {
  const heroRef = useRef(null);
  const [heroOnScreen, setHeroOnScreen] = useState(true);
  const nameRef = useRef(null);
  const glassRef = useRef(null);

  useEffect(() => {
    if (!nameRef.current) return;
    animate(nameRef.current.querySelectorAll('.hero-letter'), {
      y: { from: '0.8em' },
      opacity: { from: 0 },
      rotate: { from: 6 },
      duration: 950,
      delay: stagger(34, { start: 120 }),
      ease: 'outExpo',
    });
  }, []);

  // Ambient "living glass": slowly modulate the shared SVG displacement filter
  // the chips reference from backdrop-filter, so the refracted wave field
  // ripples. Frozen under reduced-motion; paused when the hero scrolls away
  // (backdrop-filter over a moving field is GPU-costly off-screen).
  useEffect(() => {
    const svg = glassRef.current;
    if (!svg) return;
    const turb = svg.querySelector('feTurbulence');
    const disp = svg.querySelector('feDisplacementMap');
    if (!turb || !disp) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      disp.setAttribute('scale', '9');
      turb.setAttribute('baseFrequency', '0.011 0.017');
      return;
    }

    const state = { s: 12, f: 0.009 };
    const loop = animate(state, {
      s: [10, 16],
      f: [0.008, 0.014],
      duration: 5600,
      ease: 'inOutSine',
      loop: true,
      alternate: true,
      onUpdate: () => {
        disp.setAttribute('scale', state.s.toFixed(2));
        turb.setAttribute('baseFrequency', `${state.f.toFixed(4)} ${(state.f * 1.6).toFixed(4)}`);
      },
    });

    const section = svg.closest('#hero');
    let io;
    if (section && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([e]) => { e.isIntersecting ? loop.play?.() : loop.pause?.(); },
        { threshold: 0.01 }
      );
      io.observe(section);
    }
    return () => { io && io.disconnect(); loop && loop.revert && loop.revert(); };
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
      { rootMargin: '80px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);


  return (
    <section id="hero" ref={heroRef} aria-labelledby="hero-title">
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
              baseFrequency="0.010 0.016"
              numOctaves="2" seed="7" stitchTiles="stitch"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="0.5" result="softNoise" />
            <feDisplacementMap
              in="SourceGraphic" in2="softNoise"
              scale="13" xChannelSelector="R" yChannelSelector="G"
            />
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

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        Edge AI engineer bridging industrial machine vision and robot learning
      </motion.p>

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
        <motion.span
          animate={heroOnScreen ? { y: [0, 9, 0] } : { y: 0 }}
          transition={
            heroOnScreen
              ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0 }
          }
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </motion.button>
    </section>
  );
}
