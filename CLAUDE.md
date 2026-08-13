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

## The 3D side flourishes (`src/components/Flourish3D.jsx`)

Two decorative assemblies fixed to the viewport, one per side, mounted in the
`page-flourish-layer` in `App.jsx` (≥992px only) and scrubbed by page scroll.

- **LEFT — "Detection"**: what actually happens between a camera and a bounding
  box. A camera takes itself apart down to its **sensor**; the sensor resolves
  into **pixels**; the pixels are cut into **patches** and flattened into a token
  sequence (the move that defines a **Vision Transformer**); the tokens **attend**
  to each other and the map collapses onto a few strong links; and the result is
  a **detection** — box, corner handles, label, confidence.
  This replaced an abstract 4-5-3-2 training loop the owner found disjointed.
  Every stage here is a real mechanism rather than a metaphor, which is why it
  holds together: the patch grid, the flattening into a sequence, the CLS token
  the attention links originate from, and a box with a confidence.
- **RIGHT — "Down the Shaft"** (a motor): shaft → rotor → wound stator → two end
  bells → vented can, every part threading in along the SAME axis in assembly
  order, then the rotor spins up and runs.

### The driver: one scroll-linked anime.js timeline per side

Each side is a single `createTimeline({ autoplay: onScroll({...}) })`. There is
no hand-rolled scroll listener — anime v4.5 ships its own `ScrollObserver`, which
keeps one rAF-batched listener per container with cached bounds.

- Timeline time **0…1000ms maps to page scroll 0…1**, so a beat "at 0.46" is
  literally `.add(..., 460)`. `tl.add({ duration: 1000 }, 0)` pins the total so
  that mapping holds no matter where the last tween ends.
- Thresholds are `'<container> <target>'`, **container first**. `enter: 'start
  start'` / `leave: 'end end'` reproduces `scrollY / (scrollHeight -
  innerHeight)` exactly. Reversing the pair silently gives a plausible-but-wrong
  range.
- `sync: 0.2` smooths the playhead toward the scroll position (lerp per frame)
  instead of welding it there — the assembly keeps settling after you stop
  scrolling, which is most of why it feels like it has mass. **Omitting `sync`
  is not "no smoothing", it is play/pause mode** and nothing scrubs at all.
- **Never pass `.f3d` as the observer `target`.** It is `position: fixed`, so its
  `getBoundingClientRect()` is the viewport and the scroll range collapses. Pass
  `document.body`.
- `prefers-reduced-motion` builds the same timeline with `autoplay: false` and
  `tl.seek()`s one representative frame — same code path, no second renderer.

### The invariant that makes it all work: CSS variables inside a static transform

anime emits transform components in a **fixed order** (`validTransforms` in
`node_modules/animejs/dist/modules/core/consts.js`: translate → rotate → scale),
so it can *never* produce a rotate-THEN-translate placement. Everything placed
that way — helix chords, radial arrays, cylinder ribs, network edges — therefore
carries a **static inline `transform`**, and anime animates a **CSS variable
inside that string** instead of the transform itself:

```
.f3d__mledge { transform: <static> scaleY(calc(var(--k) + var(--swell))); }
tl.add(edges, { '--k': ..., '--swell': ... })
```

The string stays ours; the numbers inside it are anime's. This is what lets an
edge re-weight and pulse at the same time — `--k` and `--swell` are two
properties with one writer each, so overlapping tweens never fight. anime writes
CSS vars via `style.setProperty` (`core/render.js:266`) and infers the unit from
the declared value, so **declare each var with its default in the stylesheet**
(`--k: 0.17`) or the tween has nothing to read.

Same rule for colour: leaf translucency lives in a `color-mix` percentage, never
in `opacity`, because **the build timeline owns every leaf's opacity** to fade
parts in as they arrive. A second writer there makes a part glow before it lands
(this has happened once already).

### Connecting two 3D points with a div

A div is a plane, not a line. `link(p1, p2)` gives width `L = |p2-p1|` and

