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
- **animejs v4** — the hero name's per-letter cascade, section-title letter cascades (`SectionTitle`), the scroll-scrubbed progress bar (`ScrollProgress`, via `anim.seek`), the side flourishes, and — via `src/hooks/useScrollReveal.js` — **every scroll-into-view card entrance** on the site (`LiftCard`, `Reveal`, `Resume`'s tiles, `Contact`'s links). The hook suppresses inline CSS transitions during the entrance and clears them on completion so the CSS hover/tap states resume. Note v4 API: `ease: 'outExpo'`, tween `{ from: ... }` or `[from, to]` values.
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
    Flourish3D.jsx        # the two real-CSS-3D side flourishes (see below)
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
  built from 16 flat slats around the axis (r=68), which also buys real perspective
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
Progress is `smoothstep((scroll - lead) / BUILD_SPAN)`; `BUILD_SPAN` (0.26) is much
wider than the 0.09 gap between leads, so ~3 parts are always in flight — a part
starts arriving long before the previous one seats. Widen the gap or shrink the span
and it degenerates into a stiff one-at-a-time queue. Each part also tumbles and spins
in (up to ~320°), and the whole joint turns just over a full revolution about its own
axis while assembling (`.f3d__spin`, scroll-driven).

Cylinder geometry: after `rotateY(90deg)` a slat's **width** maps to the axial (Z)
direction and its **height** stays tangential, so for radius `r` and `n` slats the
panel must be `2*r*tan(180°/n)` tall or the shell will not close — currently
r=68, n=16 → 27px (`.f3d__slat`). Recompute it if you change either number; an
older revision of this file quoted r=58/n=14/26px, which would leave the shell open.

**`LEAF_SEL` must list every leaf class a build part can contain.** The build owns
those leaves' opacity; anything missing from that selector never gets faded and sits
fully visible before its part has arrived. This bit once when the part list was
rewritten and the old class was left in while the new ones were left out. The
selector itself (`Flourish3D.jsx`, `LEAF_SEL`) is the source of truth — read it
there rather than trusting any list written down elsewhere, including this one.

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
  `.f3d__slat`, `.f3d__coil`, `.f3d__rail`. Those stay **static inline styles**.
  Animating a non-transform property (opacity) on them is safe: anime only rewrites
  `transform` when it animates a transform property.
- **Scroll and anime.js must never write the same element's transform.** Scroll drives
  `.f3d__world` (camera yaw/pitch) plus per-face/per-part depth; anime.js drives
  `.f3d__idle` and the leaves. That split is what the nested wrappers exist for.
- **One writer per property.** The right side's build owns `opacity` on every build
  leaf — the set named by `LEAF_SEL` in `Flourish3D.jsx`, currently
  `__face/__ring/__slat/__coil/__spoke/__bolt/__ellipse/__tooth/__magnet/__flexspoke/__gauge`
  — because opacity is
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

**Open items:**

- **The About bio is stale and contradicts the site.** `siteData.js` says "Robot
  Technician at Starship Technologies … TA at NYU", while the nearest work badge
  says Roboflow / Field Engineer. Needs the owner's current role, and past-tensing
  the NYU master's if it has been conferred.
- Accessibility gaps found in the same audit and NOT yet fixed: the 23 project /
  skill / about cards are non-focusable `<div>`s (`LiftCard.jsx`), the modal has no
  dialog semantics or focus management, `index.html` has no description/OG/Twitter
  tags (a shared link unfurls blank), ~10 animations ignore `prefers-reduced-motion`,
  and light-theme gold fails contrast where it carries text (header logo 2.20:1,
  modal CTA buttons 2.40:1).
- Runtime performance, also unfixed: the lanyard `<Canvas>` never pauses and never
  disposes its composited textures (~90 MB of GPU textures per settled resize); four
  unbatched scroll listeners force layout twice per event.
- Visual QA pass pending: modal open/close feel, section-title cascades, both themes,
  mobile layout. On the lanyard hover tilt — the rest-state signs are correct; the
  real defect is that after a click-flip the pitch damper becomes positive feedback,
  so fix it with a flip-aware sign rather than flipping `pitchErr` outright.
- Flourish tuning knobs (the owner's open thread): explode range and rotation speeds,
  plus the pegboard's tone.
- Spline not integrated (owner's requested stack item) — needs a scene designed at
  spline.design first; wire via `@splinetool/react-spline`, lazy-loaded like the Lanyard.
