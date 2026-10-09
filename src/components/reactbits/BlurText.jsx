// From React Bits (reactbits.dev) — Copyright (c) 2026 David Haz.
// MIT + Commons Clause License Condition v1.0 (see ./LICENSE.md): used here as
// part of this website; not to be sold, sublicensed or redistributed.
//
// Upstream's defaults and props (Oct 9, re-synced for the hero: delay 200,
// rising 50px out of blur 10 → 5 → 0, linear; `animationFrom`/`animationTo`/
// `easing` to change them). Adapted: renders inline (inside the page's
// <h1>/<h2>) instead of a flex <p>, so words keep their natural wrapping and
// centring; `startDelay` (seconds) holds the first word back; under reduced
// motion the text is simply shown.
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, useMemo } from 'react';

const buildKeyframes = (from, steps) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))]);
  const keyframes = {};
  keys.forEach(k => { keyframes[k] = [from[k], ...steps.map(s => s[k])]; });
  return keyframes;
};
const linear = t => t;

export default function BlurText({
  text = '', delay = 200, className = '', animateBy = 'words', direction = 'top',
  threshold = 0.1, rootMargin = '0px', animationFrom, animationTo, easing = linear,
  onAnimationComplete, stepDuration = 0.35, startDelay = 0,
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

  const defaultFrom = useMemo(() => ({ filter: 'blur(10px)', opacity: 0, y: direction === 'top' ? -50 : 50 }), [direction]);
  const defaultTo = useMemo(() => [
    { filter: 'blur(5px)', opacity: 0.5, y: direction === 'top' ? 5 : -5 },
    { filter: 'blur(0px)', opacity: 1, y: 0 },
  ], [direction]);
  const from = animationFrom ?? defaultFrom;
  const to = animationTo ?? defaultTo;
  const stepCount = to.length + 1;
  const times = Array.from({ length: stepCount }, (_, i) => (stepCount === 1 ? 0 : i / (stepCount - 1)));

  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span ref={ref} className={`blur-text ${className}`}>
      {elements.map((seg, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block' }}
          initial={from}
          animate={inView ? buildKeyframes(from, to) : from}
          transition={{ duration: stepDuration * (stepCount - 1), times, delay: startDelay + (i * delay) / 1000, ease: easing }}
          onAnimationComplete={i === elements.length - 1 ? onAnimationComplete : undefined}
        >
          {seg === ' ' ? '\u00A0' : seg}
          {animateBy === 'words' && i < elements.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </span>
  );
}
