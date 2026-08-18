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
    About.jsx             # about card centered in the 3D lanyard stage
    Lanyard/Lanyard.jsx   # multi-band physics lanyard (see below)
    Projects.jsx, ProjectCard.jsx
    Skills.jsx, SkillGroupCard.jsx
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
- `resumeDocsData` — the four document tiles (Resume, Extended CV, two transcripts), each `{ id, title, badge?, embedUrl }` where `embedUrl` is a Google Drive `/preview` link.

The lanyard badge content (name/role/ID/EXP + photo per badge) lives in `badgeCards` at the top of `src/components/About.jsx`, with photos imported from `Media/lanyardimgs/`.

To add a project or skill: append to the relevant array — the components map over the data, no other wiring needed.

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

Six ID badges (3 education left, 3 work right) hang on physics ropes around the about card, one shared Canvas/physics world. Ported from the ReactBits lanyard and heavily extended. Key invariants learned the hard way — keep them:

- **Rope joint offsets are module constants** (`J1_POS`…`CARD_POS`). Passing fresh arrays on re-render makes rapier teleport bodies and tears the straps.
- **The chain spawns vertically at equilibrium.** A horizontal spawn makes neighboring cards collide mid-drop and fall asleep at a diagonal.
- **`BandField` debounces resizes (300ms) then remounts bands via key** — physics bodies don't follow anchors when the canvas aspect changes.
- **The strap-smoothing lerp alpha is clamped to 1.** Unclamped, `delta * 50` exceeds 1 below 50fps and `Vector3.lerp` extrapolates, exploding the straps into screen-height streaks.
- When the viewport can't fit 3 badges per side, outermost badges are dropped instead of stacking (the fit test is in `BandField`, comparing `inner + (n-1)*step` against the half-world width). Note the ≥992px gate in `About.jsx` admits widths where 2 of the 6 badges are already dropped.
- **The badge material is a printed card, not a piano.** It shipped as
  `clearcoat: 1` / `clearcoatRoughness: 0.1` / `metalness: 0.35`, which against
  the Environment's intensity-10 Lightformer threw a specular sheet across the
  face and washed the name and role text out. A laminated badge does have a
  slight sheen, so the clearcoat stays — weak and diffused (0.25 / 0.45) with
  `metalness` down to 0.04. Metalness in particular has no business here: it
  tints the reflection by the base colour and darkens the diffuse term, which is
  the opposite of what a white printed card does with light.
- Badge faces are composited onto the card GLB's texture atlas at runtime (front = ID-badge layout, back = full-bleed photo). Front UV rect = left half of the atlas, back = right half.
- Interactions: drag (kinematic), click (<350ms, small movement) flips the card via a yaw target + torque kick, moving cursor applies a small repulsion impulse (sway), and hovering leans the card toward the cursor (yaw/pitch targets in the frame damper — the 3D tilt lives here, not on the HTML cards).
- **The badges hang from a beige pegboard, not a rail.** A straight full-width crossbar over six equal-length vertical straps in one dead-flat rank reads as *prison bars* — that exact combination was rejected. `LanyardRack` now renders a perforated beige masonite panel (tiling hole-grid canvas texture, theme-aware) with a ball-headed pin per badge, and `SLOT_RISE_BY` + `hangJitter()` stagger the pins slightly so they sit near-level but never in a rigid rank. Keep the stagger subtle: too much and the outer rings clip the top of the frame.

## The side flourishes (`src/components/Flourish3D.jsx`)

Two decorative pieces fixed to the viewport, one per side, mounted in the
`page-flourish-layer` in `App.jsx` (≥992px, and skipped when
`navigator.hardwareConcurrency <= 4`) and scrubbed by page scroll.

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

### Shaded solids

The masses (frame, bells, cowl, shaft, cores, camera body, lens) are SURFACES,
not wireframe: quads with a normal, lit and depth-sorted, so they read as
rendered metal. Fine detail (cage bars, teeth, louvres, bolts, ticks) stays as
strokes over the top — at this size a line reads better than a 2px sliver of
filled geometry.

- A face is `{ v: [...], n: [x,y,z] }`; normals are computed once in local space
  and rotated per frame by the part's matrix (uniform scale only, so no
  inverse-transpose needed).
- **Back-face culling is done by screen winding** (signed area after
  projection), which needs no view-space normal.
- Lighting is Lambert + a Blinn-ish specular against a fixed world light. Shade
  values are QUANTISED and the resulting `rgb()` strings cached — otherwise a
  few hundred faces a frame churn a few hundred strings.
- `submit()` collects faces for the WHOLE frame; `flush()` sorts them back to
  front and fills. Sorting globally rather than per part is what lets the rotor
  read as being inside the frame.
- Materials come from the theme tokens, desaturated toward neutral so lighting
  does the work rather than hue. Copper stays saturated.
