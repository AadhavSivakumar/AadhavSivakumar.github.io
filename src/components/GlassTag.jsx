import React from 'react';
import GlassSurface from './reactbits/GlassSurface';

// A tag as React Bits' GlassSurface (the owner, Oct 6: the glass "should be
// being used for the navbars and for the tags"): the same refracting SVG
// displacement as the header's capsules in Chromium, its frosted mode in
// Firefox and Safari. No colour split (the offsets drew blue arcs), a gentle
// distortion — a pill is 20px tall.
export default function GlassTag({ children, className = '' }) {
  return (
    <GlassSurface width="auto" height="auto" borderRadius={999} brightness={50} opacity={0.93} blur={6}
      backgroundOpacity={0.1} saturation={1.3} distortionScale={-40} redOffset={0} greenOffset={0} blueOffset={0}
      displace={0.3} className={`project-tag glass-tag ${className}`}>
      {children}
    </GlassSurface>
  );
}
