import React, { useEffect, useRef } from 'react';

export default function AnimatedObjects() {
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    let raf;
    const handleScroll = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const totalScrollable = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = totalScrollable > 0 ? scrollY / totalScrollable : 0;

        if (rightRef.current) {
          const squareTravelDistance = window.innerHeight;
          const squareY = scrollPercent * squareTravelDistance;
          const squareRotation = scrollPercent * 360;
          rightRef.current.style.transform = `translateY(${squareY - rightRef.current.offsetHeight}px) rotate(${squareRotation}deg)`;
          const arrowIcon = rightRef.current.querySelector('svg');
          if (arrowIcon) arrowIcon.style.transform = `rotate(${-squareRotation}deg)`;
        }

        if (leftRef.current) {
          const initialTopPx = window.innerHeight * 0.85;
          const totalUpwardTravel = initialTopPx + leftRef.current.offsetHeight;
          const triangleY = -scrollPercent * totalUpwardTravel;
          const triangleRotation = scrollPercent * 720;
          leftRef.current.style.transform = `translateY(${triangleY}px) rotate(${triangleRotation}deg)`;
          const arrowIcon = leftRef.current.querySelector('svg');
          if (arrowIcon) arrowIcon.style.transform = `rotate(${-triangleRotation}deg)`;
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const scrollDown = () => {
    const sections = Array.from(document.querySelectorAll('main > section'));
    const currentY = window.scrollY;
    let nextSection = sections.find(s => s.offsetTop > currentY + 2);
    if (nextSection?.id === 'about') nextSection = document.getElementById('projects');
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.querySelector('footer')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollUp = () => {
    const sections = Array.from(document.querySelectorAll('main > section'));
    const currentY = window.scrollY;
    const prev = sections.filter(s => s.offsetTop < currentY - 2);
    if (prev.length > 0) {
      let target = prev[prev.length - 1];
      if (target?.id === 'about') target = document.getElementById('hero');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div
        ref={leftRef}
        className="animated-object left-object"
        title="Next Section"
        aria-label="Scroll to next section"
        onClick={scrollDown}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="7 10 12 15 17 10" />
        </svg>
      </div>
      <div
        ref={rightRef}
        className="animated-object right-object"
        title="Previous Section"
        aria-label="Scroll to previous section"
        onClick={scrollUp}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="7 15 12 10 17 15" />
        </svg>
      </div>
    </>
  );
}