```
translate3d(P1) rotateY(atan2(-dz, dx)) rotateZ(asin(dy/L))
```

which is rotateY-BEFORE-rotateZ — deliberately the one order anime *can* emit,
so the form stays valid if a tween ever touches it. Verified by composing the
matrices: worst tip error **2.9e-14 px** over 8 cases including all three
degenerate axes. The ribbon's thickness direction keeps an in-screen-plane
component of ≥0.88 across the whole camera sweep, so an edge can never
foreshorten to a hairline and vanish.

### The copper, and the shaft

**A coil wound around the shaft axis is a SOLENOID, not a motor winding.** The
first version of this piece had a real 3D helix — 63 divs, mathematically
exact — spiralling around the rotor core, and the owner's verdict was that an
actual motor does not look like that. They were right: an inductor looks like
that. A wound stator is **copper bars lying IN the slots** along the core, tied
together by an **end-turn ring** bulging past each end of the stack, which is
what `.f3d__slotbar` (12 bars at r=44) and `.f3d__endturn` (two rings at d92)
now draw. The helix maths, should anything ever need a true 3D coil again, is
in git history at commit `5ea93e7`.

**The shaft is a CYLINDER, not a square bar.** It was a `Box`, and a square
shaft was the most obviously wrong thing in the piece. A cylinder projects to a
rectangle with elliptical ends from any angle, so it is two plates crossed at
90° (`.f3d__shaftplate`) plus a ring at each end — 4 divs, no prism, and one
plate always faces the camera whatever the yaw.

Both plates need `rotateX(90deg)` to map their HEIGHT onto the module's Z — the
motor axis — exactly as `.f3d__axiswrap` does. Without it the plate lies ACROSS
the machine instead of along it, which is precisely the bug that shipped in the
first attempt: a long horizontal bar through the middle of the frame.

**Watch the ring count.** The camera looks nearly perpendicular to the axis, so
every ring projects as a very flat ellipse — a 156px fin renders about 21px
tall. Stack fifteen of those and the top of the machine turns into a band of
dashes that reads as noise. Internal laminations were the first thing cut: they
sit inside a shell you cannot see through, so they cost clutter and buy nothing.

### Geometry rules that are easy to break silently

- **A cylinder made of longitudinal slats reads as a FENCE, not as a machine.**
  The can was 14 ribs plus 14 fins around the axis; at this size that is 28
  vertical sticks, the shell read as a birdcage, and everything inside it was
  invisible. It is now a **stack of 7 circumferential rings** (cooling fins)
  between two stronger end rings, and no longitudinal members at all — the four
  that survived the first pass still read as posts standing outside the machine.
  Rings follow the same perspective ellipse as the bells and the end turns, so
  the shell reads as one turned cylinder and stays open enough to see the copper
  and the spinning rotor through it.
- **Rectangular prisms are the enemy here.** A `Box` is the easiest primitive in
  the file and the least appropriate: shafts, cores, shells and rotors are all
  round. The only prism left is the terminal box, which is a rectangular casting
  on a real motor too.
- **Cylinder pitch**, still true for any slatted shell you do build: after
  `rotateY(90deg)`, for radius `r` and `n` elements a CLOSED shell needs height
  `2*r*tan(180°/n)`. Recompute it if you change `n` or `r` — do not copy the
  number. An older revision of this file quoted r=58/n=14/26px, which would
  leave the shell open.
- **Radial features can only stick out SIDEWAYS.** The motor's axis is
  near-vertical on screen, so no radial direction projects downward — measured,
  the best is dy=0.32 against dx=0.80. Mounting feet and a lifting eye were
  built and then removed for exactly this reason: they read as debris hanging
  off the side. Flank features that are *supposed* to project sideways — the
  terminal box, the nameplate, the conduit — are fine, and are where to spend
  detail instead.
