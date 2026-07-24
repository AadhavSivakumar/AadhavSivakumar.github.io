import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { motion } from 'motion/react';
import SineWave from './SineWave';
import HeroChip from './HeroChip';

// Keyword chips under the tagline, like the live /portfolio hero — clicking
// one jumps to the section where that topic lives.
const KEYWORDS = [
  { label: 'Robotics', target: 'projects' },
  { label: 'Embedded AI', target: 'skills' },
  { label: 'Machine Learning', target: 'projects' },
  { label: 'Computer Vision', target: 'projects' },
  { label: 'Mechatronics', target: 'skills' },
];

const NAME = 'Aadhav Sivakumar';

export default function Hero() {
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

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="hero">
      <div className="hero-aurora" aria-hidden="true">
        <div className="aurora-blob aurora-a" />
        <div className="aurora-blob aurora-b" />
      </div>

      {/* Full-width animated sine field behind everything — the glass chips
          refract this through backdrop-filter. */}
      <SineWave variant="field" />

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

      <h1 ref={nameRef} aria-label={NAME}>
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
        Robotics Engineer Specializing in Embedded AI and Autonomous Systems
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
        aria-label="Scroll to About"
        onClick={() => scrollTo('about')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
      >
        <motion.span
          animate={{ y: [0, 9, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </motion.button>
    </section>
  );
}
