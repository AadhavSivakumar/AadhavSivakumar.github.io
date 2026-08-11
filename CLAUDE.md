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
npm run build      # production build to dist/ (dist/ is gitignored)
npm run preview    # serve the production build locally
```

## Tech stack

- **React 18 + Vite 6** — SPA, entry `index.html` → `src/main.jsx` → `src/App.jsx`.
- **motion** (`motion/react`, the framer-motion successor) — scroll-into-view reveals, hover/tap micro-interactions, the header's `layoutId` nav pill, theme-toggle icon swap, and the modal's phased open/close sequence.
- **animejs v4** — the hero name's per-letter cascade, section-title letter cascades (`SectionTitle`), and the scroll-scrubbed progress bar (`ScrollProgress`, via `anim.seek`). Note v4 API: `ease: 'outExpo'`, tween `{ from: ... }` or `[from, to]` values.
- **three.js / @react-three/fiber / drei / rapier / meshline** — the 3D lanyard badges in the About section. This whole stack is **lazy-loaded** (see Performance below).

## Source layout

```
src/
  App.jsx                 # section composition + modal open/close state
  App.css                 # ALL styling: theme tokens, sections, cards, modal, hero, nav
  data/siteData.js        # ALL page content (see "Editing content")
  hooks/useTheme.js       # light/dark via data-theme attr + localStorage
  components/
    Header.jsx            # fixed nav, scroll-spy + animated gold pill (layoutId)
    Hero.jsx              # anime.js letter cascade, aurora bg, keyword chips
    HeroChip.jsx          # liquid-glass keyword pill (backdrop-filter + SVG refraction)
    SineWave.jsx          # staggered sine field behind the hero (variant="field")
    Flourish3D.jsx        # the two real-CSS-3D side flourishes (see below)
    About.jsx             # about card centered in the 3D lanyard stage
    Lanyard/Lanyard.jsx   # multi-band physics lanyard (see below)
    Projects.jsx, ProjectCard.jsx
    Skills.jsx, SkillGroupCard.jsx
    Resume.jsx            # Resume / Extended CV / Transcript tiles (Drive embeds)
    Contact.jsx, Footer.jsx
    Modal.jsx             # single reusable modal; phased lift->expand->populate
    LiftCard.jsx          # shared card: motion entrance + hover lift (no tilt)
    Reveal.jsx            # shared fade/rise-on-scroll wrapper
    SectionTitle.jsx      # anime.js letter-cascade h2 + underline draw
    ScrollProgress.jsx    # top progress bar, anime.js scrubbed by scroll
```

`legacy/` holds pre-React versions of the site — archive only, never edit to change the current site. `Media/` holds local images (`Media/lanyardimgs/` for badge photos, `Media/projects/`, `Media/skills/`). `projectpdf/` and `Resume/` hold PDFs served from this repo.

## Editing content (not markup)

All page content lives in `src/data/siteData.js`:

- `aboutMeData` — about card + modal (title, teaser, `modalContent` blocks).
- `majorProjectsData` / `smallProjectsData` — project cards. Shape: `{ id, title, cardDescription, imageUrl, tags, status, modalContent }`. `modalContent` is an array of `{ type: 'text' | 'button' | 'embed' | 'image', ... }` blocks rendered by `Modal.jsx`. Preserve existing `id` values.
- `skillGroupsData` — skill category cards; each group has `items` of `{ name, imageUrl, description }`.
- `resumeDocsData` — the four document tiles (Resume, Extended CV, two transcripts), each `{ id, title, badge?, embedUrl }` where `embedUrl` is a Google Drive `/preview` link.

The lanyard badge content (name/role/ID/EXP + photo per badge) lives in `badgeCards` at the top of `src/components/About.jsx`, with photos imported from `Media/lanyardimgs/`.

To add a project or skill: append to the relevant array — the components map over the data, no other wiring needed.

### Asset URL gotcha

`majorProjectsData`/`smallProjectsData`/`skillGroupsData` reference images via `https://aadhavsivakumar.github.io/Images/projectcovers/` and `.../Images/skills/`. There is **no `Images/` directory in this repo** — those URLs resolve against assets deployed elsewhere on the GitHub Pages site, while this repo stores similar files under `Media/`. When adding a new project/skill image, confirm with the user where it must live; putting it in `Media/` alone will 404 for those URLs. Locally-imported assets (lanyard badge photos, GLB, textures) are bundled by Vite and are not affected.

