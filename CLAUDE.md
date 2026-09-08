# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This is Aadhav Sivakumar's personal portfolio — a React 18 + Vite single-page app. It is a modernized, animation-heavy rebuild of the older static portfolio that still lives at `https://aadhavsivakumar.github.io/portfolio` (that path serves a separately built bundle; this repo is the successor).

There is no test suite or linter. Validate changes by running the app and exercising the affected section.

**Gotcha when validating animation via automated browser screenshots:** a backgrounded
or hidden Chrome tab (`document.visibilityState === 'hidden'`) throttles timers and
stops `requestAnimationFrame`, so the R3F lanyard canvas screenshots **completely blank**
and motion/anime.js entrance animations stay frozen at `opacity: 0`. That is an
environment artifact, not a bug — do not go debugging the scene. Either bring the tab to
the foreground, or force-visible the elements and spoof visibility from the page before
capturing. Prefer *measuring* the DOM (`getBoundingClientRect`, computed transforms) over
eyeballing screenshots; it works regardless of tab state.

**WebGL CAN be screenshotted here — use `scripts/webgl-shot.mjs`.** Headless
Firefox on this box cannot create a WebGL context even with every
software-rendering pref forced, and for most of this project's history the
lanyard could only be verified by simulating its maths. Chromium ships
SwiftShader, a CPU rasteriser that gives a real WebGL 2.0 context, and Playwright
(a devDependency) downloads a Chromium into `~/.cache/ms-playwright` without
root:

```
npx playwright install chromium                       # once, ~150MB, no sudo
npm run build && npx serve -s dist -l 4900 &
node scripts/webgl-shot.mjs http://127.0.0.1:4900/ '#experience' out.png
```

It prints the renderer string (`SwiftShader`), so a silent fallback is visible.
Statements below of the form "this environment has no WebGL" were true when
written; they describe why things were verified numerically, not what is
possible now. Anything touching the lanyard should be looked at this way
before it ships.

```
npm run dev        # Vite dev server
npm run build      # vite build + scripts/copy-static.mjs, into dist/ (gitignored)
npm run preview    # serve the production build locally
```

`npm run build` runs `scripts/copy-static.mjs` after Vite. That script copies the
static directories the app links to by URL (`Media/web`, `Media/skills`,
`projectpdf`, `Resume`) into `dist/`, then **fails the build if any root-relative
URL in `siteData.js` has no file behind it in `dist/`**. That check is the closest
thing this repo has to a test — see "Asset URLs" below for the bug it exists to
prevent.

## Tech stack

- **React 18 + Vite 6** — SPA, entry `index.html` → `src/main.jsx` → `src/App.jsx`.
- **motion** (`motion/react`, the framer-motion successor) — only four files import it: the header's `layoutId` nav pill and theme-toggle icon swap (`Header.jsx`), the hero and its chips (`Hero.jsx`, `HeroChip.jsx`), and the modal's phased open/close sequence (`Modal.jsx`). It does **not** drive the card reveals or the hover lift.
- **animejs v4** — the hero name's per-letter cascade, section-title letter cascades (`SectionTitle`), the scroll-scrubbed progress bar (`ScrollProgress`, via `anim.seek`), and — via `src/hooks/useScrollReveal.js` — **every scroll-into-view card entrance** on the site (`LiftCard`, `Reveal`, `Resume`'s tiles, `Contact`'s links). The hook suppresses inline CSS transitions during the entrance and clears them on completion so the CSS hover/tap states resume. Note v4 API: `ease: 'outExpo'`, tween `{ from: ... }` or `[from, to]` values.
- **three.js / @react-three/fiber / drei / rapier / meshline** — the 3D lanyard badges in the About section. This whole stack is **lazy-loaded** (see Performance below).

## Source layout

```
src/
  App.jsx                 # section composition + modal open/close state
  App.css                 # ALL styling: theme tokens, sections, cards, modal, hero, nav
  data/siteData.js        # ALL page content (see "Editing content")
  hooks/useTheme.js       # light/dark via data-theme attr + localStorage
  hooks/useScrollReveal.js # anime.js scroll-into-view entrance used by every card
  components/
    Header.jsx            # fixed nav, scroll-spy + animated gold pill (layoutId)
    Hero.jsx              # anime.js letter cascade, aurora bg, keyword chips
    HeroChip.jsx          # liquid-glass keyword pill (backdrop-filter + SVG refraction)
    SineWave.jsx          # staggered sine field behind the hero (variant="field")
    Flourish3D.jsx        # the two canvas side flourishes (see below)
    About.jsx             # the about card (the lanyard badges moved to Experience)
    badgeCards.js         # the six badge definitions + photos; Experience hangs four of them
    Lanyard/Lanyard.jsx   # multi-band physics lanyard (see below)
    Projects.jsx, ProjectCard.jsx
    Skills.jsx, SkillGroupCard.jsx
    Experience.jsx        # four rows: a big card + that organisation's lanyard badge in its own 3D canvas
    Resume.jsx            # Resume / Extended CV / Transcript tiles (Drive embeds)
    Contact.jsx, Footer.jsx
    Modal.jsx             # single reusable modal; phased lift->expand->populate
    LiftCard.jsx          # shared card: anime.js entrance (useScrollReveal) + CSS hover lift (no tilt)
    Reveal.jsx            # shared fade/rise-on-scroll wrapper
    SectionTitle.jsx      # anime.js letter-cascade h2 + underline draw
    ScrollProgress.jsx    # top progress bar, anime.js scrubbed by scroll
scripts/
  copy-static.mjs         # post-build asset copy + referenced-asset existence check
```

`legacy/` holds pre-React versions of the site — archive only, never edit to change the current site, and **not deployed**. `misc/` is unreferenced data and is likewise not deployed. `Media/` holds local images:

- `Media/lanyardimgs/` — badge photos, *imported* by `About.jsx` so Vite bundles them.
- `Media/projects/` — the full-size originals (hundreds of MB, including per-project subdirectories of raw footage). **Not deployed, and nothing on the site links to them.**
- `Media/web/` — the web-sized derivatives the site actually serves, built from those originals. Deployed.
- `Media/skills/` — skill icons. Deployed.

`projectpdf/` and `Resume/` hold PDFs served from this repo.

