import React from 'react';
import BlurText from './reactbits/BlurText';

// Section heading. Since Oct 5 its entrance is React Bits' BlurText (the
// owner: "refactor A LOT of things on the site with either reactbits or
// framer components"): each word falls into place out of a blur the first
// time the title scrolls into view. It replaced an anime.js letter cascade.
// A shorter fall and an ease-out, as it has run since then (the hero uses
// BlurText's own defaults). Reduced motion: BlurText renders the plain text.
const FROM = { filter: 'blur(10px)', opacity: 0, y: -30 };
const TO = [{ filter: 'blur(5px)', opacity: 0.5, y: 4 }, { filter: 'blur(0px)', opacity: 1, y: 0 }];

export default function SectionTitle({ children, id }) {
  const text = String(children);
  return (
    <h2 className="section-title" id={id} aria-label={text}>
      <span aria-hidden="true">
        <BlurText text={text} delay={110} threshold={0.4} animationFrom={FROM} animationTo={TO} easing="easeOut" />
      </span>
    </h2>
  );
}