## The 3D lanyard (`src/components/Lanyard/`)

Six ID badges (3 education left, 3 work right) hang on physics ropes around the about card, one shared Canvas/physics world. Ported from the ReactBits lanyard and heavily extended. Key invariants learned the hard way — keep them:

- **Rope joint offsets are module constants** (`J1_POS`…`CARD_POS`). Passing fresh arrays on re-render makes rapier teleport bodies and tears the straps.
- **The chain spawns vertically at equilibrium.** A horizontal spawn makes neighboring cards collide mid-drop and fall asleep at a diagonal.
- **`BandField` debounces resizes (300ms) then remounts bands via key** — physics bodies don't follow anchors when the canvas aspect changes.
- **The strap-smoothing lerp alpha is clamped to 1.** Unclamped, `delta * 50` exceeds 1 below 50fps and `Vector3.lerp` extrapolates, exploding the straps into screen-height streaks.
- When the viewport can't fit 3 badges per side (`MIN_STEP` spacing), outermost badges are dropped instead of stacking.
- Badge faces are composited onto the card GLB's texture atlas at runtime (front = ID-badge layout, back = full-bleed photo). Front UV rect = left half of the atlas, back = right half.
- Interactions: drag (kinematic), click (<350ms, small movement) flips the card via a yaw target + torque kick, moving cursor applies a small repulsion impulse (sway), and hovering leans the card toward the cursor (yaw/pitch targets in the frame damper — the 3D tilt lives here, not on the HTML cards).
- **The badges hang from a beige pegboard, not a rail.** A straight full-width crossbar over six equal-length vertical straps in one dead-flat rank reads as *prison bars* — that exact combination was rejected. `LanyardRack` now renders a perforated beige masonite panel (tiling hole-grid canvas texture, theme-aware) with a ball-headed pin per badge, and `SLOT_RISE_BY` + `hangJitter()` stagger the pins slightly so they sit near-level but never in a rigid rank. Keep the stagger subtle: too much and the outer rings clip the top of the frame.

## The 3D side flourishes (`src/components/Flourish3D.jsx`)

Two decorative assemblies fixed to the viewport, one per side, mounted in the
`page-flourish-layer` in `App.jsx` (≥992px only) and scrubbed by total page scroll.
LEFT is "Conv Stack" (AI/ML: wireframe feature volumes that explode into their own
faces, a two-slice activation *lattice*, a convolution kernel that rasters through it,
a receding token row).

The kernel's scan is the one piece of this that is easy to silently break. It must
visit 32 discrete cell centres (4×4 across, ×2 slices in Z), and it is driven by three
tweens sharing a single `[0, 32]` ramp, each with its own `modifier` (`KX`/`KY`/`KZ`)
that floors the ramp to a slot index and returns that slot's real offset. **Do not
rewrite it as plain `[from, to]` ranges.** `ease` is an *animation*-level option in
anime.js, so every property shares one eased `t` — give X and Y the same range and
`x === y` on every frame, which traces the **diagonal** and never rasters. That was
the original bug here, and three code comments described it as a raster for months
before anyone measured it. For the same reason `ease` must stay `'linear'`: the
modifier does the quantising, so a stepped ease would only re-quantise off-grid.
`kslot` clamps to 31 so the terminal frame (`v === 32`) does not overrun the volume.

RIGHT is "Motor Build" — it **starts as a bare wire and a motor assembles around
it**, modelled on a **Franka Emika Research 3 joint**. The FR3 is a 7-DOF cobot whose
every joint is an integrated harmonic-drive actuator, so the part list is deliberately
anatomical, not generic: wave generator → flexspline → circular spline → BLDC rotor →
stator → torque-sensor flexure ring → cylindrical housing → end cap + output flange.
Details that carry the likeness and should survive any restyle:

- The **housing is CYLINDRICAL, not a hexagonal can** — FR3 joints are round. It is
  built from 14 flat slats around the axis, which also buys real perspective
  convergence (near slats spread, far ones bunch).