## Editing content (not markup)

All page content lives in `src/data/siteData.js`:

- `aboutMeData` — about card + modal (title, teaser, `modalContent` blocks).
- `majorProjectsData` / `smallProjectsData` — project cards. Shape: `{ id, title, cardDescription, imageUrl, tags, status, modalContent }`. `modalContent` is an array of `{ type: 'text' | 'button' | 'embed' | 'image', ... }` blocks rendered by `Modal.jsx`. Preserve existing `id` values.
- `skillGroupsData` — skill category cards; each group has `items` of `{ name, imageUrl, description }`.
- `experienceData` — the Experience section (`Experience.jsx`): `{ id, org, role, location, period, summary, bullets, tags }`, rendered inline with no modal because it is the section a recruiter reads.
  **It is written for a public page.** Industries and public events are named; customers, contract values, internal contact and colleague names, internal infrastructure, unreleased product plans and anything the owner's own notes flag `[confirm]` or NDA are not. The owner's resume source material is far richer than what is here — that is deliberate, not an omission.
- `resumeDocsData` — the four document tiles (Resume, Extended CV, two transcripts), each `{ id, title, badge?, embedUrl }` where `embedUrl` is a Google Drive `/preview` link.

The lanyard badge content (name/role/ID/EXP + photo per badge) lives in `src/components/badgeCards.js`, with photos imported from `Media/lanyardimgs/`. Each `experienceData` row names its badge with `badge: '<name>'`.

To add a project or skill: append to the relevant array — the components map over the data, no other wiring needed.

### The site is positioned for robotics / ML / computer-vision roles

That is the owner's stated goal, and three things follow from it:

- **`skillGroupsData` order is deliberate**: Machine Learning & Computer Vision
  first, Robotics & Control second, then Programming, Embedded, Design, Sensors.
  The group a recruiter screens on leads. It used to be fourth, with four vague
  items ("AI Vision", "Gen AI API").
- **A skills list is a set of claims. Every item must be backed by something
  else on the site** — a project, the job title, a tool already listed.
  Frameworks that are not yet evidenced anywhere (PyTorch, TensorFlow, ONNX,
  TensorRT, OpenCV, CUDA…) are deliberately ABSENT until the owner confirms
  them, however likely they are. Do not add them on inference.
- **`majorProjectsData` is exactly the four the owner chose**: Glass-2-Bot,
  SMART compost sorting, Stockbot, 3D Fruit Ninja, in that order. Everything
  else — including Sluice and the tactile sensor — is in `smallProjectsData`,
  strongest first. Preserve `id` values when moving entries between the two
  arrays; a card promoted to major needs a `cardDescription`, which small cards
  do not use.
- Metadata (`index.html` title/OG/description) names "Robotics & Computer
  Vision Engineer" and the JSON-LD `Person` block carries role, employer,
  degrees and profile links. **Every value in that block is a fact already
  stated on the page**; if the bio changes, it changes too.

What only the owner can supply, and has been asked for: the exact ML stack,
what the Roboflow role involves, per-project outcomes with numbers, GitHub
repo links per project, and any publications.

### Asset URLs

Content images are referenced by **root-relative** URL — `/Media/web/projects/…`,
`/Media/skills/…`, `/projectpdf/…` — from the three `base*Path` constants at the
top of `siteData.js`. Root-relative means dev, `npm run preview` and production
all fetch the same files; do not reintroduce absolute
`https://aadhavsivakumar.github.io/…` URLs, which made local runs silently serve
production assets. Locally *imported* assets (lanyard badge photos, GLB,
textures) are bundled by Vite and are unaffected by any of this.

**The bug this section used to describe, and how it is now prevented.** Commit
`1c975e5` (Dec 2025) renamed `Images/` → `Media/`; `siteData.js` kept pointing at
`/Images/…`, and an earlier version of this file asserted those URLs "resolve
against assets deployed elsewhere". They did not — **50 covers and skill icons
404'd in production for eight months** and nobody noticed, because a missing
image degrades to a placeholder tile rather than an error. `npm run build` now
fails when a referenced asset is missing (`scripts/copy-static.mjs`), so a
repeat of that rename cannot reach production.

**Adding a project/skill image.** Put the original in `Media/projects/` (or
`Media/skills/`), then commit a web-sized derivative under `Media/web/projects/`
and point `siteData.js` at the derivative. Covers should be ≲1 MB; the originals
run to tens of MB each and are not deployed. A `.mp4` cover **must** ship a
`<name>-poster.webp` beside it: `ProjectCard.jsx` derives the poster URL by that
convention, uses it as the `poster`, and the build check enforces its existence.

## The 3D lanyard (`src/components/Lanyard/`)

ID badges on physics ropes, ported from the ReactBits lanyard and heavily
extended. **Seen rendering for the first time on 2026-09-07** via the WebGL
harness above: black cards, legible type, one pin each, centred — the material
and layout work verified by simulation held up. **They hang beside the
Experience rows now** — one badge per row
(Roboflow, Starship, NYU, UCSC), each in its own small `<Canvas>` in the
300px `.exp-lanyard` column, mounted only once its row comes within 600px of
the viewport (`useNearViewport`) so four WebGL contexts are not created on
page load. The About section is just the card; its full-width six-badge strip
is gone (the owner asked for the badges next to their boxes — "the lanyard",
definite article — and duplicating six badges was not worth the GPU memory).
Two badges from the old strip, Dublin High and "Researcher", have no row and
are not rendered; their data is kept in `badgeCards.js`. **The `.exp-lanyard`
column is a FIXED 460px, sticky, never stretched to the card**: the camera's
field of view is vertical, so a canvas that grows with a seven-bullet card
renders its badge at over twice the size of the one beside a one-bullet card —
seen, not guessed (300x1050 next to 300x440, the tall one running off the
screen). Badge scale is `sizeMul` 1.6 in a 300px column. A lone badge uses
`side: 'center'`, because the left/right anchor maths always clears the centre
by half a card plus a gap, which is right for a pair flanking a card and wrong
for a badge with the column to itself. Key invariants learned the hard way —
keep them:

- **Rope joint offsets are module constants** (`J1_POS`…`CARD_POS`). Passing fresh arrays on re-render makes rapier teleport bodies and tears the straps.
- **The chain spawns vertically at equilibrium.** A horizontal spawn makes neighboring cards collide mid-drop and fall asleep at a diagonal.
- **`BandField` debounces resizes (300ms) then remounts bands via key** — physics bodies don't follow anchors when the canvas aspect changes.
- **The strap-smoothing lerp alpha is clamped to 1.** Unclamped, `delta * 50` exceeds 1 below 50fps and `Vector3.lerp` extrapolates, exploding the straps into screen-height streaks.
- When the viewport can't fit 3 badges per side, outermost badges are dropped instead of stacking (the fit test is in `BandField`, comparing `inner + (n-1)*step` against the half-world width). Note the ≥992px gate in `About.jsx` admits widths where 2 of the 6 badges are already dropped.
- **The card has to hold its contrast against the environment, and that is a
  MATERIAL problem, not an artwork one.** Simulated through the material's own
  maths (flat card, ambient + IBL diffuse + GGX specular + clearcoat lobe, ACES
  tonemap — this environment has no WebGL, so the render cannot be looked at;
  re-checked against the software rasteriser with two sets of prefs): at
  `envMapIntensity` 1 with `clearcoat` 0.25, a brightening environment washes
  the black card from value 3 toward 118 and text contrast collapses from
  12.2:1 to 4.2:1. The fix is scoped to the CARD rather than to the scene's
  lights — `envMapIntensity` 0.45, `clearcoat` 0.10, and an **`emissiveMap` of
  the card's own texture** so the artwork adds light shaped by itself: light
  text emits, the dark card does not, and the separation survives whatever the
  environment does. Same simulation: 9.9:1 at the brightest, card at 59.
  Emissive is lower on the pale card (0.18 vs 0.55), where it is the BACKGROUND
  that emits and too much of it clips the card to flat white.
  The simulation is `shade.mjs`-style and worth redoing if these are retuned.
- **The badge material is a printed card, not a piano.** It shipped as
  `clearcoat: 1` / `clearcoatRoughness: 0.1` / `metalness: 0.35`, which against
  the Environment's intensity-10 Lightformer threw a specular sheet across the
  face and washed the name and role text out. A laminated badge does have a
  slight sheen, so the clearcoat stays — weak and diffused (now 0.10 / 0.5, see
  the material bullet above) with `metalness` down to 0.04. Metalness in particular has no business here: it
  tints the reflection by the base colour and darkens the diffuse term, which is
  the opposite of what a white printed card does with light.
- Badge faces are composited onto the card GLB's texture atlas at runtime (front = ID-badge layout, back = full-bleed photo). Front UV rect = left half of the atlas, back = right half.
- **The card INVERTS against the page**: near-black card with pale type on the
  light site, pale card with dark type on the dark one (`siteDark` argument to
  `drawBadgeFace`; `theme` is a dependency of the `cardMap` memo, so the atlas
  is rebuilt and the old one freed on a toggle). This is the reference look —
  Vercel's 3D event badge, the Framer lanyard — and it is also why the text is
  readable at last: a white card is the worst possible ground here, because the
  Environment's Lightformer ADDS light, so the card blows out toward white and
  takes the dark text with it. On a dark card the same specular lands on top of
  LIGHT text and the text survives. Type went up a size at the same time
  (name 15→19, role 11→12.5).
- The BACK face stays a pale field in both themes on purpose: it carries logo
  artwork, some of which is dark-on-transparent and would vanish on black.
- `badgeprobe.html` + `src/__badgeprobe.jsx` render the badge ARTWORK to a plain
  2D canvas, both themes, all six cards. The 3D scene needs WebGL, which this
  environment does not have; the artwork does not, so this is the only way to
  see badge changes from here. It does NOT verify how the card looks lit.
- **Runtime textures are freed by whoever built them, and only by them.** The
  pegboard grid, the dark-theme inverted strap and the per-badge composite atlas
  are built at runtime — but each of those code paths can also return a SHARED
  texture it did not create (`materials.base.map` from the cached GLTF, or the
  `useTexture` result), which drei hands to every other badge too. Disposing one
  of those blanks the strap or the card face on every other badge, and `useGLTF`
  caches the GLTF so it does not come back on remount. So disposal is keyed on a
  mark set at construction (`own()` / `useOwnedTexture`), never on "is this a
  texture". This is load-bearing because `BandField` remounts every band by key
  on a resize, and each band rebuilds its own copy of the 1678×1677 atlas —
  14.3 MB on the GPU with mips, ~86 MB for a set of six, leaked per settled
  resize before this.
- **The drag target is CLAMPED to the visible world box.** It used to be
  whatever the pointer projected to, with nothing stopping it leaving the
  canvas: drag a badge toward the bottom and it left the frame and was gone.
  Simulated rather than eyeballed (no WebGL here, so the scene cannot be
  clicked): of six sample pointer positions, four put the card outside the
  visible box before, none after. The clamp keeps the card's CENTRE inside, not
  the whole card — requiring the whole card left barely any downward travel,
  and a drag you cannot move is a worse bug than the one being fixed.
- **How far back the pegboard has to be is a calculation, not a nudge.** A card
  FLIPPING sweeps its corners through z by its own half-width — the largest
  badge is scale 1.5 and its collider half-width 0.8, so ±1.20 world units. The
  board sat at -0.35, less than a third of that, so every flip drove a corner
  through the panel and the badge was sliced. It is at -1.75 now, with
  `CARD_MIN_Z` (-0.25) holding the card's centre so the sweep is measured from a
  known place: 0.30 of clearance behind the worst case. If the badge scale or
  `sizeMul` ever changes, redo that sum.
- Releasing a drag hands the drag velocity to the now-dynamic body (clamped),
  because a kinematic body carries no velocity into the dynamic state and every
  release used to kill the swing dead. The drag itself eases toward the pointer
  rather than teleporting onto it, so the strap leads and lags instead of
  snapping taut every frame.
- **The pitch damper acts about the card's OWN pitch axis, transformed to
  world.** It used to be applied about world x, which is the body's x only while
  the card faces forward; after a click-flip the body's x points the other way,
  so the damper pushed pitch AWAY from its target and a hovered, flipped card
  wound itself up instead of settling. Reproduced numerically: a 0.20 rad error
  went to 0.193 at yaw 0 and to 0.207 at yaw π; through the body axis, 0.193 in
  both. The hover target's sign follows the flip for the same reason — "top
  toward the viewer" is the opposite local pitch on a card facing away.
