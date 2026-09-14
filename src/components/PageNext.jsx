import React from 'react';

// The down button at the bottom of every page: jumps to the next one.
//
// A link, not a button that calls scrollIntoView — it is navigation, it works
// without JavaScript and from the keyboard, and html's `scroll-behavior:
// smooth` (auto under reduced motion) already does the scrolling. It does NOT
// bob up and down like the hero's cue: an animation that never stops is the
// one thing this site keeps having to hunt down (see CLAUDE.md, "keeping a
// still page still"), and there would be six of them.
export default function PageNext({ to, label }) {
  return (
    <a className="page-next" href={`#${to}`} aria-label={`Next: ${label}`} title={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </a>
  );
}