- The **wave generator is a true ellipse** (`border-radius: 50%` on a non-square box).
  That ellipse is what makes a strain wave gear instantly readable.
- The **circular spline carries 2 more teeth than the flexspline** — that difference
  *is* the gear ratio.
- The **torque-sensor flexure ring** is the FR3 signature (torque feedback in all 7
  joints); do not drop it for being subtle.

The wire (the motor phase winding) is a **true 3D helix wound around the rotor core**,
built from 80 short chord segments plus a 3-segment axial lead-in, and wound on by
scroll over the first 10%. **Do not re-attempt this in SVG.** It was an SVG path
once — a serpentine of alternating quadratic curves in ONE flat plane, cloned onto a
second plane 90° away — and it read (correctly) as a sine wave: a squiggle that
waggles beside the axis and never encircles anything. SVG cannot be rescued here,
because a path can never leave its own plane. What makes a winding legible is a depth
fact: it passes in FRONT of the core on the near side and BEHIND it on the far side.

Each segment is placed by `translateZ(z) rotateZ(θ) translateX(r) rotateY(90deg)
rotateZ(φ)`. Reading the frames outward: `rotateZ(θ) translateX(r)` puts it on the
cylinder; `rotateY(90deg)` maps the element's WIDTH onto the axial direction and
leaves its HEIGHT tangential (the same fact the housing slats use); so the final
`rotateZ(φ)` is about the RADIAL axis and sets the helix PITCH. Matching the chord
direction against that basis gives **φ = atan2(2r·sin(Δθ/2), −Δz)**. Two degenerate
cases pin the sign — zero twist ⇒ φ = 180° (a straight axial run, which the lead-in
reuses), zero pitch ⇒ φ = 90° (a flat ring). Segment centres sit at `r·cos(Δθ/2)`,
not `r`: a chord's midpoint lies inside the circle, and seating them at `r` bulges
every joint ~0.9px proud.

Verified numerically (`translateZ`/`rotateZ` composed as 4×4 matrices in Node, then
measured live): joint gaps **0.0000px**, all endpoints at radius exactly **45.0000**,
total winding **1777.5°** (5 turns less one segment), and x-excursion **−45..+45** —
that last one is the whole point, since it straddles the axis where the old squiggle
never did. In the browser the identical 17.58px chords project between 5.27px and
17.91px (3.4× at rest, 4.9× at mid-scroll dolly), which is what proves the
`preserve-3d` chain is intact; a flat chain would collapse them to one width.

Radial stack, outward — keep these from colliding: rotor OD 30 | stator bore 36 |
**winding 45** | slot walls 52 | stator OD 58 | housing 68. The slot walls were at 48
and sat right on top of the wire.

**The arrivals deliberately overlap, and come from different directions.** Each part
carries `data-lead` plus a `data-fx/fy/fz` incoming direction and a `data-spin`.
Progress is `smoothstep((scroll - lead) / BUILD_SPAN)`; `BUILD_SPAN` (0.32) is much
wider than the 0.10 gap between leads, so ~3 parts are always in flight — a part
starts arriving long before the previous one seats. Widen the gap or shrink the span
and it degenerates into a stiff one-at-a-time queue. Each part also tumbles and spins
in (up to ~320°), and the whole joint turns just over a full revolution about its own
axis while assembling (`.f3d__spin`, scroll-driven).

Cylinder geometry: after `rotateY(90deg)` a slat's **width** maps to the axial (Z)
direction and its **height** stays tangential, so for radius `r` and `n` slats the
panel must be `2*r*tan(180°/n)` tall or the shell will not close (r=58, n=14 → 26px).

**`LEAF_SEL` must list every leaf class a build part can contain.** The build owns
those leaves' opacity; anything missing from that selector never gets faded and sits
fully visible before its part has arrived. This bit once when the part list was
rewritten and `.f3d__hexside` was left in while the new classes were left out.

**These are HTML divs, not SVG, and that is the entire point.** Invariants learned
the hard way; breaking any one silently flattens the piece back to 2D:

- **SVG cannot do 3D.** `translateZ` on an SVG `<g>`/child is ignored outright
  (measured: ±150px produced a size ratio of exactly 1.0), and `rotateY` yields only
  a flat cos() x-squash. Real depth needs HTML + CSS `perspective` +
  `transform-style: preserve-3d`. Three earlier attempts to fake it in SVG (stacked
  offset outline clones) were all rejected as "not 3D".