- Interactions: drag (kinematic), click (<350ms, small movement) flips the card via a yaw target + torque kick, moving cursor applies a small repulsion impulse (sway), and hovering leans the card toward the cursor (yaw/pitch targets in the frame damper — the 3D tilt lives here, not on the HTML cards).
- **The badges hang from a beige pegboard, not a rail.** A straight full-width crossbar over six equal-length vertical straps in one dead-flat rank reads as *prison bars* — that exact combination was rejected. `LanyardRack` now renders a perforated beige masonite panel (tiling hole-grid canvas texture, theme-aware) with a ball-headed pin per badge, and `SLOT_RISE_BY` + `hangJitter()` stagger the pins slightly so they sit near-level but never in a rigid rank. Keep the stagger subtle: too much and the outer rings clip the top of the frame.

## The side flourishes (`src/components/Flourish3D.jsx`)

Two decorative pieces fixed to the viewport, one per side, mounted in the
`page-flourish-layer` in `App.jsx` and scrubbed by page scroll. They are
skipped only when `navigator.hardwareConcurrency <= 4`.

**They are NOT gated on width.** They used to be hidden below 992px, which
meant every phone saw none of them. The stage now sizes itself from CSS
(`--fw` / `--fh` on `.f3d`) and the renderer reads that back and scales its
output to match, so a phone gets a smaller, cheaper canvas rather than nothing:
0.45 megapixels of backing store at desktop, 0.14 at phone width, with the
device-pixel-ratio cap dropping from 1.5 to 1.25 there as well.

**W and H inside `Flourish3D.jsx` stay 340x660 whatever the viewport does.**
That is the DRAWING coordinate system, and every fit, camera constant and LOD
threshold in the file is expressed in it — only `ctx.setTransform` changes.
Resize the stage in CSS and nothing about the composition needs re-tuning.

On mobile the two pieces are staggered VERTICALLY (left around 29vh, right
around 73vh) rather than pulled off the side edges. Retreating horizontally was
tried first and reduced them to slivers — technically visible, which is not the
same thing as visible. The vertical offset is what stops both landing behind
the same paragraph.

- **LEFT — "Detection"**: a camera **tears itself apart** — six pieces, each
  with its own direction and spin, thrown far enough to leave frame — down to its
  **sensor**;
  the sensor resolves into **pixels**; the pixels are cut into **patches** and
  flattened into a token sequence (the move that defines a **Vision
  Transformer**); the tokens **attend** to each other and the map collapses onto
  a few strong links; the result is a **detection** — box, corners, label,
  confidence.
- **RIGHT — "Down the Shaft"**: an electric motor threading itself together on
  one axis in assembly order — shaft, rotor, wound stator, bells, finned frame,
  fan cowl — then running.

### ONE renderer: Canvas2D. Do not add a second one you cannot see.

A WebGL2 backend was built, shipped and then REMOVED. It worked — the owner
confirmed it looked the same as Canvas2D on a real GPU — and on paper it is the
better engine: ~15 draw calls a frame instead of ~573, hardware depth sorting,
no per-frame allocation, and lighting per pixel instead of per face.

It came out because **this environment has no WebGL at all, not even software**,
so nobody working on this file can look at what the GL path draws. That is not a
theoretical problem: two real bugs shipped in it, and both were caught by
simulating the maths in JS rather than by seeing them —

- the camera matrix was uploaded untransposed, which skewed the entire scene
  while still looking plausible;
- face culling was disabled on the reasoning that the depth buffer sorts anyway,
  which exposed every inconsistently-wound face lit by an inverted normal.

The Canvas2D path is screenshotted on every change (see Verifying, below), which
is why every other defect in these pieces got caught before it shipped. A
renderer that can only be verified numerically is a renderer whose visual
regressions reach production.

If the geometry ever genuinely outgrows Canvas2D again — the ceiling is the
DRAW-CALL count, ~573 today, one per shaded face — the answer is either fewer,
larger shaded masses, or a rendering path that can be seen from wherever the
work is being done. The GL implementation is in git history at `4914316` and
`5cbdcdf` if it is ever wanted back.

### The Canvas2D renderer, and why the DOM version is gone

This was CSS 3D: every part a div inside a `transform-style: preserve-3d` tree.
It looked right, but the browser had to re-sort and re-rasterise every element
in both trees on every camera change. Measured with geckodriver, rAF intervals
during a scripted scroll:

| | frame time |
|---|---|
| no flourishes at all | 17.2 ms |
| DOM, 356 elements | 33.2 ms |
| DOM, 261 elements (27% trimmed) | 33.2 ms — **no better** |
| canvas, ~1,900 segments/frame | **17.1 ms** — same as drawing nothing |

The DOM cost is **not linear in element count** in that range: the work
overruns the 16.7 ms budget either way and the frame drops to the next vsync.
Coming back under would have needed roughly a 5–10× cut, which deletes the
detail the pieces exist for. Doing the projection in JS and stroking paths
removes the expensive part entirely — the compositor sees one element per side —
and makes complexity nearly free.

**Do not "optimise" this back into DOM elements, and do not reach for SVG**
(same per-node cost, and it cannot do 3D at all). three.js would work but pulls
the whole WebGL stack onto every page and dies on machines without a GPU — the
lanyard already proves that failure mode. Pre-rendered video (Manim, Blender)
is a legitimate technique for a fixed explainer, but it cannot follow the live
theme toggle, the viewport, or scroll position without shipping megabytes.

### Line art, not shaded solids

**These pieces are LINE ART.** The masses (frame, bells, cowl, shaft, cores,
camera body, lens) are still SURFACES — quads with a normal, depth-sorted — but
their only job is to OCCLUDE. They are filled with the page colour, nudged a
little off it, so a line passing behind a body disappears instead of crossing
it. Everything you actually read is the 1px stroke on top.

It shipped the other way round first: a full Lambert + Blinn specular +
environment-reflection model at alpha 1, with the linework under it at alpha
0.13, over a 0.58-black vignette painted twice. The assembled motor arrived as
a brown lump. The owner asked for wireframe, less shading and less shadow, and
the reference is the anime.js site — 1px monochrome strokes on a warm near-black
(`#252423`), a grey ramp, and one saturated accent used sparingly.

