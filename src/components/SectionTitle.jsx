import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

// Section heading revealed by an anime.js letter cascade (plus an underline
// draw) the first time it scrolls into view.
export default function SectionTitle({ children }) {
  const ref = useRef(null);
  const text = String(children);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      animate(el.querySelectorAll('.st-letter'), {
        y: ['0.7em', '0em'],
        opacity: [0, 1],
        duration: 750,
        delay: stagger(26),
        ease: 'outQuint',
      });
      animate(el.querySelector('.st-underline'), {
        scaleX: [0, 1],
        duration: 700,
        delay: 350,
        ease: 'outQuint',
      });
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <h2 className="section-title" ref={ref} aria-label={text}>
      {text.split(' ').map((word, wi, words) => (
        <React.Fragment key={wi}>
          <span className="st-word" aria-hidden="true">
            {word.split('').map((ch, i) => (
              <span key={i} className="st-letter">{ch}</span>
            ))}
          </span>
          {wi < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
      <span className="st-underline" aria-hidden="true" />
    </h2>
  );
}
