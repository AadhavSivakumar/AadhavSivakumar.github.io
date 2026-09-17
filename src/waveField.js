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
//   0      the field, riding with the page
//   MORPH  straight from the big field into the drawings. Every row is cut at
//          the centre line; the LEFT half becomes the camera and the RIGHT
//          half the motor, part by part, top to bottom. There is no stage in
//          between where the rows first shrink into the side panels — the
//          owner asked for the big waves to go straight to the pieces.
//   after  the two pieces hold; nothing redraws
// The span ends at exactly 1.0 hero heights — the top of Experience, and a
// settle point (scrollSnap.js). The pieces are therefore complete at the
// moment the page comes to rest there, which is the "keypoint" the owner
// asked for.
export const S_MORPH = [0.04, 0.96];
export const S_ART   = S_MORPH[0] + S_MORPH[1];     // 1.0

export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const win = (p, lead, span) => clamp01((p - lead) / span);
export const smooth = t => t * t * (3 - 2 * t);

// ── the per-part schedule ───────────────────────────────────────────────
// Both canvases need it: WaveField moves each part's strands on it, and the
// piece fades that part's real drawing in on it. Parts are ranked top to
// bottom on screen; part r of n starts at partStart(r, n) of the morph and
// takes PART_SPAN of it.
export const PART_LEAD = 0.42;
export const PART_SPAN = 0.58;
export const partStart = (rank, n) => (n > 1 ? rank / (n - 1) : 0) * PART_LEAD;
export const partT = (m, rank, n) => win(m, partStart(rank, n), PART_SPAN);
// how visible a part's real drawing is, from its own progress
export const partArtA = pt => smooth(win(pt, 0.62, 0.38));
// how visible its strands still are
export const strandFade = pt => 1 - smooth(win(pt, 0.78, 0.22));

// ── the acts: one transition per page boundary ──────────────────────────
// After the waves have become the camera and the motor, the right-hand piece
// keeps going, a step per boundary:
//
//   Experience -> Research             right: the motor becomes an SO-ARM101
//                                      left:  the camera explodes to its sensor
//   Research   -> Major Projects       right: it becomes a Franka FR3
//                                      left:  the model runs on the pixels
//   Projects   -> Additional Projects  right: it becomes two UR arms
//                                      left:  the model returns detections
//   Additional -> Resume               left:  the detections become a world model
//
// Each act starts a fifth of the way down its first page and completes when
// the second reaches the top of the screen — which is where the page settles
// (scrollSnap.js), so every settle point is the end of an act. Measured off
// the pages themselves, and re-measured on resize or when the body changes
// size.
export const ACTS = [
  ['experience', 'research'],
  ['research', 'projects'],
  ['projects', 'additional-projects'],
  ['additional-projects', 'resume'],
];
let spans = null;
function measureActs() {
  if (typeof document === 'undefined') return null;
  const out = [];
  for (const [a, b] of ACTS) {
    const ea = document.getElementById(a), eb = document.getElementById(b);
    if (!ea || !eb) return null;
    const ta = ea.getBoundingClientRect().top + window.scrollY;
    const tb = eb.getBoundingClientRect().top + window.scrollY;
    out.push([ta + 0.2 * (tb - ta), tb]);
  }
  return out;
}
// Which act the page is in, and how far through it: `i` is the act index and
// `t` its progress. Before the first act, i = -1. Between acts (and after the
// last), the previous act is reported complete.
export function actAt(y) {
  if (!spans) spans = measureActs();
  if (!spans) return { i: -1, t: 0 };
  let i = -1, t = 0;
  for (let k = 0; k < spans.length; k++) {
    const [t0, t1] = spans[k];
    if (y >= t1) { i = k; t = 1; continue; }
    if (y > t0) { i = k; t = clamp01((y - t0) / Math.max(1, t1 - t0)); break; }
    break;
  }
  return { i, t };
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { spans = null; }, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { spans = null; });
    const start = () => document.body && ro.observe(document.body);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
}

// ── the targets ─────────────────────────────────────────────────────────
// Each piece captures its finished drawing once — every line it strokes,
// projected into its own 340x660 drawing units and tagged with its part —
// and publishes it here. WaveField reads it and flies the strands there.
// `v` bumps on every publish (a theme change recolours the lines, a resize
// re-measures) so the field knows to rebuild its plan.
export const targets = { left: null, right: null, v: 0 };
export function publishTargets(side, data) { targets[side] = data; targets.v++; }

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