- **The `preserve-3d` chain must be unbroken.** Every wrapper between the perspective
  root and a 3D-placed leaf needs it (`.f3d__world`, `__idle`, `__part`, `__module`,
  `__rotor`, `__pivot`, `__toolwrap`, `__cellwrap`, `__tokwrap`, `__axiswrap`). A
  single `flat` collapses everything below it.
- **Grouping properties force `flat`.** On an element carrying `preserve-3d`, any of
  `opacity` < 1, `filter`, `clip-path`, `mask`, `mix-blend-mode`, `isolation`,
  `overflow != visible`, or `contain` flattens its 3D children. So **animate
  `opacity` only on leaves** with no 3D-positioned children. `.f3d` itself is exempt
  (it is the perspective root and already flat). This is why the old
  `.about-flourish { isolation: isolate }` must never be ported over.
- **anime.js emits transform components in a fixed order** (translate → rotate →
  scale → skew), so it can *never* produce a rotate-**then**-translate placement like
  `rotateZ(k) translateX(r) rotateY(90deg)` — the cylinder-wall placement used by
  `.f3d__hexside`, `.f3d__coil`, `.f3d__rail`. Those stay **static inline styles**.
  Animating a non-transform property (opacity) on them is safe: anime only rewrites
  `transform` when it animates a transform property.
- **Scroll and anime.js must never write the same element's transform.** Scroll drives
  `.f3d__world` (camera yaw/pitch) plus per-face/per-part depth; anime.js drives
  `.f3d__idle` and the leaves. That split is what the nested wrappers exist for.
- **One writer per property.** The right side's build owns `opacity` on every build
  leaf (`.f3d__ring/__hexside/__coil/__spoke/__bar/__bolt/__face`), because opacity is
  how a part fades in as it arrives. An anime.js loop on those same leaves makes parts
  glow *before* they arrive — this already happened once with a `.f3d__coil` opacity
  shimmer. And you cannot swap such a loop to a transform property either: those leaves
  use rotate-then-translate placement, which anime cannot reproduce (see above) and
  would destroy. Give a leaf life via its parent wrapper, or not at all.
- Camera yaw deliberately **crosses 0°** across the scroll range so each box's left and
  right side walls foreshorten to nothing and swap over — a tell no 2D fake produces.

Verify depth by **measuring, not by eye**: identically-sized elements spread along Z
must render at different widths (currently ~1.18× near/far across `.f3d__token`), and
the `rotateY(90deg)` `.f3d__rail` ribbons must project far narrower than their 53px
width (~5–12px). A ratio of 1.0 means the 3D context is broken somewhere above.

### anime.js v4.5 API notes

- `ease: 'steps(4)'` **as a string was removed.** It matches a deprecated list in
  `easings/eases/parser.js`, logs a console warning, and silently falls back to
  linear. Import the function instead: `import { steps } from 'animejs'` →
  `ease: steps(4)`. Same for `irregular(`, `linear(`, `cubicBezier(`.
- `stagger()` supports genuine 3D grids: `stagger(90, { grid: [x, y, z], from: 'center' })`
  computes true 3D Euclidean distance, so ripples radiate spherically through a volume.
  (Verified in `dist/modules/utils/stagger.js`: `toZ = dims === 3 ? floor(i / (gx*gy)) : 0`,
  distance `sqrt(dx²+dy²+dz²)`. Element emission order must match `z*gx*gy + y*gx + x`.)
- `ease`, `loop`, and `alternate` are **animation-level** options, not per-property ones.
  This is not a style nit: one `ease` means one eased `t` shared by every property, so
  two tweens over the same numeric range are *always* equal frame-for-frame. When
  properties must advance independently, give each its own per-tween `modifier`
  (`{ from, to, modifier }`) — that IS supported per property, and is what the conv
  kernel uses.
