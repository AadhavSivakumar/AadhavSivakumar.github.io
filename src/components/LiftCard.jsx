import React from 'react';
import useScrollReveal from '../hooks/useScrollReveal';

// Shared interactive card. anime.js handles the scroll-into-view entrance
// (via useScrollReveal, which suppresses CSS transitions during the entrance);
// the hover lift / tap press live in CSS on `.lift-card`. (The 3D tilt now
// lives on the lanyard badges only.)
export default function LiftCard({ className = '', delay = 0, onClick, children, ...rest }) {
  const ref = useScrollReveal({ y: 40, scale: 0.97, delay, duration: 650, amount: 0.15 });

  return (
    <div ref={ref} className={`lift-card ${className}`} onClick={onClick} {...rest}>
      {children}
    </div>
  );
}