- **Detail is what stops it reading as "too basic".** A shaft, a core and a
  shell is a tube. The parts that make it a motor at a glance are the ones with
  their own silhouette: the **terminal box** with cover bolts and **conduit**,
  the **fan cowl** with punched vent slots over the pitched **cooling fan**, the
  **squirrel-cage bars** that turn with the rotor, the **nameplate**, the
  **keyway** on the drive end, the **slot teeth** on the stator's end faces, and
  the **bearing races and balls** in each bell hub. Detail that
  ends up hidden inside the shell is not detail, it is noise — see the ring-count
  note above.
- **Radial stack, outward, verified clear** (min gap 2.5px): shaft OD 6.5 | rotor
  core 20 | magnets 21.5–28.5 | stator bore 31 | **winding 44** | pole bars 54 |
  stator OD 62 | can ribs 78 | bell flange 82.
- **Every part arrives along the SAME axis** (`|fz| = 1`, lateral jitter ≤0.12).
  Six different arrival directions is *convergence*, which reads as a pile of
  boxes meeting; one shared axis in assembly order is what reads as assembly.
- `BUILD_SPAN` (260ms) is much wider than the 0.09 gap between part leads, so ~3
  parts are always in flight. Widen the gap or shrink the span and it degenerates
  into a stiff one-at-a-time queue.
- **Ghosts must stay OUTSIDE every `.f3d__build`.** They are dashed phantoms of
  each part's seat, and they are what makes an incoming part read as heading for
  a named socket. Put one inside a build and the leaf query claims its opacity
  and flies it in with the part it is supposed to be waiting for.
- The rotor's scroll spin-up lives on `.f3d__rotor`; its ambient idle lives on
  the nested `.f3d__rotorlife`. **Two writers on one rotateZ jitter.** Nested
  rotations about the same axis simply add.

### Performance: what actually made the page laggy

Measured with geckodriver, rAF intervals during a scripted scroll, flourishes on
vs off. Two findings, and the first was the real one:

- **`sync: <number>` on `onScroll` NEVER SETTLES.** `sync: 0.2` adds weighted
  catch-up that lerps toward the target forever: on a completely static page it
  was still rewriting the camera **~1,200 times a second**, so a ~350-element
  preserve-3d tree was re-composited every frame while nobody was scrolling.
  Static frame time was **49ms**; with `sync: true` (a plain 1:1 scrub) it is
  **17ms — identical to having the flourishes hidden**, and style mutations on a
  still page go from 2,370 per 2s to **0**. The inertia is not worth a
  permanently busy main thread. If you ever want the weighted feel back, drive
  it yourself and stop when the delta is under a pixel.
- **Infinite CSS animations keep the whole page compositing.** The hero's two
  aurora blobs and ten sine-field paths ran for the entire session, including
  scrolled far away, and every other layer pays for that. `Hero.jsx` now toggles
  `.hero--idle` from an IntersectionObserver and the CSS pauses them.
- The lanyard `<Canvas>` had the same shape of bug — rAF is only throttled when
  the whole TAB is hidden, never when a canvas merely scrolls out of view — and
  is now gated to `frameloop={onScreen ? 'always' : 'never'}`.

What is NOT the problem, so don't go chasing it: `clip-path` (stripping it
changed nothing), `will-change`, and the JS writes (only **46 style writes per
frame** during scroll — trivial). The residual scroll-time cost is the browser
re-sorting and re-rasterising the preserve-3d trees, which is inherent to the
technique and scales with element count. Budget ~350 elements total; `App.jsx`
skips the flourishes entirely when `navigator.hardwareConcurrency <= 4`.

### Density is the whole ballgame on the left

Whatever the left side depicts, the failure mode is the same: too many similar
elements in too little space and it turns to mush. Hard-won numbers:

- **Past roughly 45 connector elements** between clustered anchor points the
  individual connections stop being separable. The predecessor had 62 network
  edges and read as a hairball.
