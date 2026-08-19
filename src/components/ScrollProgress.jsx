import React, { useEffect, useRef } from 'react';
import { animate } from 'animejs';
import { onScroll } from '../scrollDriver';

// Thin gold bar under the top edge whose fill is an anime.js animation
// scrubbed by page scroll (anim.seek maps scroll ratio onto the timeline).
export default function ScrollProgress() {
  const barRef = useRef(null);

  useEffect(() => {
    const anim = animate(barRef.current, {
      scaleX: [0, 1],
      duration: 1000,
      ease: 'linear',
      autoplay: false,
    });
    // The document height used to be read here, inside the handler, on every
    // scroll event — a forced layout per event. The shared driver measures it
    // on resize instead and calls this from inside one rAF.
    const stop = onScroll((y, p) => anim.seek(p * 1000));
    return () => { stop(); anim.revert(); };
  }, []);

  return (
    <div className="scroll-progress" aria-hidden="true">
      <div ref={barRef} className="scroll-progress-bar" />
    </div>
  );
}
