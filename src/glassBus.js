// What the cursor glass (reactbits/FluidGlass.jsx) and the things around it
// tell each other. Plain module state and callbacks: nothing here touches the
// DOM, so it costs nothing on a still page.
//
// 1. Where the glass is. The hero's waves are pulled into a well under the
//    lens (WaveField.jsx), so they read the glass's own eased centre rather
//    than the raw pointer, and let go as it snaps onto something.
// 2. Shapes drawn on a canvas that the glass can snap to — the 3D lanyard
//    badges (Lanyard.jsx): their four projected corners, re-published every
//    frame while one is hovered or held.

export const glassState = {
  on: false,        // shown (the pointer is on the page)
  x: 0, y: 0,       // the LENS's centre, viewport px (it keeps chasing the pointer while snapped)
  r: 64,            // the lens's radius, px
  snap: 0,          // 0 = a lens, 1 = snapped onto a target
};
const glassSubs = new Set();
export const onGlass = fn => { glassSubs.add(fn); return () => glassSubs.delete(fn); };
export const publishGlass = () => glassSubs.forEach(fn => fn());

// a virtual target: { id, quad: [[x, y] x 4] (TL, TR, BR, BL, viewport px), radius }
let virtual = null;
const virtualSubs = new Set();
export const getVirtualTarget = () => virtual;
export const onVirtualTarget = fn => { virtualSubs.add(fn); return () => virtualSubs.delete(fn); };
export function setVirtualTarget(t) {
  virtual = t;
  virtualSubs.forEach(fn => fn());
}
// let go only of your own target (two badges share the bus)
export function clearVirtualTarget(id) {
  if (virtual && virtual.id === id) setVirtualTarget(null);
}
