import React, { useEffect, useRef } from 'react';
import { animate } from 'animejs';

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
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      anim.seek((max > 0 ? Math.min(1, window.scrollY / max) : 0) * 1000);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      anim.revert();
    };
  }, []);

  return (
    <div className="scroll-progress" aria-hidden="true">
      <div ref={barRef} className="scroll-progress-bar" />
    </div>
  );
}