- The lighting is a key light plus a **hemispheric ambient** (faces pointing up
  are never as dark as faces pointing down) plus a **rim term** on grazing
  angles and a mild depth fade. The rim is most of what separates "shaded" from
  "photographed", and it costs one dot product.
- **A fake environment reflection is what makes metal look like metal.** Reflect
  the view direction about the normal (`R = 2(N·V)N − V` with `V = (0,0,1)`, so
  `R.y = 2·n_z·n_y`) and ask what that ray hits in a two-band studio: bright sky
  above, dark floor below, and a HOT HORIZON LINE between them. The horizon
  streak is the tell — without it a curved body reads as matte plastic. One
  `exp()` per face.
- **The metal needs something to be lit against.** A soft radial "studio ground"
  is painted behind the geometry each frame (built once, not per frame). On a
  bare page background the reflection model has nothing to read as and the parts
  look like stickers. It is strong in dark theme and subtle in light.
- **Tessellation is the other half of looking smooth.** Bodies are 20-24
  segments around; below about 16 the facets band visibly on a curved surface.
  There is headroom for it — 4,100 segments a frame still measures free.

**The motor STARTS as a laid-out exploded view and comes together.** That is
the shape every reference exploded view of a motor uses (the owner supplied
four): the axis near horizontal, the parts strung along it in assembly order —
fan cover, endbell, rotor, stator with its copper, housing, front endbell — with
gaps wider than the parts are long. `LAID_OUT` holds those stations; each part
converges on its own staggered window so the machine builds back to front, and
the whole module is drawn small while spread and grows as it closes.

The axis sits at ~41° above horizontal (`MOTOR_TILT`). The references are
near-horizontal, but the stage is 340×660 and its diagonal is the longest run
available; a horizontal strip would need a hero-width element, not a margin.

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
and the blank-screenshot gotcha at the top of this file does not apply. The
harness: `probe.html` + `src/__probe.jsx` mounting only `<Flourish3D>` on the
dev server, driven by geckodriver, cropped per side with ffmpeg. `canvas.dataset.segs`
reports how many segments the last frame drew. Measure frame cost by comparing
rAF intervals with `.page-flourish-layer` shown vs `display: none`.

## Modal animation contract

`Modal.jsx` runs a phase machine: `lift` (card rises off the page from its
captured rect) → `expand` (grows to the modal rect) → `open` (content staggers
in via motion variants); closing reverses it (`departing` → `collapse` →
`settle`). Motion animates `top/left/width/height/scale/boxShadow` inline —
**do not reintroduce CSS transitions on those properties on
`.modal-animator`** or the phases will fight them. The clicked card is hidden
during the sequence via the `animating-out` class that `App.jsx` toggles.

## Performance rules

- The Lanyard is imported with `React.lazy` in `About.jsx` and only rendered at ≥992px, so mobile never downloads the three.js stack or the 2.4MB `card.glb`. `vite.config.js` deliberately has **no `manualChunks`** — Rollup's automatic splitting keeps the 3D stack inside the lazy Lanyard chunk. A hand-rolled split was tried and created a vendor↔three chunk cycle that broke React at runtime; don't reintroduce one. After touching `vite.config.js`, re-verify `dist/assets/index-*.js` has no static `from"./..."` import of a chunk containing three.js.

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

## Current progress (as of 2026-08-12)

Working tree is clean and everything below is committed and live. The owner has
signed off on the animation direction ("this looks much more like what I want")
but **explicitly expects further improvements**, so treat the animation work as
in-flight rather than final.

**Landed: the animation pass** (commits `flourish3d` → `unsine`, 2026-07-29 →
2026-08-11):

- **Real-CSS-3D side flourishes** (`Flourish3D.jsx`) replacing the SVG
  `AboutFlourish` storyboards — one per side, scroll-scrubbed explode/assemble, real
  perspective (verified ~1.18× near/far). See "The 3D side flourishes" above; that
  section's invariants are the expensive part, do not relearn them. A second pass
  added the two-slice voxel activation lattice with a true 3D spherical `stagger`
  grid, the fixed volume-raster kernel (it used to trace a diagonal), a
  `createTimeline` camera `seek()`-ed by scroll that dollies as well as orbits, and
  out-back "seating" so FR3 parts overshoot ~7% and settle.
- **Beige pegboard lanyard rack** replacing the straight overhead rail (see the lanyard
  section) — pins per badge, gentle non-rigid stagger.
- **Hero**: liquid-glass keyword chips (`HeroChip.jsx`, backdrop-filter + an SVG
  `feDisplacementMap` that refracts the wave field), and the `/portfolio`-style sine
  field behind the hero via `<SineWave variant="field" />` (wide 1000×350
  viewBox so `preserveAspectRatio="none"` does not stretch the waves).