- A face is `{ v: [...], n: [x,y,z] }`; normals are computed once in local space
  and rotated per frame by the part's matrix (uniform scale only, so no
  inverse-transpose needed).
- **Back-face culling is done by screen winding** (signed area after
  projection), which needs no view-space normal.
- **Lines go in the SAME depth bucket as the faces** (`submitLines`), which is
  what makes hidden-line removal work. Stroking everything after the fills —
  which is what the first attempt did — leaves every internal edge showing and
  the piece reads as a ball of wire. Lines carry a small `LINE_BIAS` toward the
  viewer so a line lying on a surface wins against its own body.
- `submit()`/`submitLines()` collect for the WHOLE frame; `flush()` sorts back
  to front and draws. Sorting globally rather than per part is what lets the
  rotor read as being inside the frame.
- The tone of a fill comes from THREE cheap terms — a key light, a hemispheric
  sky term so an upward face is never as dark as a downward one, and a grazing
  term that lifts the silhouette of a curved body. Still no specular and no
  environment reflection: what made the old version look like photographed
  metal was GLOSS, not shading. A single key light alone leaves the unlit side
  of a cylinder a flat slab.
- **Detail is level-of-detail.** Every part may carry a `detail` array of fine
  polylines — bolt circles, lamination sheets, circlip grooves, lid screws,
  blade ribs — submitted only when the part's projected radius exceeds
  `LOD_PX` (44). Below that it is a smudge that costs exactly what it costs
  when readable. This is what makes it possible to keep ADDING detail without
  the frame getting slower.
- **Parts that fall off the stage are skipped entirely.** One projection of the
  part origin plus its own radius gives a screen bound; during the explosion
  several parts are outside the 340x660 canvas and were being projected, lit,
  sorted and drawn into a clip.
- **Nothing in the draw loop allocates.** `cam()` writes into one reused triple
  rather than returning a fresh `[x,y,z]` per vertex (5,000 a frame), and every
  projected point goes into one growable `Float64Array` whose cursor resets per
  frame, instead of an array per face and per polyline.
- **The heaviest thing was never geometry, it was PIXELS.** Two changes worth
  more than any of the above on a real machine: the device-pixel-ratio cap is
  1.5 rather than 2 (0.90M backing-store pixels to 0.50M on a retina screen —
  44% less rasterising, and invisible from here because this box reports a
  ratio of 1), and the ground gradient moved back to CSS because it was a
  full-canvas `fillRect` on EVERY frame for something that never changes.
- **The redraw rate adapts.** Each draw is timed and the interval set to about
  eight times its cost, clamped to 32-120ms, so a piece that is expensive on a
  given machine is simply drawn less often. This is the only lever that responds
  to hardware nobody here can measure.
- **Bodies sit OFF the page, not on it.** A fill of exactly
  `--background-color` reads as a HOLE in the dark theme, because the page
  carries its own gradient and is lighter than its own token where the art sits.
- **The motor's parts are separated by MATERIAL** (`MAT` / `MAT_HEX` /
  `MAT_W`): steel, iron, aluminium, copper, dark polymer, painted housing.
  Assigned so that no two NEIGHBOURS along the exploded strip share one. Two
  rules learned by getting them wrong:
  the weight has to fall as the part gets bigger — a tint worth 0.3 on the
  shaft is invisible, and the same 0.3 on the housing turns the assembled
  machine into a coloured blob and throws the line art away; and the LINEWORK
  should carry most of the difference (`MAT_LINE_W`), because a line costs no
  area. The light theme needs ~1.55x the weight, because its bodies sit near
  white and a pale tint mixed into near-white barely moves.
  The vision side stays on `MAT.neutral` — its colours already mean something.
- **`flush()` sorts by depth SLAB, then by style, not by exact depth.** Exact
  depth is correct but interleaves styles, so almost nothing merges into a
  shared draw call; giving each part its own material made that 20% worse.
  Within one thin slab (1/56th of the depth range) the geometry is at the same
  depth anyway, so grouping by style there is invisible and whole runs collapse
  — 680 draw calls a frame down to 353, better than the 564 from before
  materials existed. Fills sort before lines within a slab so a line still sits
  on top of its own body. A/B'd against exact-depth sorting: under 1% of pixels
  differ, and most of that is the propeller being at a different rotation phase
  between the two captures.
- **The ramp is WARM at both ends** (`WARM_HI` / `WARM_LO`), not `#fff`/`#000`.
  The page is warm off-white over warm near-black with a gold accent; dead
  neutral grey linework and fills read as foreign on it. The structural line is
  pulled 18% toward the accent for the same reason. Gold still means the optical
  path and the detection, copper the winding.
- **The pieces must repaint when the theme changes.** `themeWatch` calls
  `repaint()`, which redraws at the current progress. It used to call the
  piece's own scroll handler, which stopped existing when the listener moved to
  the shared driver — after that every theme toggle threw
  `onScroll is not defined` and the art kept the PREVIOUS theme's colours until
  something happened to scroll the page.
- **An occluder does not have to be the real profile.** The frame's fill is a
  plain cylinder while its wireframe keeps the serrated fin profile. Filling the
  serration made the assembled machine a scalloped barrel with a dome on each
  end, which read as a beehive. A technical drawing solves it the same way: a
  clean silhouette with the fins drawn ON it.
- **The winding has to clear the core or it is invisible.** End turns at r=50
  inside an r=62 stator were hidden by the stator's own surface — the whole
  strip measured 92 warm pixels. They bulge to r=64 now.
- Tessellation: bodies are 20-24 segments around; below about 16 the facets band
  visibly. There is headroom — ~3,900 segments and ~670 draw calls a frame still
  measures free (p50 17ms with the flourishes shown AND hidden).

### Fitting the art to the stage

The stage is 340x660 and the art has to stay inside it. Do not eyeball this —
there is a measurement for it (see Verifying): the ink bounding box read
straight off the canvas, per side, per scroll position.

