import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { motion } from 'motion/react';

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

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="hero">
      <div className="hero-aurora" aria-hidden="true">
        <div className="aurora-blob aurora-a" />
        <div className="aurora-blob aurora-b" />
      </div>

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
          <motion.button
            key={k.label}
            className="hero-chip"
            onClick={() => scrollTo(k.target)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3, scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
          >
            {k.label}
          </motion.button>
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