- **Lanyard badges**: aspect-corrected front-face text (`squash` in `drawBadgeFace`),
  `drawContain` back faces so wide logos stop running off the edge, and a theme-inverted
  strap texture so the webbing is visible in dark mode.
- **Header**: animated sun↔moon theme toggle (mask-carved crescent + retracting rays)
  instead of an emoji swap.
- `AboutFlourish.jsx` and `AnimeEmblem.jsx` were **deleted** (unimported dead code)
  with their `.about-flourish`/`.flr-*` and `.anime-emblem`/`.emblem-*` CSS. The UR5e
  CAD-derived arm geometry only ever lived in `AboutFlourish.jsx` and is gone; the
  live right-hand flourish is FR3-derived instead.

**Landed: production asset repair** (2026-08-12). An audit against the live site
found the deployed portfolio materially broken; fixed in one pass:

- All 50 content image URLs 404'd in production (the `Images/` → `Media/` rename,
  see "Asset URLs"). Now root-relative and verified at build time.
- Covers are served from `Media/web/projects` as web-sized derivatives: five GIFs
  transcoded to h264 (`tacmanipHQ` 48 MB → 1.5 MB), oversized MP4s re-encoded
  (`mechcomp` 21 MB → 1.3 MB), stills to WebP. `Gradpic.png` 18.2 MB → 191 KB WebP.
  The Projects grid costs ~350 KB of posters up front instead of 139 MB.
- `ProjectCard` plays covers from an IntersectionObserver with `preload="none"` +
  poster, falls back to a still under `prefers-reduced-motion`, and has an
  `onError` path the `<video>` branch previously lacked.
- Iconify skill icons were requesting two `color` params and getting HTTP 500;
  the six sensor icons that were never committed, and the dead Wikimedia MATLAB
  hotlink, are now Iconify/devicon URLs.
- Content: the `???` badge EXP, five "(Coming Soon)" labels on PDFs that are live,
  and an empty `<iframe>` in the FPGA modal.

**Landed: error boundary around the lanyard** (2026-08-12). A browser that
cannot create a WebGL context used to render the site **completely blank**: the
lazy `Lanyard` `<Canvas>` throws synchronously inside `THREE.WebGLRenderer`, and
with nothing to catch it React unmounted the whole tree — empty `#root`, no
hero, no content, on every screen ≥992px. `ErrorBoundary.jsx` now wraps it, and
sits OUTSIDE the `<Suspense>` so it also catches a failed fetch of the ~3MB
lazy chunk, which had the same consequence. Verified in headless Firefox (no GL
drivers): all 7 sections, 17 project cards, 6 skill cards and both flourishes
render, the lanyard strip is simply empty, and the boundary logs one warning.
Note error boundaries catch render/lifecycle throws only — a WebGL context lost
LATER, inside r3f's animation loop, still would not be caught.

**Landed: both flourishes redone** (2026-08-12), to the brief "one should look
like a motor assembling, the other like the process of machine learning". The
Conv-Stack and FR3-harmonic-drive artwork is gone; see "The 3D side flourishes"
above for what replaced it and why. Two structural changes came with it:

- The hand-rolled scroll listener is gone — each side is now ONE anime.js
  timeline driven by v4.5's own `onScroll` ScrollObserver, with `sync: 0.2`
  smoothing. That removes two of the four unbatched scroll listeners the audit
  flagged, and the per-scroll style writes with them.
- Choreography that used to be hand-computed per frame is now declared as
  timeline positions, and anime drives statically-placed elements by animating
  **CSS variables inside their transform strings** rather than the transform.
- The FR3 harmonic-drive anatomy (wave generator, flexspline, circular spline,
  torque flexure) was **deliberately dropped**: at 6–8px in a page margin those
  parts are illegible in principle, and a harmonic drive signifies *gearbox* to
  specialists rather than *motor* to anyone. If that specificity matters, put it
  somewhere a reader can actually read it (a label, or the About copy).

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
- Runtime performance, also unfixed: the lanyard `<Canvas>` never pauses and never
  disposes its composited textures (~90 MB of GPU textures per settled resize); four
  unbatched scroll listeners force layout twice per event.
- Visual QA pass pending: modal open/close feel, section-title cascades, both themes,
  mobile layout. On the lanyard hover tilt — the rest-state signs are correct; the
  real defect is that after a click-flip the pitch damper becomes positive feedback,
  so fix it with a flip-aware sign rather than flipping `pitchErr` outright.
- Flourish tuning after the redo: the beat leads/spans at the top of each branch
  of the timeline, `perspective: 600px`, and the copper token. The pegboard's
  tone is still an open thread from the owner.
- Spline not integrated (owner's requested stack item) — needs a scene designed at
  spline.design first; wire via `@splinetool/react-spline`, lazy-loaded like the Lanyard.
