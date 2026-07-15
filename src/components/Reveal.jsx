import React from 'react';
import useScrollReveal from '../hooks/useScrollReveal';

// Fade-and-rise on scroll into view, driven by anime.js. Wraps section
// headings, paragraphs and other one-off elements; cards use LiftCard instead.
export default function Reveal({ children, delay = 0, y = 28, className, ...rest }) {
  const ref = useScrollReveal({ y, delay, duration: 700, amount: 0.2 });
  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}