- **The motor's scale is SOLVED every frame, not ramped.**
  `k = MOTOR_RUN_PX / (currentSpread + MOTOR_LEN)`, clamped. A fixed
  "small while spread, larger once closed" ramp gets it wrong, because the strip
  is longest in the MIDDLE of the sequence — parts still far apart while the
  module has already grown — not at the start. Measured, that ramp put the motor
  338px wide in a 340px stage and running off the top for the first third of the
  page.
- **The axis is steep (~69 degrees on screen).** It used to be 41, chosen as
  "the diagonal", but the diagonal of a 340x660 box is 63 degrees. The parts
  have diameter as well as length, so the fit test has to include their radius.
- **`LAID_OUT` values are OFFSETS added to where a part already sits.** The fan
  is modelled at z=-130, the front bell at +122. Adding a station on top
  double-counts, which is why the strip used to bunch in the middle with holes
  at both ends. The numbers are (target - natural centre), for targets evenly
  spaced 220 apart.
- The convergence stagger is derived from `MOTOR.length`. Hard-coding 0.10 per
  part stopped working the moment there were more than six.
- Anything that indexes a part must index it BY ID. The copper was `conv(2)`,
  which was the stator until the fan was inserted ahead of it — after that the
  winding converged on the fan's schedule.

**The camera comes apart along its own optical axis**, in assembly order, each
piece holding its orientation: lens groups forward off the front, top plate
straight up, shells back off the rear. It used to throw all six on their own
diagonal with 130-260 degrees of tumble each, which read as an explosion in a
bin rather than a teardown. Each piece carries its OWN wireframe — deriving one
from the face list wires every triangle of a lathe's end-cap fan and the lens
front comes out as a sunburst.

**There is a PROPELLER on the drive end, and it keeps turning.** Each blade is
a twisted surface — walk out along the span and lay the chord across a direction
that is part tangential and part axial. That angle is the pitch, and it has to
fall from root to tip (34° → 12° here) or the blade reads as a flat paddle
rather than a screw.

**The free-running spin is the one thing on the page that animates without the
scroll driving it**, which is a deliberate exception to the idle rule above, so
it is fenced in: the motor side only, only past p 0.80, capped at 20fps, and
rAF stops it dead when the tab is hidden. Verified by sitting still for three
seconds — 0 redraws mid-page on both sides, ~45 on the right at the bottom.
If you add anything else that animates off the scroll, fence it the same way
and re-run that check.

**The motor STARTS as a laid-out exploded view and comes together.** That is
the shape every reference exploded view of a motor uses (the owner supplied
four): the axis near horizontal, the parts strung along it in assembly order —
fan cover, endbell, rotor, stator with its copper, housing, front endbell — with
gaps wider than the parts are long. `LAID_OUT` holds those stations; each part
converges on its own staggered window so the machine builds back to front, and
the whole module is drawn small while spread and grows as it closes.

**The copper must project past the core.** In every reference the windings are
the one strongly coloured thing in the strip. The bars themselves sit at r=44
inside a closed stator body and are invisible from the side, so the END TURNS
bulge out to r=50 past both ends of the stack — that is what carries the colour.

**The motor is a spinning axle that parts are threaded onto.** The shaft starts
turning the moment it lands (`revs(p)`, ~7 accelerating revolutions across the
page) and everything mounted on it — rotor, winding — turns with it, so each
arriving part is being added to something already running. It ends FULLY
ASSEMBLED with every feature on it.

That is a deliberate reversal: an earlier version opened back up into a held
exploded view at p 0.62, on the reasoning that a solid shaded body hides its own
internals. The owner asked for the opposite — parts accumulating onto the axle,
all features ending up on the motor — so the internals being hidden at the end
is the accepted cost. The exploded language now lives on the LEFT side, where
the camera tears itself apart properly.

Measured cost of shading: unchanged. p50 17.1ms with the flourishes against
17.3ms with them hidden, and 17.0 vs 17.0 on a static page.

### How it is put together

- Geometry is **arrays of polylines in local 3D space**, built ONCE at module
  scope. Per frame the draw loop only transforms points and strokes them.
- A **placement** is a 3×3 matrix plus a translation (`place`, `chain`). Each
  part composes: arrival offset → module tilt → spin → camera.
- The camera is a plain perspective divide, `PERSP = 600`.
- `stroke()` / `fill()` take a whole GROUP of polylines and emit ONE
  `beginPath`…`stroke`. Keep it that way: the draw-call count should stay in the
  dozens however many segments there are. The photosite grid, for instance, is
  bucketed by brightness into 4 fills rather than 48.
- **Surfaces of revolution** come from a meridian profile: `meridian(prof, θ)`
  walks up the `+r` side and back down the `−r` side, which as a stroked
  polyline IS the lathe cross-section. In canvas this needs no `clip-path` and
  no `evenodd` hole — that scaffolding existed only because a div can only be
  clipped, not stroked.
- **Profiles are real**: units of roughly one millimetre of an **IEC D80 frame**
  — AC 159 frame OD, D 19 shaft, E 40 shaft extension, H 80 shaft height. If you
  re-profile it, take numbers from a dimensional drawing.
- The fins are a **serration in the profile itself**, so they show in section on
  every meridian blade.

### The scroll driver must leave the page idle

Hand-rolled on purpose: one passive listener, at most one rAF in flight, and no
redraw unless progress actually moved by >0.0004. **anime.js is not involved.**

This is the bug that made the site laggy, and it is worth not repeating:
`onScroll({ sync: <number> })` adds weighted catch-up that **never settles** —
on a completely static page it kept rewriting the scene ~1,200 times a second.
`sync: true` is a plain 1:1 scrub; a numeric sync is a permanently busy main
thread. Same class of bug elsewhere on the page, both now fixed: infinite CSS
animations in the hero (paused via `.hero--idle` from an IntersectionObserver),
and the lanyard `<Canvas>` (`frameloop` gated on visibility) — rAF is only
throttled when the whole TAB is hidden, never when something scrolls out of view.

### Composition lessons that survived the rewrite

- **Density is the whole ballgame.** Past roughly 45 connectors between
  clustered anchors the individual lines stop being separable — an earlier
  network with 62 edges read as a hairball.
- **Connectors sharing an origin must FAN.** The attention links all run from
  the CLS token to a sequence receding along Z; without an X spread they were
  near-collinear and filled in as one solid wedge.
