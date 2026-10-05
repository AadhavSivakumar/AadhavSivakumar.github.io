// From React Bits (reactbits.dev) — Copyright (c) 2026 David Haz.
// MIT + Commons Clause License Condition v1.0 (see ./LICENSE.md): used here as
// part of this website; not to be sold, sublicensed or redistributed.
//
// Adapted: renders inline (inside the page's <h2>) instead of a <p>, words
// keep their natural wrapping, and under reduced motion the text is simply
// shown. Same keyframes as upstream: blur 10 → 5 → 0, rising from above.
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, useMemo } from 'react';

const buildKeyframes = (from, steps) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))]);
  const keyframes = {};
  keys.forEach(k => { keyframes[k] = [from[k], ...steps.map(s => s[k])]; });
  return keyframes;
};

export default function BlurText({
  text = '', delay = 90, className = '', animateBy = 'words', direction = 'top',
  threshold = 0.4, rootMargin = '0px', stepDuration = 0.35, onAnimationComplete,
}) {
  const reduce = useReducedMotion();
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || reduce) return undefined;
    const el = ref.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.unobserve(el); }
    }, { threshold, rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, reduce]);

  const from = useMemo(() => ({ filter: 'blur(10px)', opacity: 0, y: direction === 'top' ? -30 : 30 }), [direction]);
  const to = useMemo(() => [
    { filter: 'blur(5px)', opacity: 0.5, y: direction === 'top' ? 4 : -4 },
    { filter: 'blur(0px)', opacity: 1, y: 0 },
  ], [direction]);
  const times = [0, 0.5, 1];

  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span ref={ref} className={`blur-text ${className}`}>
      {elements.map((seg, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block' }}
          initial={from}
          animate={inView ? buildKeyframes(from, to) : from}
          transition={{ duration: stepDuration * 2, times, delay: (i * delay) / 1000, ease: 'easeOut' }}
          onAnimationComplete={i === elements.length - 1 ? onAnimationComplete : undefined}
        >
          {seg === ' ' ? ' ' : seg}
          {animateBy === 'words' && i < elements.length - 1 && ' '}
        </motion.span>
      ))}
    </span>
  );
}