- **Connectors that share an origin must FAN.** The 12 attention links all run
  from the CLS token to a sequence receding along Z, so at a tight X spread they
  were near-collinear and filled in as one solid wedge. Spreading the sequence
  in X and arcing it slightly in Y is what turns that mass back into links.
- **One meaning per colour.** Gold is the optical path and structure, slate is
  the compute (patches, tokens, attention), rust is the result (box, label,
  confidence). An earlier version had the backward wave in cyan while negative
  weights were slate, and two unrelated things both read as "blue".
- The three stages sit top-to-bottom — sensor at y −142, sequence at y +24,
  detection at y +158 — so the piece reads as a pipeline running the same
  direction the page scrolls.

### Shapes: `clip-path` outlines and surfaces of revolution

A bare div gives you a rectangle or, with `border-radius`, an ellipse. Building
everything from those is what makes a piece read as "basic geometry", and the
owner rejected two passes for exactly that. Two techniques get real shapes
without leaving HTML+CSS:

**1. `clip-path` on LEAVES.** clip-path is a grouping property, so it forces
`flat` on a preserve-3d subtree — but a LEAF has no children, so there is
nothing to flatten, and the leaf itself is still placed in true 3D by its
parents. That makes arbitrary contours free: trapezoidal stator teeth, swept fan
blades, arc-segment magnets, tapered cowl louvres, a stamped nameplate with
clipped corners, a camera's pentaprism-and-grip silhouette.

**2. Surfaces of revolution from a real meridian profile.** A div placed by
`rotateZ(θ) rotateX(90deg)` lies in a plane that CONTAINS the axis — verified
numerically: local `(x=r, y=z)` lands at world radius r, axial z, for every θ.
So the element's own 2D box IS the lathe cross-section plane, and `clip-path`
cuts the real turned profile out of it: tapers, steps, flanges, bearing bosses,
and the serration of cooling fins. A handful of those blades rotated about the
axis reads as a machined solid. `Revolve` + `meridianClip` + `finnedFrame` in
`Flourish3D.jsx` do this.

**Both must be OUTLINES, not fills.** A filled cross-section is opaque, and once
five blades overlap the machine becomes a solid blob with everything inside
hidden — this was tried and looked like a lump of dough. `meridianClip` and
`outlineClip` therefore emit the shape, then the same shape offset/scaled
inward, as one `polygon(evenodd, …)`: evenodd turns the inner loop into a hole,
giving a stroked contour you can see through. The seam between the two loops is
zero-width and invisible. Note `clip-path` clips the element's BORDER too, which
is why the stroke has to come from the fill of a ribbon rather than from
`border`.

**Profiles are real.** The motor's are in units of roughly one millimetre of an
IEC D80 frame — AC 159 frame OD, D 19 shaft, E 40 shaft extension, H 80 shaft
height, A 125 / B 100 foot spacing — so the proportions are a real machine's
rather than invented. If you re-profile it, take the numbers from a dimensional
drawing rather than eyeballing them.