- **`eases` is not a public type export.** `import { eases } from 'animejs'` fails
  typecheck in 4.5 even though the runtime object exists. Write the curve inline
  (e.g. `Flourish3D`'s `seat`, an out-back with s≈1.4).

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

## Deployment

GitHub Pages serves this repo; the React app must be built (`npm run build`) — `dist/` is gitignored, so pushing source alone does not update a Pages deployment that expects built output. Confirm the intended deployment flow with the user before assuming pushes go live.

## Current progress (as of 2026-07-29)

**Uncommitted working changes** — the current animation pass. The owner has signed off
on the direction ("this looks much more like what I want") but **explicitly expects
further improvements**, so treat all of this as in-flight rather than final:

- **Real-CSS-3D side flourishes** (`Flourish3D.jsx`, new) replacing the SVG
  `AboutFlourish` storyboards — one per side, scroll-scrubbed explode/assemble, real
  perspective (verified ~1.18× near/far). See "The 3D side flourishes" above; that
  section's invariants are the expensive part, do not relearn them.
- **Beige pegboard lanyard rack** replacing the straight overhead rail (see the lanyard
  section) — pins per badge, gentle non-rigid stagger.
- **Hero**: liquid-glass keyword chips (`HeroChip.jsx`, backdrop-filter + an SVG
  `feDisplacementMap` that refracts the wave field), and the `/portfolio`-style sine
  field restored behind the hero via `<SineWave variant="field" />` (wide 1000×350
  viewBox so `preserveAspectRatio="none"` does not stretch the waves).
- **Lanyard badges**: aspect-corrected front-face text (`squash` in `drawBadgeFace`),
  `drawContain` back faces so wide logos stop running off the edge, and a theme-inverted
  strap texture so the webbing is visible in dark mode.
- **Header**: animated sun↔moon theme toggle (mask-carved crescent + retracting rays)
  instead of an emoji swap.

A second pass on the flourishes (in response to "make the side scrolling animations more
anime.js-3D like") added: the two-slice voxel activation lattice with a true 3D spherical
`stagger` grid, the fixed volume-raster kernel (see above — it used to trace a diagonal),
an anime.js `createTimeline` camera that is `seek()`-ed by scroll and now **dollies**
(`translateZ: [-80, 120]`) as well as orbiting, and out-back "seating" on the FR3 parts
so they overshoot ~7% and settle instead of gliding to a dead stop.

Known open threads on this pass: the flourishes' explode range / rotation speeds and the
pegboard's tone are the obvious tuning knobs. `AboutFlourish.jsx` and `AnimeEmblem.jsx`
have been **deleted** (unimported dead code), along with their `.about-flourish`/`.flr-*`
and `.anime-emblem`/`.emblem-*` rules in `App.css`. Note this means the UR5e CAD-derived
arm geometry, which only ever lived in `AboutFlourish.jsx`, is gone from the tree — the
live right-hand flourish is FR3-derived instead.

**Done and committed locally** (commits `lanyard update 1`, `lanyard 3d change 2`):

- Full rebuild of the site as a modern, animated version of the live `/portfolio`: motion + anime.js installed and wired throughout.
- 3D lanyard About section: six physics badges (education left / work right, content matching the live site's badges) around the about card; drag, click-to-flip, cursor sway, and hover tilt interactions; resize-safe layout; low-fps strap fix; vertical-equilibrium spawn.
- Content parity with live `/portfolio`: about card + modal bio, Resume/CV/Transcript Drive documents, contact text.
- Hero (anime.js letter cascade, aurora, keyword chips, scroll cue), scroll-spy nav with metallic pill, LiftCard/Reveal card entrances, SectionTitle letter cascades, scroll-scrubbed progress bar.
- Phased modal: lift → expand → content stagger, reversed on close.
- Teardown: AnimatedObjects (hexagons), SineWave, useInView hook, old class-based reveal CSS, old resume card.
- Mobile stays light: 3D stack only loads ≥992px via lazy chunk; production build verified clean (no console errors).

**Open items:**

- Visual QA pass pending on the current animation work: modal open/close feel, lanyard hover-tilt direction (sign flip in `Lanyard.jsx` `pitchErr`/`tilt.nx` if it leans the wrong way), section-title cascades, both themes, mobile layout.
- Spline not integrated (user's requested stack item) — needs a scene designed at spline.design first; wire via `@splinetool/react-spline`, lazy-loaded like the Lanyard.
- Deployment flow for the built `dist/` is undecided (see Deployment above).
