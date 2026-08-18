import React from 'react';
import useScrollReveal from '../hooks/useScrollReveal';

// Shared interactive card. anime.js handles the scroll-into-view entrance
// (via useScrollReveal, which suppresses CSS transitions during the entrance);
// the hover lift / tap press live in CSS on `.lift-card`. (The 3D tilt now
// lives on the lanyard badges only.)
//
// It is a DIV with button semantics rather than a real <button>: the cards
// contain <h4> and <p>, which are flow content and invalid inside a button.
// So it takes the keyboard contract on by hand — focusable, Enter and Space
// both activate, Space does not scroll the page. Without this the 23 project,
// skill and about cards (and therefore every modal behind them) were reachable
// by mouse only.
export default function LiftCard({ className = '', delay = 0, onClick, children, ...rest }) {
  const ref = useScrollReveal({ y: 40, scale: 0.97, delay, duration: 650, amount: 0.15 });

  const onKeyDown = e => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();          // Space would otherwise scroll
    onClick?.(e);
  };

  return (
    <div
      ref={ref}
      className={`lift-card ${className}`}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}
