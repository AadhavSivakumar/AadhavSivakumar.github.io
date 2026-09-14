// The hero's sine field, and the choreography that turns it into the two side
// flourishes. Shared by WaveField.jsx (the full-viewport canvas that draws the
// field and splits it) and Flourish3D.jsx (which receives each half and gathers
// it into a drawing), so both agree on every number — the handoff between the
// two canvases is only invisible because they draw the SAME rows from the
// SAME constants.
//
// The field itself is the one on the old /portfolio hero, measured off its
// source rather than approximated: a 1000x350 virtual box stretched to the
// hero, 25 rows, amplitude 8, frequency 0.04 (0.02 in portrait), a per-row
// phase step of -25 degrees, opacity 0.8 at the top falling to 0.1, and the
// wave MIRRORED about the centre line — sin(|x - 500| + phase) — which is why
// it appears to breathe outward from the middle rather than travel across.
// The drift is 0.12 virtual units a frame at 60fps, i.e. 7.2 a second: about
// ten screen pixels a second, slow enough to read as the field being alive
// rather than as a screensaver.

export const ROWS = 25;
export const VW = 1000;          // virtual width
export const VH = 350;           // virtual height
export const PAD = 20;           // top/bottom padding inside the virtual box
export const AMP = 8;            // amplitude, virtual units
export const FREQ_LAND = 0.04;
export const FREQ_PORT = 0.02;
export const PHASE_STEP = -25 * Math.PI / 180;
export const A_TOP = 0.8;
export const A_BOTTOM = 0.1;
export const DRIFT = 7.2;        // virtual units per second
export const STROKE = 2;         // css px
// Field opacity over the whole layer, light and dark. /portfolio uses 0.8/0.6.
export const FIELD_A = { light: 0.72, dark: 0.55 };
// The mouse bulge from /portfolio: a gaussian lifted under the cursor.
export const BULGE = { land: 120, port: 40, radius: 40, cutoff2: 25000 };

export const rowY = i => PAD + (i / (ROWS - 1)) * (VH - 2 * PAD);
export const rowA = i => A_TOP - (i / (ROWS - 1)) * (A_TOP - A_BOTTOM);
// `d` is the distance from the centre line, in virtual units.
export const waveY = (i, d, phase, freq) => AMP * Math.sin((d + phase) * freq + i * PHASE_STEP);

// ── the timeline, in HERO HEIGHTS scrolled ──────────────────────────────
// `s = scrollY / heroHeight`, so the choreography is pinned to the hero
// rather than to the page: adding a section below does not move it.
//   0        the field, riding with the page
//   SPLIT    each row is cut at the centre and the halves travel out to the
//            two flourish stages, compressing to fit them
//   HANDOFF  the field canvas fades out and each flourish draws the same rows
//            in its own stage — a cross-fade between identical geometry
//   MORPH    the rows gather themselves into the first wireframe of each
//            piece: the camera, the laid-out motor
//   after    the pieces' own timelines run, remapped to start here
export const S_SPLIT   = [0.02, 0.53];
export const S_HANDOFF = [0.55, 0.12];
export const S_MORPH   = [0.64, 0.50];
export const S_ART     = S_MORPH[0] + S_MORPH[1];   // 1.14

export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const win = (p, lead, span) => clamp01((p - lead) / span);
export const smooth = t => t * t * (3 - 2 * t);

// ── shared live state ───────────────────────────────────────────────────
// The field canvas owns the drift phase; the flourishes read it during the
// handoff so their copy of the rows is at the same phase. The drift is
// frozen by the time the rows arrive (speed x (1 - split)), so what they read
// is a constant — otherwise a paused scroll mid-handoff would show two copies
// slowly sliding apart.
export const live = { phase: 0, freq: FREQ_LAND };

// ── hero height ─────────────────────────────────────────────────────────
let heroH = 0;
export function heroHeight() {
  if (!heroH) {
    const el = typeof document !== 'undefined' && document.getElementById('hero');
    heroH = (el && el.offsetHeight) || (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
  }
  return heroH;
}
export function invalidateHeroHeight() { heroH = 0; }
if (typeof window !== 'undefined') window.addEventListener('resize', invalidateHeroHeight, { passive: true });
export const heroPhase = y => y / heroHeight();
