import React from 'react';
import BlurText from './reactbits/BlurText';

// Section heading. Since Oct 5 its entrance is React Bits' BlurText (the
// owner: "refactor A LOT of things on the site with either reactbits or
// framer components"): each word falls into place out of a blur the first
// time the title scrolls into view. It replaced an anime.js letter cascade.
// Reduced motion: BlurText renders the plain text.
export default function SectionTitle({ children, id }) {
  const text = String(children);
  return (
    <h2 className="section-title" id={id} aria-label={text}>
      <span aria-hidden="true"><BlurText text={text} delay={110} /></span>
    </h2>
  );
}
