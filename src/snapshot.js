// A canvas still of an <img>/<video>'s current frame, for the modal's media
// flights: a still is on screen the instant it is mounted, where a new
// <video> shows its #111 background, then its poster, then a frame — the
// flash at both ends.
//
// It is the WHOLE frame, at the scale the element shows it, and the flyer
// draws it with `object-fit: cover` (App.css): the flight changes the box's
// aspect (a card's 2.3:1 or 4:3 slot to the modal's 16:9 and back), and a
// still cropped to ONE of those boxes was stretched into the other, then
// popped to the right crop at the swap (Oct 8). A `contain`-fitted gallery
// item is drawn as shown, letterbox and all. Transparent pixels stay
// transparent: the flyer's own background (Modal.jsx) carries the colour
// behind the picture from the card's to the modal's.
export const snapshot = el => {
  try {
    const vw = el.videoWidth || el.naturalWidth, vh = el.videoHeight || el.naturalHeight;
    const w = el.clientWidth, h = el.clientHeight;
    if (!vw || !vh || !w || !h) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';       // as close as a canvas gets to how the element itself is drawn
    if (getComputedStyle(el).objectFit === 'contain') {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      const k = Math.min(w / vw, h / vh), dw = vw * k, dh = vh * k;
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(el, (w - dw) / 2 * dpr, (h - dh) / 2 * dpr, dw * dpr, dh * dpr);
      return c;
    }
    const s = Math.max(w / vw, h / vh) * dpr;
    c.width = Math.max(1, Math.round(vw * s)); c.height = Math.max(1, Math.round(vh * s));
    ctx.drawImage(el, 0, 0, c.width, c.height);
    return c;
  } catch { return null; }          // a tainted or undecoded source: fall back to the live copy
};