**The trap when adding a profile-based part:** the profiles are in ABSOLUTE
machine coordinates (z=0 at the frame's mid), so their build parts must seat at
`sz: 0`. The per-part `sz` offsets are added on top, and leaving the old ones in
place pushed every turned body down the axis — the front bell ended up ~190
units past where it belonged, reading as a lampshade floating above the motor.

**Density still governs.** Fins already read from the serration in the blades;
adding a crest ring per fin on top of that turned the whole machine into line
noise. 4–6 blades per body, 1.15px stroke, and rings only at the major profile
vertices.

### These are HTML divs, not SVG, and that is the entire point

- **The `preserve-3d` chain must be unbroken.** Every wrapper between the
  perspective root and a 3D-placed leaf needs it — 18 classes share one rule in
  `App.css`. A single `flat` collapses everything below it.
- **Grouping properties force `flat`.** On an element carrying `preserve-3d`, any
  of `opacity` < 1, `filter`, `clip-path`, `mask`, `mix-blend-mode`, `isolation`,
  `overflow != visible`, or `contain` flattens its 3D children. So **animate
  `opacity` only on leaves**. `.f3d` itself is exempt (perspective root, already
  flat). This is why `isolation: isolate` must never be added here.
- `.f3d__module`'s tilt lives in the STYLESHEET and must never be animated:
  anime merges only *inline* static components and would wipe it.
- Camera yaw deliberately **crosses 0°** across the scroll range so each box's
  left and right side walls foreshorten to nothing and swap over — a tell no 2D
  fake and no pre-rendered image sequence produces.

**Keep both sides inside the viewport, and roughly balanced.** Measured with the
flourishes' own bounding boxes at scroll 1.0: the motor renders ~239px wide and
the network ~158px. Before `.f3d__module`'s `scale(0.80)` and trimming the right
camera's final dolly to +30, the motor was 272px and clipped the right edge of a
1280px viewport by 22px at the bottom of the page. If you change the module
scale, the dolly, or `perspective`, re-measure — the check is one script that
sums element rects per side at several widths.

**Verify depth by MEASURING, not by eye** (a backgrounded tab throttles rAF and
screenshots blank — that is an environment artifact, not a bug). Measured live in
Firefox at `perspective: 600px`: the 63 identical-width wire chords project
**1.5–32.9px** and the 16 identical can ribs **2.1–98.0px** across the scroll
range; per-layer near/far ratio on the ML network is **1.15–1.20×**. A ratio of
**1.0 anywhere means the 3D context is broken above**. Depth headroom: the
deepest in-flight point reaches 213px of the 600px camera plane (1.55×
magnification), so nothing inverts.

To measure the flourishes without WebGL, render them alone: a throwaway
`probe.html` + `src/__probe.jsx` mounting only `<Flourish3D>` on the dev server,
driven by geckodriver.

**And do actually LOOK at them.** The blank-screenshot gotcha at the top of this
file is about WebGL and backgrounded tabs; it does NOT apply to these pieces.
They are CSS-3D divs, headless Firefox renders them fine, and a WebDriver
screenshot at a few scroll positions (crop each side out with ffmpeg, scale 2×)
shows exactly what a visitor sees. Both faults that survived every numeric
check — the network reading as a hairball, the can reading as a picket fence —
were invisible in the measurements and obvious in one screenshot. Measure for
*correctness*; look for *composition*.

### anime.js v4.5 API notes

- `ease: 'steps(4)'` **as a string was removed** — it matches a deprecated list
  in `easings/eases/parser.js`, warns, and silently falls back to **linear**.
  Import the function instead. The same applies to `irregular(`, `linear(` and
  `cubicBezier(`. Every OTHER parameterised string ease is fine: `'outBack(1.4)'`
  parses normally, and is what gives parts their ~7% seating overshoot.
- **`ease` IS legal per property** in 4.5 (`animation/animation.js`: `const
  easeToParse = key.ease || tEasing`). An earlier revision of this file claimed
  otherwise; the claim was wrong even though the conclusion it supported was not.
- Property **keyframes** are an array of objects — `'--swell': [{ to: .55,
  duration: 38 }, { to: 0, duration: 38 }]` — which is how one tween both raises
  and lowers a pulse.
- `stagger()` supports `grid: [x, y]`/`[x, y, z]` with true Euclidean distance,
  plus `jitter` and `seed` for reproducible scatter (the panel resolves cell by
  cell that way). Element emission order must match the grid's own indexing.
- `loop` and `alternate` are **animation-level** options.
- The runtime export is **`easings`**, not `eases`, and `createSpring` is
  deprecated in favour of `spring`.


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
- Flourish tuning after the redo: the beat leads/spans at the top of each branch
  of the timeline, `perspective: 600px`, and the copper token. The pegboard's
  tone is still an open thread from the owner.
- Spline not integrated (owner's requested stack item) — needs a scene designed at
  spline.design first; wire via `@splinetool/react-spline`, lazy-loaded like the Lanyard.