- **One meaning per colour**: gold = optical path and structure, slate = compute
  (patches, tokens, attention), rust = the result, copper = the motor winding
  and nothing else.
- **A cylinder made of longitudinal slats reads as a fence.** Circumferential
  rings follow the perspective ellipse and read as a turned body.
- **A coil wound around the shaft axis is a SOLENOID, not a motor winding.**
  Copper belongs in the stator slots with end turns.
- **Radial features can only stick out sideways** — the motor's axis is
  near-vertical on screen, so mounting feet and a lifting eye were built and
  removed. Flank features (terminal box, nameplate, conduit) are where detail
  belongs.
- **Detail hidden inside an opaque shell is noise, not detail.**

### Verifying

Screenshot it — these are canvas pixels, so headless Firefox renders them fine
and the blank-screenshot gotcha at the top of this file does not apply.

`probe.html` + `src/__probe.jsx` are IN THE REPO and are the harness: they mount
only `<Flourish3D>` on a plain page with a tall spacer, so scroll fraction maps
straight onto progress and the whole 340x660 stage is visible with its bounds
outlined. Vite only builds `index.html`, so neither reaches `dist/` — verified.
They were deleted once and had to be rebuilt from scratch; leave them.

Two measurements do most of the work, and both beat looking at it:

- **The ink bounding box, read off the canvas.** Walk `getImageData`, ignore
  pixels dimmer than the ground gradient, and report the box plus which stage
  edge it touches. This is how the composition problems above were found and
  fixed; screenshots alone had missed all of them.
- **Draw calls and frame cost.** Wrap the 2D context's `fill`/`stroke` to count
  calls per frame, and compare rAF intervals with `.page-flourish-layer` shown
  vs `display: none`. `canvas.dataset.segs` reports segments drawn.

## Scrolling, and keeping a still page still

**There is ONE scroll listener on the page** (`src/scrollDriver.js`): one passive
listener, one rAF, subscribers called with `(scrollY, progress)` from inside that
frame. The progress bar, the header shadow and both flourishes go through it.
The document height is measured on resize and by a `ResizeObserver` on `<body>`,
not inside the handler — reading `scrollHeight` per event forces a layout flush,
which is what two of the four old handlers did.

Be honest about the size of that win: **browsers already coalesce scroll events
to one per frame**, and the forced layout measures 0.04 ms on this page (~0.2% of
a frame). Consolidating the listeners bought no measurable frame time. It is
worth having because it puts the idle invariant in one place, not because it
made scrolling faster — do not cite it as a performance fix.

**The thing that actually costs, every time, is an animation that never stops.**
`rAF` is throttled when the whole TAB is hidden and never when an element merely
scrolls out of view, so anything looping must be switched off explicitly. Known
instances, all fixed, all found by measuring DOM mutations on a *still* page:

- `onScroll({ sync: <number> })` in anime.js — never settles, ~1,200 scene
  rewrites/second on a static page. Use `sync: true` or a hand-rolled driver.
- The hero's infinite CSS animations — paused via `.hero--idle` from an
  IntersectionObserver.
- The lanyard `<Canvas>` — `frameloop` gated on visibility.
- **The hero scroll-cue arrow** — a `motion` loop, so `.hero--idle` did nothing
  to it (that class only stops CSS animations). It was rewriting inline styles
  ~37×/second with the hero scrolled off the top. Now gated on a `heroOnScreen`
  state from the same observer.

The check that catches all of them, and the number to keep at zero:

```
scroll past the hero, hold still, count DOM mutations for 3s
  before: ~105    after: 0
```

## `header` is a global element selector — do not use `<header>` inside a component

`App.css` styles the bare `header` element as the fixed site header
(`position: fixed; top: 0; width: 100%`). Any `<header>` rendered anywhere else
on the page — inside a card, an article, a list item — is torn out of its
parent and pinned to the top of the viewport over the nav. This happened to the
Experience cards' role/employer/period block. Use a `<div>` for in-component
headers, or scope that rule before adding a second `<header>`.

## Modal animation contract

`Modal.jsx` runs a phase machine: `lift` (card rises off the page from its
captured rect) → `expand` (grows to the modal rect) → `open` (content staggers
in via motion variants); closing reverses it (`departing` → `collapse` →
`settle`). Motion animates `top/left/width/height/scale/boxShadow` inline —
**do not reintroduce CSS transitions on those properties on
`.modal-animator`** or the phases will fight them. The clicked card is hidden
during the sequence via the `animating-out` class that `App.jsx` toggles.

## Performance rules

- The Lanyard is imported with `React.lazy` in `Experience.jsx` and only rendered at ≥992px (and only once a row is near the viewport), so mobile never downloads the three.js stack or the 2.4MB `card.glb`. Verified: the `Lanyard-*.js` chunk is not requested until the Experience section is scrolled to. `vite.config.js` deliberately has **no `manualChunks`** — Rollup's automatic splitting keeps the 3D stack inside the lazy Lanyard chunk. A hand-rolled split was tried and created a vendor↔three chunk cycle that broke React at runtime; don't reintroduce one. After touching `vite.config.js`, re-verify `dist/assets/index-*.js` has no static `from"./..."` import of a chunk containing three.js.

## Theming

Light/dark is driven by CSS variables under `:root` and `html[data-theme="dark"]` in `App.css` (`--accent-color` gold `#C5A35C`/`#D4B47C`), toggled by `useTheme`. The metallic gold gradient (nav pill, hero chips, tags) is hard-coded to match the live portfolio's look and works in both themes.

**There are three gold tokens, and they are not interchangeable.**
`--accent-color` is DECORATIVE — 2.2:1 on the light background, which is fine
for a rule, a border or a glow and unreadable as text. Anywhere the gold
carries text use `--accent-ink` (5.36:1 light), and anywhere it *backs* text
use `--accent-btn` (5.53:1 under white). In dark mode all three are the same
colour, because `#D4B47C` on `#121212` is already 9.47:1. Do not collapse them
back into one token — that is exactly the state this came from, where the
header logo sat at 2.20:1 and the modal CTA buttons at 2.40:1.

