// A canvas still of an <img>/<video> exactly as it is drawn on screen (the
// element's object-fit crop), for the modal's media flights: a still is on
// screen the instant it is mounted, where a new <video> shows its #111
// background, then its poster, then a frame — the flash at both ends.
export const snapshot = el => {
  try {
    const vw = el.videoWidth || el.naturalWidth, vh = el.videoHeight || el.naturalHeight;
    const w = el.clientWidth, h = el.clientHeight;
    if (!vw || !vh || !w || !h) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const fit = getComputedStyle(el).objectFit;
    const k = fit === 'contain' ? Math.min(w / vw, h / vh) : Math.max(w / vw, h / vh);
    const dw = vw * k, dh = vh * k;
    const ctx = c.getContext('2d');
    if (fit === 'contain') { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(el, (w - dw) / 2 * dpr, (h - dh) / 2 * dpr, dw * dpr, dh * dpr);
    return c;
  } catch { return null; }          // a tainted or undecoded source: fall back to the live copy
};
