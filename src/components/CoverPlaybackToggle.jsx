import React, { useSyncExternalStore } from 'react';
import { subscribe, getPlaying, getServerPlaying, setPlaying, prefersReduce } from '../coverPlayback';

// The pause control for the auto-playing project covers (WCAG 2.2.2). Sits at
// the top of the Projects section, ahead of the first cover, so it is reachable
// before the motion it governs.
export default function CoverPlaybackToggle() {
  const playing = useSyncExternalStore(subscribe, getPlaying, getServerPlaying);

  // Under reduced motion the covers render as still images, so there is nothing
  // here to pause and the control would be a dead button.
  if (prefersReduce()) return null;

  return (
    <button
      type="button"
      className="cover-playback-toggle"
      onClick={() => setPlaying(!playing)}
      aria-pressed={!playing}
    >
      <span aria-hidden="true" className="cover-playback-icon">
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5z" />
          </svg>
        )}
      </span>
      {playing ? 'Pause project previews' : 'Play project previews'}
    </button>
  );
}