The project tags are their own case: the text sits on a *gradient*, so measure
against its darkest stop (`#a98642`), not the light middle. `#4B380C` scored
3.30:1 there and is now `#2A1E04` (4.80:1). At 11px the tag is normal text
under WCAG regardless of its 600 weight, so 3:1 does not apply.

## Focus, and the auto-playing covers

**The focus ring is a site-wide default, not a list of components.** It began as
`.lift-card, .doc-tile, .modal-close, .skip-link` — and the header nav links, the
social links and the theme toggle were therefore on Firefox's 1px UA outline the
whole time, as was the first new control added afterwards. It is now a
zero-specificity `:where(a, button, [role="button"], …):focus-visible` rule, so
components with their own treatment (the hero chips) still win while nothing new
can ship ringless. The ring uses `--accent-ink`: a focus indicator needs 3:1
against its backdrop (WCAG 1.4.11) and the decorative gold is 2.2:1 on the light
page — which is what the hero chip's own ring was, too.

**The project covers auto-play, so they need a pause control** (WCAG 2.2.2: any
motion that starts on its own and runs past five seconds). It is ONE page-level
button at the top of the Projects section (`CoverPlaybackToggle`), not one per
card — a card is already a button, and nesting a control inside it is worse than
the problem. State lives in `src/coverPlayback.js`, a module store read with
`useSyncExternalStore`, persisted to `localStorage`, and defaulting to paused
under `prefers-reduced-motion` (where the covers are still images anyway, so the
control does not render at all). A cover plays only when it is both on screen
and permitted: the IntersectionObserver still decides the *fetch*, the store
decides the *motion*.

## Reduced motion

`App.jsx` wraps the tree in `<MotionConfig reducedMotion="user">`, so every
motion/react animation on the page — nav pill, theme toggle, hero, the modal's
lift/expand sequence — drops its transforms for anyone who asked the OS for less
movement. Set it once there, not per component, so a new motion component
cannot quietly opt out.

The JS entrances handle themselves (`useScrollReveal`, `Hero`, `SectionTitle`,
`Flourish3D`, `ProjectCard` covers). The trap to remember: **elements that start
at `opacity: 0` must be explicitly shown, not merely left un-animated** —
`SectionTitle`'s letters do, and skipping the cascade without that left every
heading on the site blank. Anything left over is CSS that loops or moves on
hover, killed in one block at the bottom of `App.css`.

Verified by driving Firefox with `ui.prefersReducedMotion` on and off: aurora
`animation-name` `aurora-drift-a` → `none`, `scroll-behavior` `smooth` → `auto`,
and section-title letters 6-of-52 visible mid-cascade → 52-of-52 immediately.

## Deployment

**Every push to `master` is a production release.** `.github/workflows/deploy.yml`
runs `npm ci` → `npm run build` on each push and publishes `dist/` to GitHub Pages
via `actions/deploy-pages`; `gh api repos/:owner/:repo/pages` reports
`build_type: workflow`, and the site is live at
`https://aadhavsivakumar.github.io/`. Typical run time ~1m30s. There is no PR
gate and no preview environment — if you push, it ships. `dist/` is gitignored
and must NOT be committed; CI builds it.

`https://aadhavsivakumar.github.io/portfolio` is served by a **different repo**
(`AadhavSivakumar/portfolio`) and is unaffected by deploys here.

What reaches the site root: everything Vite emits into `dist/`, plus the four
directories `scripts/copy-static.mjs` copies (`Media/web`, `Media/skills`,
`projectpdf`, `Resume`). `Media/projects`, `misc/` and `legacy/` are **not**
deployed — an earlier workflow copied them and uploaded ~414 MB per push, ~390 MB
of it unreferenced. Deployed size is now ~44 MB.

## Current progress (as of 2026-09-05)

Working tree is clean and everything is committed and live. The owner has been
directing the animation work iteratively and **expects further improvements**,
so treat it as in-flight rather than final.

**What has landed, in order** (all on `master`, each push a production release):

- Production asset repair — 50 image URLs 404'd for eight months; now
  root-relative and enforced at build time (see "Asset URLs").
- Error boundary around the lanyard — a browser without WebGL used to render the
  site completely blank.
- Both flourishes rebuilt three times over: CSS-3D → Canvas2D (the DOM version
  measured 33 ms a frame regardless of element count) → line art with
  hidden-line removal, materials, LOD detail, and a propeller that keeps
  turning. A WebGL2 backend was built and removed (see "ONE renderer").
- Accessibility: keyboard-operable cards and dialog, skip link, focus rings as a
  site-wide default, contrast tokens, reduced motion, heading outline, a pause
  control for the covers, OG/Twitter metadata.
- The lanyard badges: black card on the light site, material tuned by
  simulation, texture disposal, atlas halved, drag clamped, pegboard clearance
  computed, release momentum, flip-aware pitch damper.
- Hero sine field measured off the live `/portfolio`; flourishes shown on
  phones; one shared scroll driver; the never-stopping scroll-cue arrow found
  and fenced.

The historical detail of each is in the commit messages, which are written to
be read.

**Open items:**

- **Keyboard access is done — keep it that way.** `LiftCard` is a div with
  button semantics (`role`, `tabIndex`, Enter/Space, `preventDefault` on Space
  so it does not scroll); it is NOT a real `<button>` because the cards contain
  `<h4>`/`<p>`, which are flow content and invalid inside one. The modal has
  `role="dialog"`, `aria-modal`, `aria-labelledby` pointing at its `<h2>`, moves
  focus to the close button when it opens, traps Tab, and `App.jsx` returns
  focus to the card that opened it. Verified in a browser: 23 focusable cards,
  Enter opens, Tab stays inside, Escape closes, focus returns.
  One limitation, confirmed by test: **Escape does not work while focus is
  inside an embedded Drive iframe** — a cross-origin frame swallows the key.
  Shift+Tab returns focus to this document and the close button is always
  reachable, so nobody is stuck.
- Visual QA pass pending: modal open/close feel, section-title cascades, both themes,
  mobile layout.
- Flourish tuning after the redo: the beat leads/spans at the top of each branch
  of the timeline, `perspective: 600px`, and the copper token. The pegboard's
  tone is still an open thread from the owner.
- Spline not integrated (owner's requested stack item) — needs a scene designed at
  spline.design first; wire via `@splinetool/react-spline`, lazy-loaded like the Lanyard.
