import React, { useEffect, useState } from 'react';
import { onScroll } from '../scrollDriver';

// The two canvas pieces' home. On a desktop it is the same fixed, behind-
// everything layer it always was (CSS: inset 0, z-index -1) and this
// component is invisible. On a PHONE (≤768px) it is a DOCK: a band across
// the bottom of the screen, above the content, with both stages side by side
// in it — the owner asked for the animation to be "viewable in mobile mode",
// and behind the text in a 390px column it was not.
//
// The dock's background is transparent while the page sits at the top of the
// hero, so the sine field shows through it, and turns solid the moment the
// page scrolls: the strands then slide down under its edge and the pieces
// form inside it, and the content that follows scrolls behind it rather than
// through the robots. A small tab collapses it for reading (remembered per
// viewer in localStorage; a per-viewer convenience, so browser storage is
// the right place, and it is wrapped because it can be unavailable).
const KEY = 'robot-dock';
const readCollapsed = () => { try { return localStorage.getItem(KEY) === 'collapsed'; } catch { return false; } };

export default function RobotDock({ children }) {
  const [solid, setSolid] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => onScroll(y => setSolid(y > 40)), []);

  useEffect(() => {
    document.documentElement.classList.toggle('dock-collapsed', collapsed);
    try { localStorage.setItem(KEY, collapsed ? 'collapsed' : 'open'); } catch { /* private window, blocked storage */ }
    // the stages and the sine field measure themselves off the layout, which
    // this changed; a resize is the signal they both already listen for
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(id);
  }, [collapsed]);

  return (
    <div className={`f3d-dock${solid ? ' is-solid' : ''}${collapsed ? ' is-collapsed' : ''}`} aria-hidden={collapsed ? 'true' : undefined}>
      {children}
      <button
        type="button"
        className="f3d-dock__toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show the animation' : 'Hide the animation'}
      >
        {collapsed ? '▴ animation' : '▾ animation'}
      </button>
    </div>
  );
}
