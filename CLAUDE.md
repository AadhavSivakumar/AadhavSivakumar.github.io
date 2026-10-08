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

**Driving the 3D scene with a mouse: give r3f a frame to raycast.**
`page.mouse.move(x, y)` immediately followed by `page.mouse.down()` does
nothing — the pointer-down fires before the renderer has processed the hover,
so no mesh is picked and the drag silently never starts. It looks exactly like
a stuck clamp: every frame identical. Move, `waitForTimeout(300)`, then press.
To find a badge, sweep the pointer down the canvas and watch
`document.body.style.cursor` turn `grab` — the Lanyard sets it on hover. And
`gl.readPixels` returns nothing, because three.js does not preserve the drawing
buffer; measure from `page.screenshot()` instead.

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
- **three.js** — only the WebGL Atlas on the last page (`atlasGL.js`, lazy). The lanyards were three.js + @react-three/fiber / drei / rapier / meshline until Sept 28; they are motion components now (`MotionLanyard.jsx`).

## Source layout

```
src/
  App.jsx                 # section composition + modal open/close state
  App.css                 # ALL styling: theme tokens, sections, cards, modal, hero, nav
  data/siteData.js        # ALL page content (see "Editing content")
  waveField.js            # constants + timeline shared by WaveField and Flourish3D
  scrollSnap.js           # settle onto a page after 2s still; tells the art when it has
  hooks/useTheme.js       # light/dark via data-theme attr + localStorage
  hooks/useScrollReveal.js # anime.js scroll-into-view entrance used by every card
  components/
    Header.jsx            # fixed nav, scroll-spy + animated gold pill (layoutId)
    Hero.jsx              # portrait disc, anime.js letter cascade, keyword chips
    HeroChip.jsx          # liquid-glass keyword pill (backdrop-filter + SVG refraction)
    WaveField.jsx         # the hero sine field: fixed full-viewport canvas that splits into the flourishes
    Flourish3D.jsx        # the two canvas side flourishes (see below)
    About.jsx             # the about card (portrait, name, bio modal) — rendered inside Contact
    PageNext.jsx          # the static down button at the bottom of each page
    badgeCards.js         # the six badge definitions + photos; Experience hangs four of them
    Lanyard/Lanyard.jsx   # multi-band physics lanyard (see below)
    Projects.jsx, ProjectCard.jsx
    Skills.jsx, SkillGroupCard.jsx
    Experience.jsx        # one PAGE of two orgs (rendered twice: Experience, Research) — teaser cards + zig-zag lanyard badges
    Resume.jsx            # Resume / Extended CV / Transcript tiles (Drive embeds)
    Contact.jsx, Footer.jsx
    Modal.jsx             # single reusable modal; phased lift->expand->populate
    LiftCard.jsx          # shared card: anime.js entrance (useScrollReveal) + CSS hover lift (no tilt)
    Reveal.jsx            # shared fade/rise-on-scroll wrapper
    SectionTitle.jsx      # anime.js letter-cascade h2 + underline draw
    ScrollProgress.jsx    # top progress bar, anime.js scrubbed by scroll
  robots/                 # the REAL machines, baked from MuJoCo Menagerie models (see below)
    index.js              # lazy loader, mesh preparation, forward kinematics
    soarm.json fr3.json ur5e.json ultra.json atlas.json   # baked meshes: mm, Z-up, decimated
scripts/
  copy-static.mjs         # post-build asset copy + referenced-asset existence check
  bake-robots.mjs         # robot meshes -> src/robots/*.json (raw meshes not committed)
  qem.mjs                 # quadric edge-collapse decimation, used by the bake
```

`legacy/` holds pre-React versions of the site — archive only, never edit to change the current site, and **not deployed**. `misc/` is unreferenced data and is likewise not deployed. `Media/` holds local images:

- `Media/lanyardimgs/` — badge photos, *imported* by `badgeCards.js` so Vite bundles them.
- `Media/projects/` — the full-size originals (hundreds of MB, including per-project subdirectories of raw footage). **Not deployed, and nothing on the site links to them.**
- `Media/web/` — the web-sized derivatives the site actually serves, built from those originals. Deployed.
- `Media/skills/` — skill icons. Deployed.

`projectpdf/` and `Resume/` hold PDFs served from this repo.

## Editing content (not markup)

All page content lives in `src/data/siteData.js`:

- `aboutMeData` — about card + modal (title, teaser, `modalContent` blocks).
- `majorProjectsData` / `smallProjectsData` — project cards. Shape: `{ id, title, cardDescription, imageUrl, tags, status, modalContent }`. `modalContent` is an array of `{ type: 'text' | 'button' | 'embed' | 'image', ... }` blocks rendered by `Modal.jsx`. Preserve existing `id` values.
- `skillGroupsData` — skill category cards; each group has `items` of `{ name, imageUrl, description }`.
- `experienceData` — the Experience and Research pages (`Experience.jsx`): `{ id, group, badge, org, role, degree?, location, period, summary, bullets, tags, video }`.
  **Each card carries a VIDEO** beside its text (the owner: "have a video for
  the Roboflow card, the Starship card, the NYU card and the UCSC card"):
  `video` is a root-relative `.mp4` with a `-poster.webp` beside it, drawn by
  the same lazy, poster-first, pause-control-aware `CoverVideo` the project
  covers use (exported from `ProjectCard.jsx`). **Each is a clip of that
  organisation's OWN marketing video** — the owner rejected drawn loops and
  project footage: "I want it to be a real video, taken from the marketing
  pages". Sources, all from the organisation's own site: Roboflow's homepage
  hero (`media.roboflow.com/webflow/video/hero-homepage-202-1440x810-short.mp4`,
  0–12 s); Starship's homepage film
  (`starshipvideos.lon1.cdn.digitaloceanspaces.com/starship_homepage.mp4`,
  2–15 s); NYU Tandon's homepage film (the Vimeo progressive file on
  engineering.nyu.edu, 3.6–14.5 s: robotics lab, humanoid, cleanroom); UCSC
  Baskin Engineering's welcome film (the YuJa player embedded on
  engineering.ucsc.edu, HLS pulled with ffmpeg; 43–58 s of its B-roll —
  labs, the Baskin sign, campus — skipping the dean's talking head;
  www.ucsc.edu itself is behind a Cloudflare check). Encoded silent, 960 px,
  30 fps, libx264 crf 29, faststart, a poster from inside each clip: 0.8–1.3
  MB each, fetched only when the card is on screen. Files:
  `Media/web/experience/{roboflow,starship,nyu-tandon,ucsc-baskin}.mp4`. `group` picks the page: `'industry'` (Roboflow, Starship) or `'research'` (NYU, UCSC). The card is a teaser — role, org, degree, period, the summary paragraph and a few tags (since Sept 28 no bullets on the card) — and the WHOLE entry opens in the shared modal (`meta`, `list` and `tags` blocks in `Modal.jsx` exist for it). Keep bullets in priority order: the first two are what the card shows.
  **It is written for a public page.** Industries and public events are named; customers, contract values, internal contact and colleague names, internal infrastructure, unreleased product plans and anything the owner's own notes flag `[confirm]` or NDA are not. The owner's resume source material is far richer than what is here — that is deliberate, not an omission.
- `resumeDocsData` — the four documents (Resume, Extended CV, UCSC and NYU transcripts), each `{ id, title, tab?, embedUrl, pages }`: `embedUrl` is the PDF in `Resume/`, `pages` its page images (`scripts/pdf-previews.mjs`). All four are viewer tabs on the Resume page. **The transcripts are REDACTED copies** (Oct 1: both student IDs and the NYU birth date removed from the text layer with PyMuPDF, not just covered, and a black bar drawn over each; every other word verified unchanged by a word diff) — never commit an unredacted one.

The lanyard badge content (name/role/ID/EXP + photo per badge) lives in `src/components/badgeCards.js`, with photos imported from `Media/lanyardimgs/`. Each `experienceData` row names its badge with `badge: '<name>'`.

To add a project or skill: append to the relevant array — the components map over the data, no other wiring needed.

### The site is positioned for robotics / ML / computer-vision roles

That is the owner's stated goal, and three things follow from it:

- **The content follows the owner's Extended CV** (Sept 27; "for the site
  content, use the cv"): the experience rows, the about text, the major
  project descriptions and several small cards were rewritten from it. Kept
  off the page even though the CV has them: partner names for
  integrations, a customer rig's cost, NVIDIA's unreleased product names (Cosmos 3 Edge is RELEASED — the owner, Oct 1 — so it may be named),
  and the name of the robot whose teleop data the π0 work used.
- **`skillGroupsData` order is deliberate**: since Sept 27 **Robot Learning:
  VLAs & World Models** leads (π0/openpi, Cosmos, Isaac Sim, Gaussian
  splatting, LeRobot, ACT/GR00T, JAX, teleop, MuJoCo, DGAM — each on the
  CV), then Machine Learning & Computer Vision; the sensors group was folded
  into "Electronics, Embedded & Sensors" to keep eight cards. Before that: Machine Learning & Computer Vision
  first, Robotics & Control second, then Programming, Embedded, Design, Sensors.
  The group a recruiter screens on leads. It used to be fourth, with four vague
  items ("AI Vision", "Gen AI API").
- **A skills list is a set of claims. Every item must be backed by something
  else on the site** — a project, the job title, a tool already listed.
  Frameworks that are not yet evidenced anywhere (PyTorch, TensorFlow, ONNX,
  TensorRT, OpenCV, CUDA…) are deliberately ABSENT until the owner confirms
  them, however likely they are. Do not add them on inference.
- **Sept 30 project changes (the owner):** "Reinforcement Learning & Optimal
  Control" was on the OLD /portfolio and never made it into this rebuild
  (its data was taken from an earlier copy); it is back as the FIRST major
  project, id `'rl'`, "Reinforcement Learning: Go2 Locomotion" — written
  from the rob6323_go2_project README and code (PPO via rsl_rl in Isaac Lab,
  PD torque control, early termination, Raibert heuristic, reward shaping,
  randomised friction) and the course repo; media from
  `Media/projects/l_reinforcementlearning`. Glass-2-Bot moved to Additional
  Projects (second, after the webinar). "3D space mapping with depth camera"
  (`'j'`) was replaced by Robot Perception (`'rp'`, from the Robot-Perception
  repo's code; media `m_robotperception`), the 2D lidar card (`'i'`) was
  removed, and the CV desktop arm (`'g'`) is now "Bimanual SO-ARM101
  Teleoperation" (the CV's LAIR line). Its cover `so101.webp` is a STAND-IN,
  this site's own SO-ARM101 render: replace it when the owner sends footage.
  Also back from the old site, on request: "Machine Learning & AI
  Instructor" (`'n'`, before MATE ROV; the old card had no text, so it is
  written from the CV's IDEA-program entry; cover cropped to the camera
  view of its Nicla Vision demo) — fifteen small cards, three full rows.
  The RL card credits the two classmates by name (the owner agreed; their
  names are in the project's public README).
- **`majorProjectsData` is exactly the four the owner chose**: Glass-2-Bot,
  SMART compost sorting, Stockbot, and "UR10e Kinematics in MuJoCo" (id `'h'`, once titled "3D Fruit Ninja
  Simulation", then "MuJoCo simulation for forward/inverse kinematics for
  6DOF arm" — renamed at the owner's request; the description is taken from the
  MujocoSim repo's notebooks: FK/IK for position and velocity on a UR10e, then
  a Fruit Ninja demo), in that order. Sluice was removed at the owner's
  request. Everything else — including the tactile sensor — is in `smallProjectsData`,
  strongest first: fourteen cards, five to a row (the ASL Glove, id `'m'`, from `Media/projects/aslglove.png`, added Sept 27; the DGAM card, id `'l'`, was removed at the owner's request on Sept 28). **The first is the Roboflow
  webinar** (id `'k'`): the owner's public talk on part-presence inspection
  with RF-DETR-Seg, added at their request as a card rather than a "Talks"
  section (one talk does not make a section). Its cover is a LOOP CUT FROM
  THE RECORDING (`Media/web/projects/webinar.mp4`, Oct 1, the owner: "have a
  gif of the video be the cover": 3:03-3:10.5 of the YouTube video, pulled
  with yt-dlp, the Lucid feed and its parts count cropped above the
  face-cam; an mp4 rather than a .gif — the same loop as a GIF, even at
  15 fps and 128 colours, measured 2.6 MB against 0.25 MB); it
  replaced a drawn cover (a grid of parts with one missing) — and
  its modal embeds the RECORDING (Roboflow's YouTube, "Build a Missing Part
  Detection System with Computer Vision", youtube-nocookie from 1:36, the
  owner's link) with a "Watch on YouTube" button; it used to point at the
  webinar series on luma.com until the owner supplied the link (Sept 29). Preserve `id` values when moving entries
  between the two arrays; a card promoted to major needs a `cardDescription`,
  which small cards do not use.
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
convention, uses it as the `poster` — and as the fallback image when the
browser cannot play the video (no H.264 in many Linux Chromium builds; it used
to fall through to "Image Not Found") — and the build check enforces its
existence.

## The lanyard badges — now MOTION, not 3D (`src/components/MotionLanyard.jsx`)

**Sept 28: the three.js + rapier lanyard is GONE** (the owner: "can you use
Framer for the lanyards instead?"). Each badge is a motion (Framer Motion)
pendulum: a pin; the strap and card hang from it as one group rotated about
the pin by a low-damped spring (`swing`); dragging swings the group to the
pointer's angle from the pin (the strap stretching up to 30px); release
lets the spring swing it home through an overshoot; a pointer brushing
past pushes a small sway; hovering tilts the card in 3D; a click (not a
drag) flips it to the photo on its back, Enter/Space too. The face is real
HTML (photo, name in the display serif, role, ID/EXP) and inverts against
the page as the 3D card did. Both badges hang in the left column
(`.exp-lanyard--pair`), each pin 52px above its card on a 40px strap.
Nothing runs on a still page: every motion is a spring that settles (0
mutations 3s after arriving). Removed with it: `src/components/Lanyard/`
(Lanyard.jsx, card.glb, lanyard.png), the badge probe, ErrorBoundary, and
the @react-three/fiber, drei, rapier and meshline packages — a ~3 MB lazy
chunk and four WebGL contexts. three.js remains for the Atlas only
(`atlasGL`, lazy, from act 4). Everything below in this section describes
the removed 3D lanyard and is history.

**Oct 1, the badges reworked** (the owner: "I feel like the lanyards can be
improved"), each change seen in both themes:
- **A clearing behind each badge** (`.mlan::before`, z -1 inside the
  section): a static page-coloured radial halo. The left film shows through
  this column at 0.28 on these two pages and its D435 sat right behind the
  first badge (the dark theme read its apertures as "0 0 0 0"); the halo
  hides it where the badge hangs and nowhere else, without touching the
  film or the story.
- **A woven strap in the card's own colour** (dark on the light site, pale
  on the dark one) with one gold thread, a steel pin head and a swivel clip
  whose ring runs into the card's slot. It was a gold-striped stub that read
  as a peg. Still SHORT: the owner asked for a short string.
- **The holder's name** along the front's bottom edge, like a real badge.
- **The back says something**: org, role, WHERE / WHEN (label over value —
  side by side the dates wrapped), the tags that FIT one line (`fitTags` in
  Experience.jsx: in order, skipping any that would overflow 26 chars), a
  barcode strip. It repeated the logo. Org and role clamp to two lines each
  (NYU Tandon and UCSC's names are long).
- **The release carries the throw**: `swing` is a plain motion value now,
  driven by `animate()` springs; on release its measured velocity
  (`getVelocity`, clamped ±480°/s) seeds the spring — a flick let go at
  −37° swings through +12.5° and settles in ~2 s. With `useSpring` +
  `jump()` every release started from rest. A brush ADDS to any swing in
  progress.
- **The laminate's sheen slides with the hover tilt** (`--sheen`, a motion
  value as a CSS variable), and a hint ("drag · click to flip") fades in on
  hover/focus. Still 0 mutations on a still page.

**Found and NOT changed (the owner's call — Oct 1: "I think the robots can be seen", so it stays):** on Experience and Research the
RIGHT stage (the 2R arm, the SO-ARM101 act) is behind the wide cards almost
entirely — at 1440 the stage is x 1114-1454 and the cards 268-1389 — so
those robots are only seen in slivers through the gaps between cards (a
grey bracket between the two Experience cards is the 2R arm's base).

Also found while measuring: the Resume page's Drive preview was mounted
600px early, in the middle of the scroll through Additional Projects, and
its load is a long main-thread task (frames of 170-200ms, act 3 p90 50);
it mounts once the page is 35% on screen and the reader has paused 450ms.
With that and the lanyards gone every act measures p90 17.1-17.3 in
Firefox — act 4, which had sat at the frame-budget edge for several rounds,
included. The camera (D435i) also: `CAM2.yaw` 34 → 16 and the rest view 26
/ 15 → 14 / 12 (the far lens was out of sight), and its LENSES draw in a
second pass after the body — the front plate is one big face sorted at its
centre's depth, so the lenses on its far half sorted behind it and two of
the four apertures were missing.

Also found while measuring this: the hero's scroll-cue gate used an 80px
outward rootMargin, so sitting on the Experience page (the hero's bottom
edge exactly at the top of the screen) still counted as "on screen" and the
cue kept bobbing — ~120 style writes every 2s on a still page. It uses a
threshold now.

## The 3D lanyard (`src/components/Lanyard/`) — REMOVED Sept 28, kept as history

ID badges on physics ropes, ported from the ReactBits lanyard and heavily
extended. **Seen rendering for the first time on 2026-09-07** via the WebGL
harness above: black cards, legible type, one pin each, centred — the material
and layout work verified by simulation held up. **They hang beside the
Experience and Research cards** — one badge per card (Roboflow, Starship on
Experience; NYU, UCSC on Research), each in its own small `<Canvas>`, mounted
only once it comes within 600px of the viewport (`useNearViewport`) so four
WebGL contexts are not created on page load. **Since Sept 26** (the owner: badges beside their cards, all on the left,
readable, more reactive, short string, no pegboard): ONE canvas in the left
column spans both rows and holds both badges (`RowLanyard` with
`badgeNames`), the second hung lower by the measured card-row height
(`dropPx`), the canvas reaching 150px up beside the title; no pegboard, a
single pin per badge (`LanyardRack` draws pins only); `ROPE_SEG` 0.4;
`sizeMul` 1.1; the card is MATTE (envMapIntensity 0.12, no clearcoat,
roughness 0.95) with the badge type a step larger and heavier and more
emissive — the sheen washed the text out; hover reacts more (`SWAY_STRENGTH`
0.4, `SWAY_RADIUS` 4.5, `TILT_MAX` 0.6). **The modal grows out of the card**:
`App` passes the clicked card's markup (`cardHTML`) and the modal draws it as
a ghost inside the surface, lifting with it, scaling as it expands and
cross-fading into the content (which now starts during the expand), and the
reverse on close; `settle` lands at full opacity as the card. Experience
entries show their video in the modal too (`video` block). **Since Sept 25**: columns 200px, canvas `clamp(372px, 1.6 * row - 16px,
480px)`, `.page--wide.exp-page` 1760px with 2.5vw side padding (the owner
found 1480 "squished horizontally"); and when the browser has no WebGL, or a
badge's context is lost later, the badge is drawn FLAT (`BadgeFallback` in
`Experience.jsx`: photo, name, role, ID, EXP on a strap) instead of the error
boundary's old `null` — the owner reported "I can no longer see the
lanyards", which could not be reproduced here (they render in SwiftShader at
every size and theme), so the likeliest cause, a browser without working
WebGL, now degrades visibly. **Since Sept 24 (the owner: "make the id cards higher up and slimmer, and
the cards for Experience and Research wider") the badge columns are 180px,
not 250, both badges hang from the TOP of their column (no longer one top-
and one bottom-aligned), the canvas is `clamp(340px, 1.44 * row - 14px,
432px)` — 72% of the old 600, the same ratio as the column, so the drag
clamp's measured margins still fit — and `.page--wide.exp-page` is 1480px
wide: cards 892px at 1440x900 (were ~670). What follows describes the
earlier 250px layout.** **The badges ZIG-ZAG**: on each
page the cards stack in the middle column, the first badge hangs in a 250px
column on the RIGHT, top-aligned beside the first card, and the second in a
250px column on the LEFT, bottom-aligned beside the second. Each canvas spans
both rows in a column of its own, which is what lets a canvas be taller than
either row (460-600px, see below) while two cards share one 900px screen. Squeezing each canvas to its row
(~330px) was built first and seen: the badges drew at ~72% of their size. There is no About section any more — the about card is on the Get In Touch
page (see Pages); its old full-width six-badge strip is gone (the owner asked for the badges next to their boxes — "the lanyard",
definite article — and duplicating six badges was not worth the GPU memory).
Two badges from the old strip, Dublin High and "Researcher", have no row and
are not rendered; their data is kept in `badgeCards.js`. **The canvas HEIGHT
is the badge size.** The camera's field of view is vertical, so everything in
the scene — badge, strap, board — is drawn at a scale set by the canvas
height, while every physics constant is in world units that do not care. A
canvas that grew with its card once drew one badge twice the size of the one
beside a short card (300x1050 next to 300x440). So `.exp-lanyard` is
`clamp(460px, 2 * --exp-row-h - 20px, 600px)`: the same on both badges of a
page, and as tall as the two rows it spans allow. **That is how the badges were
made bigger** (~30%, to 600px at 1440x900), at the owner's request — not by
`sizeMul`, which would have meant re-deriving the drag clamp, the pegboard's
flip clearance and the hang. The pegboard was made smaller at the same time,
in `LanyardRack`'s geometry (1.12 x 0.84, x sizeMul, from 3.2 x 2.0; then
0.84 x 0.64 when the owner asked again), which is pure scenery. **`.exp-lanyard` must stay `position: relative`**:
it is the containing block for the Lanyard's absolutely positioned canvas. It
used to be `sticky`, which did that job silently; the first version of the
pages dropped `sticky` and the badge hung over the middle of the cards.
Badge scale is `sizeMul` 2.05, on a SHORT strap (`ROPE_SEG` 0.62 a segment,
was 1.0) and a thin line (`lanyardWidth` 0.32, was 0.5), hanging from a small
board — the owner asked for a smaller cork board, less string and a bigger
badge, in that order, over two rounds. **Everything that depends on the badge's
size is now a formula of it**, so the next "make it bigger" does not silently
reintroduce a bug that was found by hand: the board's depth (`boardZ(scale)`,
the flip-sweep clearance) and the drag clamp's half-extents. A lone badge uses
`side: 'center'`, because the left/right anchor maths always clears the centre
by half a card plus a gap, which is right for a pair flanking a card and wrong
for a badge with the column to itself. Key invariants learned the hard way —
keep them:

- **Rope joint offsets are module constants** (`J1_POS`…`CARD_POS`). Passing fresh arrays on re-render makes rapier teleport bodies and tears the straps.
- **The chain spawns vertically at equilibrium.** A horizontal spawn makes neighboring cards collide mid-drop and fall asleep at a diagonal.
- **`BandField` debounces resizes (300ms) then remounts bands via key** — physics bodies don't follow anchors when the canvas aspect changes.
- **The strap-smoothing lerp alpha is clamped to 1.** Unclamped, `delta * 50` exceeds 1 below 50fps and `Vector3.lerp` extrapolates, exploding the straps into screen-height streaks.
- When the viewport can't fit 3 badges per side, outermost badges are dropped instead of stacking (the fit test is in `BandField`, comparing `inner + (n-1)*step` against the half-world width). (Historical: it mattered for the old six-badge strip. Every canvas now holds one centred badge.)
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
- The BACK face stays pale in both themes on purpose — it carries logo artwork,
  some of it dark-on-transparent, which would vanish on black — **but it must
  not be white.** At `#ffffff` a flipped badge on the LIGHT site was invisible:
  measured off the render, the card field came out (245,244,243) against a page
  of (243,241,238), a difference of 10. The emissive map is the card's own
  texture, so a pale field emits hard and clips to white. It is `#a9a294` with a
  `#6f6859` inset border now, rendering at (231,229,224). The transfer is very
  compressive — 66 levels of albedo bought 14 levels of render — so reach for
  the border before reaching for a darker field.
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
- **The drag target is CLAMPED so the WHOLE card stays in frame.** It
  originally clamped nothing (drag a badge down and it left the canvas and was
  gone), then clamped the card's CENTRE, then the collider's box plus 0.15.
  **The margins are measured, not derived — 0.65 vertical, 0.4 sideways** —
  because the visible card is not centred on its collider (the mesh group sits
  1.2*scale below the body and the GLB has its own origin), so the collider's
  half-extents under-state how far the art reaches. 0.15 had been measured 3px
  clear on a straight drag at 300px wide; dragged into a CORNER of the 250px
  column the badge's last row went over the edge. Found by probing with a
  deliberately large margin (0.8: 13px clear below, 25px beside, at ~43.5px
  per world unit) at `sizeMul` 1.6 — which puts the art's true half-extents at
  ~1.44 and ~0.94 of the scale. Those ratios are what the clamp uses, so the
  badge can grow without re-probing. At 2.05 in a 250x600 column that leaves
  ~50px of downward travel and only ~5px sideways: a big badge in a narrow
  column has nowhere to go, which is the trade the owner asked for. Both
  half-extents are floored at 0: a narrow, tall canvas has little world width,
  and a negative half-width would flip the card side to side. The drag test is: sweep the pointer down the
  canvas until the cursor turns `grab`, press, drag 300px past each lower
  corner, and read the badge's dark-pixel box off the render.
- **`SLOT_BASE_Y` is 3.65, raised from 2.4 the first time these could be seen.**
  At 2.4 the badge came to rest 12px off the bottom of its column — badly
  composed, and no room to drag. Do not lower it without re-running the drag
  test; the strict clamp depends on the headroom it creates.
- **How far back the pegboard has to be is a calculation, not a nudge.** A card
  FLIPPING sweeps its corners through z by its own half-width (collider half
  width 0.8 x scale). The board sat at -0.35, less than a third of that, so
  every flip drove a corner through the panel and the badge was sliced. It is
  `boardZ(scale) = -(0.25 + 0.8 * scale + 0.30)` now, with `CARD_MIN_Z`
  (-0.25) holding the card's centre so the sweep is measured from a known
  place, and 0.30 of clearance behind the worst case — -2.19 at `sizeMul`
  2.05. It is a function BECAUSE it was a hard-coded sum that the first
  badge-size change would have invalidated.
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

## Sept 28: experience cards are a paragraph; the close flies a snapshot

Experience and Research cards show the role, org, degree, period, the
SUMMARY paragraph (clamped to 5 lines, 4 on short screens), the tags and "N
highlights →"; every bullet is in the modal only (the owner: "have a small
paragraph and have the bullet points show up in the modal"). Keep each
`summary` a short paragraph — it is the card's whole text now.

The modal CLOSE flies a canvas SNAPSHOT of the frame on screen at the click
(`closeShot`, drawn with the element's object-fit crop), not a new
<video>/<img>: the new element had not decoded a frame yet, so the slot
flashed the flyer's #111 background, then the poster, then the video at a
different moment (the owner: "a small flash/jitteryness"). Where the source
cannot be drawn (undecoded, e.g. Chromium here without H.264) it falls back
to the live copy.

## The LEFT stage is MANIM now (`manim/left.py`, `LeftFilm.jsx`) — Sept 28

The owner: "refactor the whole left side animation in manim". The left
stage is no longer drawn live: it is Manim scenes rendered to video,
**scrubbed by the scroll**, in **both themes** (the owner chose both). The
Flourish3D left-side code (camera, VLA, world model, simulator acts) is no
longer mounted — `App.jsx` renders `<LeftFilm />` instead — and what the
sections below say about the left canvas describes code that is still in
Flourish3D.jsx but unused. The right side (the robots) is unchanged.

- **The story** (`manim/left.py`), REBUILT Oct 6 (the owner: "more
  impressive… cooler transitions… make sure the content actually makes
  sense"; a critic pass found disconnected stunts, mid-morph scribbles,
  an Act3 that showed inference rather than training, and a real shot at
  the start that did not match the real shot at the end). ONE SHOT recurs:
  a table, two hairline cubes, the copper target cube, a dashed copper
  MARK it belongs on, and a small 2-link ARM clamped to the table's
  far-left corner (`arm`, screen-space IK; it replaced a gripper on a pole
  from the sky). The shot has two LOOKS on the same geometry (`shot(look=
  "real"|"sim")`): real = a photo (wall, floor, filled table, soft shadows,
  viewfinder corners), sim = grid floor and hairline model — so real→sim
  and sim→real are true morphs. One caption per state, no invented numbers.
  IdleRest (Experience: the D435i over the table, its view cone on it) ·
  Act0 REAL (exploded view, light runs back up the cone onto the sensor die,
  the die becomes a dark 14×11 photosite array read out row by row — a
  rolling shutter — and the mosaic resolves into the photo) ·
  IdleUntrained (the arm grasps at air: a fading trail, an × at each empty
  grasp, never within reach of a cube — `WANDER`) · Act1 REAL2SIM (three
  view glyphs capture the scene, the photo dissolves into anisotropic
  Gaussian splats in its colours that tighten onto the surfaces, the grid
  and the model draw in under them) · IdleTwin (the twin SIMULATES: the red
  cube drops and bounces, `drop_state`) · Act2 SIM DATA (the twin shrinks
  rigidly into a 2×3 wall of randomised copies — layout, target start,
  floor tone — each arm runs its demonstration, dashed path; then a world
  model: observed frame → encoder → latents z0→z1→z2 with an action
  dropping into each step → decoded imagined frames, fainter) · IdleData
  (six demos out of phase) · Act3 TRAIN (the wall lands on a stack of
  demos, a frame is cut into a 4×3 patch grid whose patches fly to token
  slots, the instruction's words "put red cube on mark" join them,
  cross-attention arcs word ↔ red-cube patch, four slabs; then forward
  passes (copper, down) and backward passes (ink, up) while the predicted
  action chunk (copper dots) converges on the demonstration's (ink rings)
  and the training loss falls) · IdleTrain · Act4 SIM2REAL (the network
  FadeTransforms into a "VLA" chip, the twin draws in at the real framing,
  the chip flies on an arc into the arm's base, and the grid gives way
  front to back to the photo) · IdleReal (the SAME shot as IdleUntrained,
  now succeeding: pick, place on the mark, a tick, the action chunk's
  waypoints ahead of the gripper; the episode resets by fading the cube
  back to its start). The tracker is NOT in S0 (the owner: "the real to
  sim to real bar is showing up too early"); it draws in at Act1. Text
  always FADES in (`show`): `Write` drew heavy white outlines in the dark
  theme. Labels are FRAGMENT MONO (`manim/fonts/FragmentMono-Regular.ttf`,
  the site's woff2 converted with fontTools; licence beside it); it has
  no → or π glyphs.
- **An act counts as finished at t ≥ 0.985** (`DONE` in LeftFilm.jsx):
  a snap on a real screen (fractional device pixels) could land a hair
  short of the section top, leaving t at 0.999 — the idle never started
  and the scrub sat a frame short of the finished text (the owner: the
  last letter was missing and only the last page animated). At DONE the
  scrub seeks to the TRUE last frame. Tested at 2x DPR with snapping on.
- **The camera is 3D** (IdleRest and the start of Act0): a small renderer
  in left.py (`cam_parts`, `render_parts`) — extruded outlines rotated by
  yaw/pitch, back faces culled, faces shaded by a light and depth-sorted,
  a mild perspective — because Manim's Cairo 3D sorts whole mobjects and
  painted cylinder caps over the front plate. It hangs over the table at
  the top of the stage, yaw 0.42 / pitch 0.62 (tipped down onto it),
  swaying ±0.32 rad at rest; it explodes along its own depth axis.
- **LeftFilm hides a clip until it has LANDED** (`visibility: hidden` from
  the source change until the first `seeked`/`loadeddata`): the old clip's
  frame used to stay up while the new one downloaded — the camera, showing
  on Additional Projects (the owner saw it). All five act clips are
  prefetched once the reader leaves the hero, and the act position is
  re-measured on every update and on a body resize.
- **Seams are exact by construction**: every act starts by adding
  `S(K-1)()` and ends with `finish(SK())`, the same builders the
  next act and the idle loop use.
- **Manim quirk**: `set_opacity` also sets FILL opacity, which fills
  outline-only shapes (a frame, a curve) solid white. Use `fade(m, a)`.
- **Render**: `MANIM=/path/to/manim scripts/render-left.sh [scenes]` renders
  both themes and encodes `Media/web/leftfilm/<theme>/<Scene>.{mp4,webm,webp}`.
  Manim is not in npm; this box has it from conda-forge via micromamba (pip
  needs the cairo/pango dev headers, which need root). ~11 MB for both
  themes; one act is 0.2-0.4 MB (mp4).
- **Encoding**: act clips are rendered at 20 fps (idles at 30; `left.py` switches on the scene name — a scrubbed act is ~a frame per 9 px of scroll, and its size is per frame) with EVERY FRAME A KEYFRAME (`-g 1`) so a scroll
  seek lands at once; idles use a normal GOP and loop. The MP4 (H.264,
  hardware-decoded almost everywhere) is 510x990 (1.5x); the WebM (VP9,
  the software-decoded fallback for browsers without H.264, e.g. Linux
  Firefox) act clips are 340x660 — at 1.5x a decode per scroll step
  dropped frames there (p90 33-49 ms).
- **The player** (`LeftFilm.jsx`): two <video>s (scrub, idle) in the
  `.f3d--left` stage. The scrub clip's `currentTime` follows `actAt(y)`,
  ONE seek in flight at a time (`pump`, on `seeked`); when `onSettle`
  reports a held state (before act 0, or the end of an act) the idle clip
  loops over it. Clips are fetched WHOLE and played from blob URLs: they
  are small, and a blob is seekable whatever the server does with byte
  ranges (Python's http.server has none, and the act clips sat on frame 0).
  The next act and idle are prefetched. The stage fades in as the hero
  leaves. No mask: the clips are rendered on `--background-color`, and a
  CSS mask over a scrubbed video cost frames.
- **Measured** (headless Firefox, VP9 in software): acts 1, 2, 4, 5 p90
  17 ms; Projects → Additional Projects (the world-model clip and the UR
  pair together) p90 33, ~7-10 of 59 frames over 20 ms. 0 mutations on a
  still page (the idle clip is video playback, not DOM writes).

## The hero, and the sine field that becomes the camera and the motor

The front page follows the old `/portfolio` hero, at the owner's request: a
full-viewport band, a portrait disc (269px since Oct 8, in a glass bubble; `Media/hero/frontpagepfp.webp`,
imported so Vite bundles it) above the name, the keyword chips, and the gold
sine field behind all of it. **The tagline and chips name the work the owner
is looking for** — "Robotics engineer working on embodied AI — VLAs, world
models, reinforcement learning and simulation", chips Embodied AI · VLAs ·
World Models · Reinforcement Learning · Simulation · Robotics — in the
owner's own words; the page title, OG/Twitter text, JSON-LD description and
`knowsAbout` say the same. They used to describe the current job (Edge AI /
machine vision). The claims rule below is about the SKILLS list; the hero
states a direction, at the owner's instruction. The hero's scroll cue goes to Experience — there
is no About section in between any more. **Scroll, and every row is cut at the
centre line: the LEFT half flies straight from the big field into the camera,
the RIGHT half into the motor, part by part, top to bottom.** Then both pieces
hold. That is the whole animation.

"Straight" is the owner's word and it is load-bearing: an earlier version first
shrank the rows into the two side panels (a compressed wave field in each
stage), cross-faded canvases, and only then morphed. There is no intermediate
stage now.

**There is no gold glow on the page.** `body` used to paint a 10% accent
radial gradient at 10%/10%, fixed to the viewport, and the owner saw it as a
warm light leaking in from the left. Its neutral partner at 90%/80% stays.

- **The field is NOT in the hero.** It is `WaveField.jsx`, one fixed
  full-viewport canvas first in `.page-flourish-layer`, which rides the page by
  drawing itself offset by `-scrollY`. It draws EVERY strand the whole way,
  because it is the only canvas that spans both the field and the two stages.
- **Its numbers are /portfolio's, read from its source** (`SineWave.tsx` in the
  other repo): 1000x350 virtual box, 25 rows, amplitude 8, frequency 0.04
  (0.02 in portrait), -25° phase per row, opacity 0.8 → 0.1, the wave mirrored
  about the centre (`sin(|x-500| + phase)`), the mouse bulge, the 50ms-stagger
  drop-in entrance. Keep them in `src/waveField.js`.
- **The timeline is in HERO HEIGHTS scrolled, not page progress** (`S_MORPH`,
  `S_ART` in `waveField.js`), so adding a section below does not move it. The
  per-part schedule (`partStart`, `partT`, `partArtA`, `strandFade`) lives
  there too, because BOTH canvases run on it: the field moves a part's
  strands, the piece fades that part's real drawing in.
- **The pieces publish where the strands land** (`publishTargets` /
  `targets`). Each captures its finished frame once — `cap` makes
  submitLines record projected polylines tagged with their part (`capId`)
  instead of drawing — keeps the lines ≥18 drawing-units long (fine LOD
  detail arrives with its part's drawing, not as a strand), ranks parts top
  to bottom, and publishes. The field builds its plan from that: a side's lines
  dealt across the 25 rows in part order, each half-row cut into one fragment
  per line. Alphas are multiplied by the stage's CSS opacity, because the
  strands land on a canvas without it. Republished on a theme change
  (colours) and a resize.
- **How a strand moves**: it FLIES as a rigid wave — turned to its line's
  direction, scaled to its length — until its midpoint sits on the line's
  midpoint, then BENDS the short remaining distance into the line. **What was
  tried and read as scribble, each seen:** a straight lerp (averages a wave
  with a circle: a knot); gathering to the line's centre (every ring of a part
  shares one: a pile); laying the strand head first like a thread (every
  strand became a long straight straw); and morphing all 268 motor lines
  rather than the 103 long ones. The whole model fading in at the end made it
  pop; per part it does not.
- **Idle rules still hold.** The field redraws only while something moves: the
  entrance, the drift (hero on screen, tab visible, ~30fps because it moves
  ten pixels a second), the bulge while the pointer is over the hero. Past the
  morph the canvas is cleared once and nothing runs. It is drawn on every
  machine; the pieces stay gated on core count, and a half with no piece to
  become just fades.
- **Frame cost, measured in Firefox**: p50 17.0-17.1ms still in the hero and
  while scrolling through the morph. Under the SwiftShader Chromium harness
  the hero reads 66-100ms — that is the CPU rasteriser emulating a GPU for a
  full-viewport canvas under five `backdrop-filter` chips, not the page.
  Measure frame time in Firefox, not there.

## The pieces (`src/components/Flourish3D.jsx`)

Two decorative pieces fixed to the viewport in the `page-flourish-layer`
(`App.jsx`), skipped only when `navigator.hardwareConcurrency <= 4`: a
**camera on the left** (`side="left"`) and a **motor on the right**. Both are
formed from the hero's sine waves (previous section), **hold as one still
frame each on the Experience page, change once between Experience and
Research (act two, below), and then hold again for the rest of the page — no
other scroll sequence, no idle spin.** In the two held states scrolling
redraws nothing at all (`held()`).

**What changed, at the owner's request (Sept 2026):** both used to run
page-long sequences — the camera tearing itself down into a
vision-transformer pipeline, the motor laid out as an exploded view and
threading itself onto a spinning axle, with a free-running propeller at the
bottom. Those are gone. The camera went entirely for one release and came
back as a static piece. Much of what follows is the history of the renderer;
where it talks about the explosion, the pipeline, or progress through the
page, it describes code that no longer exists — `LAID_OUT`, `revs`, the idle
spin and the vision pipeline are in git history (the camera's teardown and
pipeline at `3e5b1c3`).

**The camera is a DRAWN RealSense D435i** (`D435` at module scope,
`drawD435` in the closure): from Intel's dimensional drawing, a 90x25x25 mm
bar with a stadium front profile, an aluminium body, a dark front plate with
the four apertures left to right — IR imager, IR projector, IR imager (the
50 mm baseline), RGB — and inside, the stereo module board with its three
barrels and the main PCB. Six parts, each with an explode station along +z
and an order; the MODULE is its own part because it is what comes out and
becomes the pixel array. It replaced the baked mesh (below) in the third
round of "the depth camera seems a little broken": Intel's export is open
B-rep patches, and after orienting, sealing, rim-capping and budgeting it
still had torn plates and lattice fins. Big clean shapes read as a sim
render, which is what the owner asked for. Framing: `CAM2` = k 2.55 at
(-4, -10), the camera's own yaw 34 / pitch 8, the VIEW at yaw +26 / pitch
15 / dolly -70 — **the view's yaw has the same sign as the camera's**: with
opposite signs the two cancelled and the exploding parts slid straight at
the viewer, foreshortened to nothing. `drawD435` sets that view itself at
rest, because the hero's capture pass draws it before any act has set one
(`cam()` was null and the page threw at load). The old DSLR (`CAMERA`,
`CAM_TURN`) and the mesh path are gone; `src/robots/d435i.json` is deleted
and the bake entry is `skip: true`.

**The acts: one transition per page boundary** (`ACTS` / `actAt` in
`waveField.js` — each runs from a fifth of the way down its first page to the
top of the second, measured off the pages themselves, so every act ENDS at a
settle point):

| | right: a robot | left: seeing |
|---|---|---|
| Experience → Research | the motor lands on the **SO-ARM101**'s base servo and the arm grows out of it | the camera explodes to its **sensor** |
| Research → Major Projects | the SO-ARM **turns into** a **Franka Research 3** | a **VLA** runs on the pixels and the instruction; its action chunk is the Franka's joints |
| Projects → Additional Projects | the Franka **turns into** the right of **two UR5e** hanging from Generalist's frame; the left unfolds beside it | a **world model** imagines rollouts of the tracked object |
| Additional Projects → Skills & Resume | the workcell becomes the **Ultra OP1**: the Fairino rises from its cart, the two URs become the unit's arms | the world model becomes a **simulator**: randomised twins, a return curve |
| Skills & Resume → Get In Touch | the OP1 becomes **Boston Dynamics' Atlas**, which **waves goodbye** while the reader is on the last page | the simulator holds |

**Sept 27: the left acts 2-3 run DOWN the stage** (the owner: "more
tailored to world models and VLAs from vision"; it was a small side-on
stack with overlapping instruction words). Act 2: the camera frame at the
top (`SENSOR_VLA`) → its 12 patches fly out as VISION TOKENS plus one
OBJECT token for the red cube (the owner's DGAM idea) → LANGUAGE tokens
("put the red cube in the box") → four wide transformer layers, attention
fanning from the token in focus → the ACTION CHUNK (the Franka's joints).
Act 3: the instruction goes, the action chunk rises into its place as
CONDITIONING, the rollouts are drawn on the frame, and IMAGINED FRAMES
t+1..t+4 come out of the bottom (`drawFilmstrip`); settled, the bars are
the right UR's joints (`urNow`). `drawWMRest` is act 3's end state, drawn
fading by act 4 so the seam holds (0-16 px). Act 4 begins with a 3D
GAUSSIAN SPLAT condensing into the sim twin (the owner's Real2Sim work),
captions "real2sim twins · randomised", "success · policy trained in sim".
What follows about the old act 2/3 layout is history.

**The left half is the LEARNING half** (the owner's targets: robotics, RL,
world models, simulation, VLAs, embodied AI), and it is WIRED to the right:
- **The object is the RED CUBE** the robots handle on the right (the owner:
  "have the object detector detect a red cube"): the two brightest photosite
  buckets are red (`pxColor`), `DETS[0]` sits ON the bright blob (it did
  not), the world-model act draws it as a detector would — red box, corner
  ticks, "red cube · 0.94" — and the simulator stands it up in `MAT.red`.
- **VLA** (`drawInferAct`): the picture is cut into patches and fed, with the
  INSTRUCTION as a row of language tokens (`drawTokens`), into the layer
  stack; out the far end comes the ACTION CHUNK (`drawActionBars`) — seven
  joint bars and a gripper bar that are the Franka's joints read from
  `RB.fr.task` at the same clock (both pieces reset `idleT` on the settle),
  so what the left emits is what the right does.
- **World model** (`drawDetectAct`, name kept for the dispatch): the stack
  folds back into the picture, three candidate ROLLOUTS of the tracked object
  fan out on it (`rollAt`), the model keeps one, and ghost frames of the
  picture recede into the future with the object further along it in each
  (`drawFutures` — ONE function, drawn by this act and laid down by the next).
- **Simulator** (`drawWorldAct`): the picture lies down into a ground plane
  and the objects stand up on it, then the scene is copied — two randomised
  twins beside it, tinted and re-arranged, re-randomised every 2.4 s while
  settled — and a return curve climbs with an episode counter. The `scene()`
  closure draws all three.
- **Captions** (`caption()`): the stages are NAMED in small monospace type —
  "instruction" with the actual words as tokens ("stack the red cube
  first"), "vision-language-action policy", "action chunk · 7 joints +
  grip", "world model · 3 rollouts, 1 kept", "t+4 · imagined", "domain
  randomisation", "return · training in sim". Projected through the same
  camera, drawn straight to the context after the geometry (text is not
  depth-sorted), skipped in capture mode. The ghost frames carry IMAGINED
  PIXELS: the sensor's grid re-lit with the blob moved along the kept
  rollout, so a future frame looks like a picture the model made, not an
  empty card.
  Things that ran off the stage's inner edge and were pulled in: the action
  chunk (now under the stack, not beyond it), the twins (±88 at 0.42), the
  return curve.

**Each settled robot does a JOB, with real props** — the owner asked for
them by name: the SO-ARM101 picks up one cube and puts it down (A to B and
back), the Franka stacks two cubes on a third and unstacks them, the UR pair
packs an item each into a box (Generalist's demos), the OP1's arms fold a
box's four flaps up and put an item in it. The cubes are RED, GREEN and BLUE
(`MAT.red/green/blue`), at the owner's request. How that works (`TASKS` in
`Flourish3D.jsx`): a task is a loop of joint-space waypoints `W` (eased,
`period` seconds, the gripper's value riding in W too), a tool point (body +
mm offset), cubes, and EVENTS — cube c picked up at waypoint `at`, put down
at `drop`. **A cube rests at the tool point of the waypoint it is next picked
up at (or was last put down at) and rides the tool point in between, so the
gripper is on it by construction.** The waypoints are solved offline by
numerical IK in `scripts/ik-poses.mjs` — damped least squares on a numerical
Jacobian, position plus a tool-axis direction (pointing down), seeded to pick
the elbow branch — from where the props are in the robot's frame; the
comments there say where. `W[0]` is the rest pose every act morphs from and
to, so seams stay at 0-2 px. A loop that does not return to its start (an
item packed) `reset`s over its last segment: props fade, go home, fade in.
Props fade across act boundaries with their robot (out over the first
quarter of the next act, in over the last quarter of their own). Lessons:
hand-tuned joint angles never put a gripper on a cube (that is what the IK
is for); the SO-ARM bunched up when its cubes were at 200 mm — they are at
250, and its shoulder lift is kept positive; the Franka's cubes at 520-660
mm projected off the stage — 400-510; the URs' items beside their mounts
sent the arms past the frame's posts to the stage edges — the items sit
between mount and box.

**The UR pair is Generalist's** (generalistai.com, GEN-0 / GEN-1 videos):
two UR e-series coming DOWN from a heavy black frame over a dark table at an
angle, packing things into boxes. **The gripper** (`drawURGripper`, Oct 7,
from the GTC photo: "the grippers on the ur robots still doesn't look
right") is a Robotiq-style adaptive two-finger gripper: a black coupling, a
flat black CAMERA PUCK across it (a racetrack overhanging one side, lens
underneath), a short tapered black body, and per side a black link swinging
out to a knuckle, then a long yellow printed LATTICE finger (`MAT.ochre`,
windows drawn as lines) running down and IN to a pointed black tip. The
linkage is solved from the gap in q[6] (pads at ±gap/2). It used to be two
straight yellow bars under a bar, too short: the tool point is now 175 mm
past the flange (`UR_TCP` 275 on wrist_3's y, was 230), so the UR waypoints
were re-solved in `ik-poses.mjs` (seeded from the old branch, `BRANCH`, so
the arms keep their poses; the multi-start had flipped the left arm's
elbow). Closed tips stop ~10 mm above a 60 mm item's bottom, so a placed
item never puts them through the table. The frame
(`drawFrame`) is black posts and a crossbar set back (`MOUNT_Z`) with the UR
bases on canted blocks under it: `leaning` = standing, turned over (a half
turn about the stage's z), then tilted `LEAN` (28°) about the stage's x
toward the viewer. **Leaning breaks the left/right symmetry**, so the two
arms' waypoints are solved separately (`UR_W_R`, `UR_W_L`) with the props
stated in STAGE coordinates and brought into each arm's frame in
`ik-poses.mjs` — the same construction the renderer uses; keep the two in
step (`UR_LAYOUT` is printed for that). They pack the same box, drawn under
the right arm's drop point. **The table is narrower than the frame**: its
near edge sits toward the viewer and perspective grows it ~15%, and at the
posts' width it reached both stage edges. Earlier versions were a light
goalpost frame with the arms hanging straight down, and before that a stand
with the arms ON a beam; the owner said neither looked like the robot.

**The Ultra OP1 is a FAIRINO arm carrying Ultra's bimanual unit**, drawn
from Ultra's own photos (ultra.tech): a black steel cart on four casters with
the electronics and a black pedestal the white Fairino rises from, a tall
thin signal pole with a lamp; on the Fairino's flange a black upright torso
with a top plate, a panel seam, an orange logo and an e-stop, a ZED on a
short mast on TOP of it looking forward, and two black arms off the torso's
top corners — a shoulder block hung off the corner with a yaw drum on top
and an orange-ringed pitch drum outboard, a cable sagging from the torso's
back to it, upper arm with its module seam, orange-ringed elbow, forearm,
orange-ringed wrist pitch, a wrist roll down the tool axis — ending in
parallel grippers with a wrist camera on the body, pads on the fingers'
inner faces and orange tips. **No two of its solids share a volume**: the
shoulder blocks used to sit INSIDE the torso's top, the torso's back face ON
the flange face and the coupling drum INTO the wrist mesh, and coplanar or
intersecting solids sorted by centroid z-fight as the arm moves — the
"clipping and glitching" the owner saw. The torso now stands 12 mm off the
flange (`unitFrame`) with the coupling filling exactly that gap. (A first cut
drew two Franka arms on a torso, from Ultra's published spec; the owner
rejected it — "it should not be two Franka emika arms. The base is a fairino
Robot, with a custom bimanual robot on the end, with a zed camera as eyes".)
The `ultra` robot in the bake is the **FAIRINO FR20**
(`fairino_description/fairino20_v6.urdf` + its seven SolidWorks STLs, from
MNikoliCC/fairino_ros2 — URDF joint origins are roll-pitch-yaw, so the bake
and loader take `rpy`: R = Rz·Ry·Rx) plus a `zed` body carrying the
**Stereolabs ZED 2i** mesh (`zed-ros-interfaces/meshes`). **The unit itself
is drawn** (`drawUnit` / `drawSmallArm`, in a frame built by `unitFrame`: x
where the ZED looks, y across the shoulders, z UP, origin at the torso's
bottom centre, mm). That frame is UPRIGHT whatever the wrist does — the
flange normal projected flat gives the facing, the torso hangs half a depth
in front of and 210 mm below the flange — so the torso reads as a payload.
The Fairino rest pose (`RB.ul.rest`, j4 −0.9 / j5 1.57) was chosen by
scanning the wrist joints for a HORIZONTAL flange normal; at the earlier
pose it pointed straight down and the torso had nowhere to hang. The small
arms are a hand-written chain (shoulder at (0, ±165, 300), links 260/250/120;
`smallArmFrames`), posed by `{pitch, roll, elbow, wrist, open}`, their
waypoints IK-solved in `ik-poses.mjs` like the others: the box (`OPB`, base
200 mm below the torso's bottom on a packing table in front, flaps hinged on
its four edges) is folded flap by flap (`unitTaskState`'s `flaps`), then the
item on the table is put in. The Fairino sways between jobs (`fairinoSway`), only while the unit's arms
are off the props. **The small arms' waypoints are checked, not eyeballed**:
`scratchpad`-style harnesses (`armcheck2.mjs` in the session's scratch)
sample the cardinal spline between waypoints and report the closest the two
arms' links come and the lowest fingertip against the table top. What they
found: at the old REST the arms hung straight down, and a 630 mm arm from a
shoulder 500 mm above the table put the fingertips 80 mm INTO it ("the
ultra arm is going through the table"); and `roll` in this chain swings an
arm INWARD, so the IK had both arms crossing toward the box's centre ("the
bimanual arms are touching each other"). Now: REST is IK-solved with the
elbow up (tip 140 mm above the table), roll is capped near zero in
`ik-poses.mjs` (a little inward only for the drop into the box, when the
other arm is at rest), each arm's second flap is grabbed on its own side of
the box (y ±120), and the drop is on the right half (y 100). Along the whole
spline the arms come no closer than 276 mm and the lowest tip is 14 mm
above the table.

**The last act is a humanoid waving goodbye** (`drawHumanoidAct`, Skills &
Resume → Get In Touch; the owner: "the very last animation at the bottom of
the page should be a humanoid robot waving away", then "make it the atlas
humanoid"). It is **Boston Dynamics' ATLAS** — the DRC-era v5, the only Atlas
with a public model: Drake's `drake_models/atlas` (`atlas_minimal_contact.urdf`,
glTF visuals, Apache-licensed), fetched by sparse checkout of
RobotLocomotion/models into the scratch models dir. The bake gained two
readers for it: `bodiesFromURDF` (links → bodies, each revolute joint's
xyz/rpy the child's frame and its axis the joint axis, fixed joints bodies
without an axis, a depth-first walk from the root so parents come first —
which fixes the q order; the bake PRINTS it) and `readGLTF` (every primitive
of every node, node transforms applied, uint8/16/32 indices, and `gltfYUp`
turning glTF's +Y-up into Z-up — Drake's convention for its own glTF
geometry; without it the robot lay on its back). The left arm is the right
arm's meshes turned round (its joints carry rpy π), not mirrored, so no
negative scale was needed. Budget 200 a file, the torso 520, pelvis and
head 260, hands 220: 30 parts, 6.0k triangles, 121 KB; the page draws at
~1,060 calls, in line with the SO-ARM's. Before the Atlas the act shipped
one release with the Unitree G1 (Menagerie, `bodiesFromMJCF`); its bake
entry is kept `skip: true` and its JSON is gone.

**A pose is written by JOINT, keyed by the joint's CHILD LINK** (the body
that turns), and `humQ` turns the map into q in the bake's body order once
the robot has loaded (`humPoses` builds rest, folded and the wave lazily —
`RB` is built before the meshes arrive): back_bkz → ltorso, back_bky →
mtorso, back_bkx → utorso, neck_ay → head; arms shz → clav, shx → scap,
ely → uarm, elx → larm, uwy → ufarm, mwx → lfarm, lwy → hand; legs hpz →
uglut, hpx → lglut, hpy → uleg, kny → lleg, aky → talus, akx → foot. **Its
zero pose is a T**, arms straight out, and **the root body is the PELVIS**,
0.93 m above the soles with the legs straight (`HUM_PELVIS`), so
`humBase()` lifts the standing placement by that much off the floor point
and the floor ring is drawn `HUM_PELVIS` below the pelvis frame. **Signs,
from rendering poses through `?dev`** (five a screenshot): `l_arm_shx` rolls
the left arm in the frontal plane, −1.3 hanging at the side, +1.3 straight
up; `l_arm_elx` bends the elbow in that same plane, so with the upper arm
raised out at 45° (shx 0.75) the forearm swings toward and away from the
head — which IS a wave: elx 1.6 is the hand up beside the head, 1.15..1.95
the swing (`HUM_WAVE_*`); `l_arm_ely` turns the bending plane (at 1.5 the
forearm points at the viewer). The right arm mirrors shz, shx, elx and mwx.
The wave is a joint-space loop like the other jobs (`humQAt`, the same
spline: stand, raise, three waves with a wrist flick, lower, stand; 8 s),
blended to rest by `settleU`, on a faint floor ring (`drawFloorMark`). It
waves the LEFT hand: at yaw 255 it faces the reader a little from its left
and that hand is toward the page, not the screen edge.

**The transformation**: the cart and props go first; the Fairino folds down
into its pedestal and fades; the UNIT — Ultra's torso with the ZED for eyes
— lifts off the flange and travels to where the Atlas will stand, growing
from 0.17 to 0.25 px/mm (`lerpT`), and the Atlas grows out of it torso
first (`HUM_ORDER`: utorso, mtorso, ltorso, pelvis, head, then clavicles
and gluts outward to the hands and feet), unfolding from a crouch
(`foldedMap`: hips −1.2, knees 2.1, ankles −0.9, back 0.35, arms hanging
with a little more bend — at elx 2.0 the forearms swung out sideways and
the crouch was as wide as the stage) to standing as it arrives. **Its base
is re-placed every frame so that its torso IS the travelling frame**:
`gBase = TL ∘ (base⁻¹ ∘ Tq)⁻¹` (`invT` inverts a placement — rotation ×
uniform scale — as mᵀ/s²), which is what makes one object become another
instead of two fading past each other; with the torso pinned to the final
frame while the legs still unfolded, the feet went through the floor, so
the travel and the unfold end together (t 0.72) and the last quarter is the
arms arriving and the floor ring. The camera goes from the OP1's (16, −26)
to (14, −6): a standing figure is met near eye level, not looked down on.
The left side HOLDS the simulator through this act (`drawWorldAct(1)`); the
goodbye is the right's. Seam into it 8 px; Firefox through it p50 16.5.
Anything that enumerates the acts had a fifth added: `ACTS` in
`waveField.js`, the two dispatches in `draw()`, and the scratch harnesses'
`ids` lists (they were hard-coded to five pages).

**The left side's settled animations were smoothed in the same round** (the
owner: "fix up some of the animations on the left side"), each found by a
montage of the settled state at six moments: the world model's marker is
now the RED CUBE running the kept rollout with an eased run and a fade at
each end (a copper square that snapped back to the start every 3.2 s read
as a glitch) and the rollouts' dashes CRAWL while settled; the simulator's
twins GLIDE to each new randomisation over the last 0.6 s of the epoch
instead of popping (the jiggle phase is continuous through sin/cos), its
return curve climbs once over six seconds and then holds with a flickering
tail (it used to run 0 → 1 and snap back every seven seconds, a thousand
episodes a cycle), the episode counter ticks at 14/s from 1000, and the
"domain randomisation" caption sits above the ground plane's far edge, not
on its line.

**The act** (`drawUltraAct`): the frame and table fade as the cart comes;
the Fairino rises from the cart's pedestal body by body (`growOrder`, as the
SO-ARM grew from its servo) unfolding from an UPRIGHT packed pose (its zero
is the arm lying flat along −x, and unfolding from near zero swung it
through the stage's left edge); the two URs travel from their mounts to
where the unit's shoulders will be, in their working pose (their zero is
stretched out flat and folding toward it did the same), shrinking, and the
unit's arms fade in as they arrive; the packing table and flat box come
last. Seam into it: 0 px.

**The Franka has its hand.** The Menagerie's `franka_fr3` ships without one;
the Franka Hand meshes come from its `franka_emika_panda` (same part), the
hand body at `pos 0 0 0.107, quat 0.9239 0 0 -0.3827` on link7, two fingers
on SLIDE joints along the hand's y (0-40 mm). `bodyPlacements` takes a
`slide` body as a translation of `q` metres along its axis (scaled to the
bake's mm), so a Franka pose is nine values: seven hinges, two finger gaps.

**Sept 28 — the Atlas matched to Boston Dynamics' photos**
(bostondynamics.com/products/atlas: the hero, the "tri" photo and the
warehouse render, saved in the session scratch). No usable model of the
electric Atlas exists: Sketchfab's downloadable "Atlas" models are the old
hydraulic one or AI scans. So `drawAtlasE` now draws what the photos show: a
TALL BOXY white torso (a rounded-rectangle extrusion, not a barrel) with a
raised dark lower front panel and a wordmark strip, a narrow dark waist
actuator with a bright ring, big black BALL joints at the shoulders, hips,
elbows, knees (`ballProf`), a round head disc with a dark face, an ochre ring
light and a small antenna, on a thin neck. Panels sit 12 mm OFF the shell's
face — flush, they traded places with it in the depth sort and blinked.
**Two bugs found in its morph, both general**: `growPlacements` scaled an
ungrown body to exactly 0, and `detScale()` falls back to 1 for a zero
matrix, so the body was drawn at FULL size — a giant dark ball flashing
across the act (it is clamped to 1e-3 now; this could have hit any act that
grows a robot); and `drawMorph` drew the OP1's raw ZED mesh, blown up by the
size fit — `zed` is skipped and `skipIn` morphs cap the fit at 1.5.

**Sept 27.** The drawn Atlas is built from LATHE-TURNED solids (`solid` /
`lathe`, cached by profile; `limbProf`, `jointProf`), not boxes and plain
drums: tapered limbs swelling a third down and rounded at both ends, oval in
section, a barrel chest wide at the shoulders and narrowing to a dark waist
band, shoulder links from the torso's corners out to the arms' first joints
(the arms used to float), a slimmer grey pelvis, rounded mitts and soles, and
a domed head with a dark inset face and a double ring light. The modal now
CLOSES straight into `collapse` (no 260ms `departing` wait with an empty
surface); the content fades out while the card copy fades in and scales on
the surface's own clock (0.55s), then `settle` lands it as the card.

**Sept 26 round.** (1) The final humanoid is the CURRENT, electric Atlas
("should look like the current implementation of atlas"). Boston Dynamics
publishes no model of it, so `drawAtlasE` DRAWS it — pale capsule limbs, dark
joint drums, slim chest over a narrower abdomen, pelvis, and the round head
with its ring light (copper ring) — on the DRC Atlas's real skeleton from the
bake (bones between body origins: scap→larm, larm→hand, lglut→lleg,
lleg→talus), so the wave, the grow and the morph drive it unchanged. The DRC
meshes (`atlas.json`) are still loaded for the skeleton and as the morph's
target bodies. (2) UR pair → OP1 and OP1 → Atlas MORPH: the frame slides onto
the cart while shrinking and the cart grows out of it (`drawFrame`/`drawCart`
take an offset), the URs shrink onto the unit's shoulders while its arms grow
(overlapping windows), and the Fairino's links travel into the Atlas's
(`drawMorph(..., skipIn = true)`) while the Atlas grows. SO-ARM → Franka and
Franka → UR are `drawMorph` again (the owner: "have it actually morph… just
make it fluid"); drawHandover is kept but unused. (3) Measuring: another
session on this box can run Chromium at 800%+ CPU; frame times taken then
read p90 50-67 ms. Check `uptime` and wait for load < 4 before believing a
regression — idle, the page measured p90 17.2 in every act.

**Robot parts never FADE, and transitions are HANDOVERS** (Sept 25; the
owner: "the Robot animations all have disappearing parts/discontinuities").
Found by scanning every act at 41 steps (`actscan.mjs` + `montage.mjs` in the
scratch harnesses) and looking. Three causes, three rules: (1) a
half-transparent mesh shows its own far side and whatever is behind it, so
arriving and leaving are SCALE, not alpha — `drawRobot(robot, base, q, alpha,
grow)` draws every part opaque; `grow` (per body) scales a body about its own
joint and carries into its children (`growPlacements`), so a chain grows out
of its base still connected, and `alpha` < 1 shrinks the whole robot into its
base; the UR gripper, the OP1's unit and small arms, the packing table, the
frame and the cart grow the same way (`scaleT`, `scaleAbout`, `growUnitProps`;
the frame and cart about ONE anchor each — scaled about their own centres they
fell apart into floating bars). (2) `drawMorph` flew each link of A to where a
link of B stands; between different robots the links' ends never agree mid-
flight, and the arm came apart for half the act. `drawHandover` replaced it:
A folds and (optionally) slides its base onto B's while retracting tip-first,
B grows base-first out of the same place, unfolding — both always whole FK
chains (SO-ARM → Franka slides; Franka → UR retracts in place, `slideTo` 0,
because sliding up to the overhead mount left the stage). (3) The Generalist
table was a dark top over a slightly larger steel slab whose top face sat
0.5 mm under it; sorted by centroid the two traded places and the table
flickered grey / pale blue — it is one slab now. The frame arrives after the
Franka has folded away (it rose through the growing table). drawMorph is kept
for the record. Seams after: ≤23 px.

**A transition WAS a MORPH, not a swap** (`drawMorph`). The owner: "don't just
have each one shrink away and then the next one reappear". Each body of the
outgoing robot is paired with the body at the same fraction along the
incoming chain (`pairBodies`); over the act the outgoing body TRAVELS from
its own placement to its partner's — position lerped, rotation lerped and
re-orthonormalised with the scale carried separately (`lerpM`), so an
SO-ARM part at 0.66 px/mm can become a Franka part at 0.33 — while it fades
out, and the incoming body makes the same journey in reverse while it fades
in; base first, tip last (`BODY_STAGGER`). At u=0 the frame IS the outgoing
robot at rest and at u=1 IS the incoming one, which is what keeps the act
seams at antialiasing level. The incoming robot also unfolds from a packed
pose (`folded` → `rest`) during the morph, so it arrives moving.

**The robots WORK while the page is settled**, each at its job with real
props (see "Each settled robot does a JOB" under The acts): `taskState` /
`unitTaskState` give the joints and where every cube is at `idleT`. **Motion
is a cardinal spline through the waypoints** (`splineAt`, tension 0.42), not
an ease per segment — easing every segment to a halt read as stop-motion; a
repeated waypoint (the gripper closing) still holds the arm still. **And the
page moving does not snap a robot to rest**: `settleU` eases 1 → 0 over
`RETURN_MS` (700 ms) and every task blends joints and props toward its rest
frame by it (`taskState`'s `u`), the loop running until it arrives; settling
fresh starts the clock at 0, whose pose IS the rest frame. The Fairino
SWAYS between jobs (`fairinoSway`), only while the unit's arms are off the
props. The cycle's first waypoint is the rest pose, and
the instant the page moves the robot is drawn at rest, so the next act's
morph starts from the frame this one ended on. Before this they swayed two
joints on a sine (`swayQ`), which read as wobbling, not working.

**The machines are the REAL ONES.** The owner rejected two rounds of hand-drawn
approximations ("looks nothing like the SO-ARM101", "use actual 3D models
before doing things willy nilly"), so the SO-ARM100, the Franka FR3, the UR5e
and the RealSense D435i are their MuJoCo Menagerie models, baked by
`scripts/bake-robots.mjs` into `src/robots/*.json` and posed by forward
kinematics from the MJCF body trees. How that works, and what it cost to get
right, is under "Baked meshes" below. The procedural skins that follow are the
FALLBACK drawn until the JSON chunks (51-153 KB each, lazy) have loaded, and
what remains of the earlier attempts: SKINS over one kinematic chain (`SKIN`,
`skinSoarm` / `skinFR3` / `skinUR`) with a BASE per robot (`drawBase`): the
SO-ARM101 by dark servo blocks with horn discs, a two-plate printed upper arm
sandwiching the elbow servo, a boxy printed forearm, boxy jaws, and a round
base with the base servo in a housing — SHORT and CHUNKY (`P_2R.L` 98/84:
links barely three servos long), in WHITE `MAT.pla`, the one material here
that is a pale off-page body rather than a page-coloured one. The first
version was two long slotted bars and one servo, in the same near-black as
everything else on the dark theme, and the owner said it looked nothing like
the robot: proportions and colour are what make it one. Keep the ink clear of
the stage's right edge by ~40px — the stage overhangs the screen by 14-20px
(`.f3d--right { right: clamp(-70px, -1vw, 0) }`), and the first version's
wrist was cut off there; the FR3 by pale rounded tube
links, a dark band at every joint, a round pedestal and long thin parallel
fingers; the pair by two UR arms (constant-diameter tubes, short cylindrical
joints) on a STAND (`drawStand`: column, beam, a mount at each end, a camera
bar above, a work surface in front). An act interpolates the POSE and
crossfades skin and base (`blend`), so one machine becomes another without
the chain jumping. **The motor shrinks INTO the SO-ARM101's shoulder servo**
(`motorK` 1 → 0.3 while `motor` fades and the skin fades in, `skinA`): a
servo IS a small motor, and the SO-ARM101 with the full motor still on its
shoulder read as "motor with an arm", not as the robot. The first bimanual
was a humanoid torso with a head; the owner's reference is Generalist's
workcell — two URs side by side on a stand — so it is that now.

**The left side is the seeing half**: sensor → the picture cut into patches
and fed through a stack of layers with an activation running through it →
boxes with corner ticks, label tabs and confidence bars → the picture lies
down into a ground plane and what was found in it stands up on that ground,
with the camera's frustum behind and a dashed predicted path forward.

**Every arm state is ONE parametric drawing** (`armChain`), with the acts
interpolating its PARAMETERS (`P_2R`, `P_6D`, `P_BI_R`, `P_BI_L`, `lerpP`)
rather than swapping drawings. If you add a state, add a params object, do
not add a second drawing.

**Check the seams by pixel diff after touching any act** — an act's first
frame must equal the previous act's last one. Measured across all six
boundaries: ≤272 pixels of 224,400 differ, which is antialiasing. Three real
jumps were found this way and fixed, and they are the three things to get
right when adding an act:
- **the camera**: each act must START at the yaw/pitch/dolly the previous one
  ENDED at. A 4° difference tilts the whole scene at the boundary.
- **anything the previous act was drawing** has to be carried in and faded
  out — the sensor's package and pads, the patch grid, the detection boxes.
- **anything both acts draw must be drawn by the SAME code**: the layer stack
  is `drawLayerStack`, called by the act that builds it and the act that
  folds it away. When they each had their own version, one drew fills and
  cells and the other only outlines: 9,000 pixels of jump.

The 6-DOF arm is the 2R arm plus the three things that make it six-axis: a
**base joint it yaws on** (which is also what turns it out of the plane), a
short third link, and a **wrist cluster** (pitch then roll). The motor stays
as the shoulder housing throughout — that thread from the hero's waves is
worth keeping. The bimanual pair is two of those arms at 0.56 scale on a
torso with a sensor head (two lenses: the camera side of the page in
miniature), posed differently and working out of phase (`workP(P, ph)`).
Fitted by ink box; the first cut ran the right gripper off the stage edge.

**Act one: the camera explodes** — as an EXPLODED VIEW, the way a teardown
drawing shows it (`drawCameraMesh` with `t` > 0, for the real D435i;
`CAM_EXPLODE` is the same idea for the drawn fallback): every part slides
along the optical axis to its own station (`CAM_PARTS_OUT`, in units of
`CAM_EX` = 150 px — the RGB lens and glass farthest forward, the front plate
and its labels behind them, the board a little forward, the PCB and the
casing back), front parts first (`CAM_ORDER`), and STAYS there, whole, while
the view HOLDS its three-quarter angle so the stations fan out across the
stage. Only once it is apart (t ≈ 0.45) do the parts fade, the view square
up, and **the sensor COME OUT**: the stereo module (`d435i_4`) leaves its
station, travels to the centre of the stage turning to face the viewer and
shrinking to the die's size (`lerpT` from its station frame to a `facing`
frame at scale 2 with its front face on the die plane, z 16), the drawn
package forms AROUND it in its own frame, and its photosites light as it
fades — the module becomes the pixel array (`drawCameraMesh` returns the
module's frame; `drawCameraAct` builds the die frame from it, undoing
`facing()`'s half turn so the die ends at `SENSOR_HOME`'s identity and the
next act starts where this one ends). The owner asked for the left side to
flow, "like the sensor from the camera actually coming out and becoming the
pixel array"; before this the sensor drawing grew out of the board's
position while the board faded. Two traps: lerping the module's rotation to
an UNflipped target is a 180° lerp and collapses through zero (keep the
flip on the target, undo it on the die); and the photosites sit a depth
slab in front of the module's face while it is there (z 4 → 1.5 as it goes),
or the two interleave within a slab and flicker. The owner asked for it to "explode properly":
the first version moved the parts a fifth as far and faded them while still
moving, so the camera dissolved rather than coming apart. Keeping the fan ON
the stage took three things together, each measured by ink box: short
stations (`out`, in mm: lenses +48, plate +32, module +14, body −16, PCB
−30), the view pulling back as it opens (dolly −70 → −115), and the whole
assembly drifting 20 px toward the outer edge (`drift`), where the stage
overhangs the screen — the lenses fan toward the INNER edge. **The sensor is what is left**: it
turns to face the viewer and grows (`SENSOR_SCALE`), the die fades as its
8x6 photosites light to their own values (`pxVal`: a soft bright blob, so the
grid IS an image, not graph paper), and bond pads round the package make it
read as a chip. **The motor becomes a 2R arm** (`ARM`): it swings its axis
round to point at the viewer — the joint axis of a planar arm — shrinks into
the shoulder actuator and drops its propeller; a column and plinth rise under
it; link 1 grows off the output shaft swinging down from vertical; the elbow
drum appears; link 2 grows and bends; a wrist and two-finger gripper close the
chain. Links are extruded stadiums (`stadium`, wound like `CAM_SIL` so
`extrude()` culls them the same way). `held()` skips redraws in every held
state — before the first act, and at each act's end. Fitted by ink box: the
2R arm 16-325 of 340 wide (the first cut ran the gripper off the right edge
and the plinth into the left one), the 6-DOF arm 45-303, the bimanual pair
39-325, the sensor 45-294. Measured in Firefox: p50 17.1 / p90 17.2 over a
pass down the whole page.

**They are NOT gated on width.** They used to be hidden below 992px, which
meant every phone saw none of them. The stage now sizes itself from CSS
(`--fw` / `--fh` on `.f3d`) and the renderer reads that back and scales its
output to match, so a phone gets a smaller, cheaper canvas rather than nothing:
0.45 megapixels of backing store at desktop, 0.14 at phone width, with the
device-pixel-ratio cap dropping from 1.5 to 1.25 there as well.

**Everything on both stages is drawn 15% smaller than its numbers say**
(`ZOOM` 0.85 inside `cam()`, about the stage centre): the owner asked for the
robots and the left side smaller, and one factor in the projection is the
one place that does it — robots, props, the camera, the pixel grids, the
captions' anchors. The caption type scales with it too (`caption()`), because
the token chips under the VLA's picture are geometry and 9.5px words
overran them. Every ink box quoted in this file from before Sept 2026 was
measured at 1.0.

**W and H inside `Flourish3D.jsx` stay 340x660 whatever the viewport does.**
That is the DRAWING coordinate system, and every fit, camera constant and LOD
threshold in the file is expressed in it — only `ctx.setTransform` changes.
Resize the stage in CSS and nothing about the composition needs re-tuning.

**On a PHONE (≤768px) the pieces live in a DOCK** (`RobotDock.jsx`,
`.f3d-dock`): a band across the bottom of the screen, ABOVE the content
(z 20 — sections are z 10, the header 1000, the modal 2000), with both
stages side by side in it. The owner asked for the animation to be
"viewable in mobile mode"; behind the text in a 390px column it was not
(the earlier answer — smaller, fainter stages staggered vertically behind
the column — is what tablets 769-991 still get). The dock is the pieces'
own fixed layer on every screen: on a desktop it is `inset: 0; z-index: -1`,
identical to the field's layer, so nothing there changed. It is SEPARATE
from the field's layer because on a phone it has to sit above the content
while the field stays behind it. Its height is
`min(19vh, 40vw, 160px)` since Oct 8 (was `min(32vh, 70vw, 300px)`; the owner: "in mobile, make the animations smaller") — the second term is what two 340:660 stages fit
across at that height — and each stage is sized from it (`--fh: dock / 0.74`,
the drawing's ink runs y 120-615 of 660, so the top 20% is cropped by the
dock's edge and 6% hangs below the screen). The hero is shortened by the
dock and the FOOTER (the last thing on the page, and outside `main`) gets
the dock's height of bottom margin; on `main` it left the footer behind the
dock. The dock's background is transparent at the top of the hero and
solid once the page has scrolled 40px (`.is-solid`): the strands slide
under its edge and the pieces form inside it, and the content that follows
scrolls behind it. A tab (`▾ animation`) collapses it to 24px for reading,
remembered in `localStorage` (`robot-dock`, wrapped in try/catch) as a
per-viewer convenience; collapsing dispatches a `resize` so the field and
the stages re-measure. The core gate is ≥4 now (was >4): mid-range phones
report exactly 4. Verified on a 390x844 @2x touch viewport: dock 390x270 at
y 574, stages 188x365 each, ink in both canvases at every settle point,
`::before` opacity 0 → 0.44 mid-morph → 1, footer clear of the dock, no
page errors; the desktop settle frames and seams unchanged.

### Baked meshes: the real machines

**These meshes ARE the CAD.** The files are the manufacturers' own exports:
Franka's from `franka_description` and UR's from `ur_description` (via the
MuJoCo Menagerie), **TheRobotStudio's own SO-ARM101** (`so101_new_calib.xml`
and its 13 STLs from the SO-ARM100 repo's `Simulation/SO101` — the Menagerie
only has the SO-ARM100, and the owner asked for the 101), Intel's for the
D435i — at 20-135k triangles a part. When the owner said the result looked
"mesh-like instead of sim-like", the fault was the pipeline, not the source:
cutting to 2,000 triangles and drawing a line along every facet edge. A sim
render is many triangles, SMOOTH shading, and no facet lines.

`scripts/bake-robots.mjs <models dir> [--only=id]` reads the meshes (~140 MB,
fetched to a scratch dir, NOT committed) and per part: welds vertices BY
POSITION (the Menagerie OBJs carry a vertex per face corner — 88k for 63k
faces — so by index almost nothing shares an edge), bakes each geom's own
pos/quat into its vertices (the SO-ARM101's MJCF places every mesh with an
offset inside its body), winds consistently, DECIMATES by quadric edge
collapse (`scripts/qem.mjs`) to a face budget — a robot lands at 6-9k
triangles, the camera ~6k — winds again, and writes ONLY vertices (0.1 mm)
and faces, plus material, body and file name, with the body tree (positions,
quaternions, joint axes) copied from the MJCF by hand. The loader
(`src/robots/index.js`) derives the rest once at load: face normals, SMOOTH
vertex normals, edge adjacency, and which edges are CREASES. Shipping those
tripled the JSON; deriving them keeps a robot at 120-300 KB.

**Why quadrics and not clustering.** Vertex clustering (snap to a grid,
merge) was the first decimator and at 5-7k triangles it left exactly what the
owner saw — "I can still see the triangles… some of them seem a bit broken":
slivers, irregular triangles across smooth surfaces, torn patches. It does
not know what the surface is. Edge collapse removes the edge whose removal
moves the surface least, so tubes stay round and flats stay flat. The
implementation is 200 lines and two things made it usable: the faces-per-
vertex lists are pruned as they are walked (unpruned, the camera casing ran
a quarter of an hour without finishing), and a refused collapse is simply
remembered rather than invalidating every other edge on its vertices (which
starved the heap). It also enforces the LINK CONDITION — no collapse that
would join two vertices twice — because a non-manifold fin breaks the winding
propagation downstream. Boundary edges carry a stiff constraint plane, which
is why welding by position had to come first: every false seam was being
preserved, and the Franka came out hatched.

`submitMesh` in `Flourish3D.jsx` draws a part as front faces — culled by
screen winding, shaded by the MEAN OF THE THREE VERTEX NORMALS (`meshTone`: 56
steps, ±0.42 range, tint first then shade, so a white robot goes white to
grey in shadow) — plus lines: the SILHOUETTE, found from the smooth normal's
sign change (not the winding: on a decimated curve the winding flips at every
wobble and drew a hundred outline fragments) — AND, since the lag round, by
the winding as well: an edge is a silhouette only where both tests agree
(`fra !== frb` and the smooth normals' signs differ). The smooth test alone
drew every dimple of a decimated printed part — a screw boss, a slot's floor
— as a starburst of little outline fragments inside the surface, which was
much of the SO-ARM's "glitching textures" — and CREASES (per robot: 80° for
the boxy printed SO-ARM, whose right angles ARE its drawing; it was 62° then
72°, and at 72° every fillet and rib of a printed part still qualified; 74-78°
for the organic shells) at 0.3 strength. Edges under 4px on screen are
skipped (3px before ZOOM). On the dark theme the lines are at half strength
— pale on near-black, a dense set reads as a wireframe. **Lines were two
thirds of the SO-ARM page's draw calls** (1,300 a frame, 450 without them);
these three changes took the page to 890.

Things learned by getting them wrong, in order:
- **The cull was INVERTED for two releases, and closed shells hid it.**
  `MESH_FLIP` was set on the reasoning that a y-down stage is left-handed. It
  is not — every placement is a proper rotation — and the effect was that
  every front face was culled and every back face drawn. On a closed tube
  that is almost invisible: you see the inside of the far wall through the
  same silhouette, shaded a little oddly. It is what made the SO-ARM's servos
  show THROUGH its arm, the printed parts look transparent, and the camera's
  front plate vanish (573 of its 900 faces had smooth normals toward the
  viewer; 41 of those passed the test). Found by counting, not by looking:
  the ink looked "a bit broken" for a month. If a mesh ever looks see-through
  again, check which side is being drawn before touching the bake.
- **Winding, twice.** STL exports wind triangle by triangle at random — a
  third of some SO-ARM parts the wrong way — and the renderer culls by
  winding, so those faces vanished and the part was a see-through wireframe.
  `windConsistently` propagates one orientation across shared edges; then
  `orientOutward` turns EACH CONNECTED SHELL outward by the sign of its own
  volume — a servo is a body plus a horn plus a cable, and one decision for
  the whole part left the small shells inside-out. Both run before AND after
  decimation.
- **Intel's D435i is not shells, it is B-rep patches.** Both copies online
  (the Menagerie's and `realsense-ros`'s `d435.dae`) are the same CAD export,
  tessellated one B-rep face at a time: 75k boundary edges in the body,
  vertices on one patch lying in the middle of edges on the next. Welding
  cannot stitch a T-junction, and a patch has no volume to orient by. So an
  OPEN component is turned by the CENTRE test instead — does it face away
  from the part's centre? — patch by patch where the patch agrees with itself
  and face by face where it does not (a ring round a lens faces both ways);
  the inner skin of the hollow casing fails the test and is culled from every
  view, which is right. Its patch borders are NOT drawn (`patches` in the
  JSON): they are tessellation seams, not edges. The front plate needs a real
  budget (900) — at 110 its patches came out as a torn handful of triangles
  and the casing's open front showed its ribs. **Rebuilding it as a closed
  shell from its volume was tried** — voxelise the assembly at 0.3 mm, flood
  the air from outside, blur, naive surface nets, decimate — and pinched at
  every lens aperture (hundreds of non-manifold edges the decimator could not
  pass), leaving torn surfaces. Two hours; not worth more.
- **Black trim gets a depth bias — on the Franka only** (+1.4 toward the
  viewer, `MAT.poly` fills of `part.rid === 'fr3'` in `submitMesh`). The
  Franka's base band and joint rings are black parts sitting flush ON the
  white shell; within one depth slab the two sort by style, the white won
  half the band's triangles, and the band came out as a row of teeth. On
  the SO-ARM the black parts are SERVOS inside white printed holders, and
  the same bias pushed them through their housings as the arm moved — the
  first "glitching textures" the owner saw (the second round's were the
  interior silhouette starbursts and the blinking edges, above). The SO-ARM's
  crease angle went 62° → 72° at the same time; its printed fillets drew as
  a lattice. The Franka's
  base (`link0.obj`, seven material groups) has its own budget of 1500: at
  480 shared across the groups it came out a torn tent. It looked like a decimation defect and survived a sliver
  rule in the decimator (kept — `SLIVER` in qem.mjs refuses collapses that
  turn a decent face into a needle) before the cause was found.
- **Rims may not coarsen** (`maxBoundary` in qem.mjs, 2.5mm for the camera).
  The boundary constraint lets a rim vertex slide freely ALONG its rim, so a
  round opening's rim polygon loses vertices until the bezel's triangles run
  as chords across the hole — pale wedges cut across the camera's front
  plate at the lower casing budget. Capping boundary edge length keeps a
  rim round; it costs faces, which is why the camera sits above its budget.
- **Mesh fills are SEALED where the seam would show**: after each run of
  same-toned triangles is filled, the same path is stroked 0.7px in its own
  colour (`m` on the bucket entry, set per fill in `submitMesh`: the fills
  that CONTRAST with the page — the pale materials on the dark theme, the
  DARK materials — poly, iron, steel — on the light one; `dark !== darkMat`.
  A hairline of near-black page inside a dark-grey servo is invisible, and
  the seal is a second rasterisation of every fill it is on). Adjacent triangles of different tones land in different fill
  calls, and where two anti-aliased edges meet the page shows through as a
  hairline — on the dark theme a pale robot came out wearing its whole
  wireframe. It was dark-only for a release, on the reasoning that
  near-white through near-white is invisible; true of the white shells, but
  the light theme's BLACK parts (the Franka's joint rings, the servos) showed
  every seam as a pale hairline — "I can still see each individual
  triangle". Sealing EVERYTHING on the light theme was tried and doubled p90
  (17 → 33ms) for seams no one can see.
- **"Use something other than STL"** was asked. The triangles are not the
  file format's — an OBJ, a DAE or a tessellated STEP is triangles too; they
  are the decimation budget and the per-face tone. Two knobs: budgets went up
  ~1.5x (SO-ARM 620, Franka 720 + base 1800, UR 380, Fairino 640, casing
  3600; 6-11k triangles a robot — at 2x, p90 went 17 → 33ms) and
  `MESH_RANGE` came down 0.42 → 0.30 so the tone step between neighbouring
  faces is smaller. Then, the round after ("I can still see the little
  triangles... it should be using larger shapes like cylinders"), **the
  lighting is BANDED** (`MESH_BANDS` = 6, `bandLit`): the per-face light is
  quantised to six levels before `meshTone`, so whole regions of a surface
  share one tone, the triangle edges inside a band vanish, and what remains
  is a few contour bands following the light — a cel-shaded sim look.
  `?bands=N` compares (0 = the 56-step ramp). **Bands have hysteresis**
  (`HYST` 0.2 of a band, per face, `part.bands`): a face near a boundary
  otherwise hops between two greys as the arm turns — measured at a 16ms
  step, 4-16 faces a frame on the settled SO-ARM and Franka, halved with it;
  a small sparkle, not the glitch, but free. **White PLA is greyer on the
  light theme** (`PLA_LIGHT`, ~9 levels under the page at its brightest):
  tinted #EEEAE2 and lit full-on it came out AT the page colour, so the lit
  side of the SO-ARM and the Franka vanished and only shadow bands and lines
  were left — a hollow, wireframe look the dark theme never had. The limit of a flat-filled
  renderer is that each triangle is ONE tone; true Gouraud needs per-pixel
  shading, i.e. WebGL, which this file has been through and rejected (see
  ONE renderer). Where a shape is drawn rather than baked — the camera, the
  OP1's unit — it IS cylinders and boxes, and those are smooth by
  construction.
- **Triangles under two thirds of a pixel are not drawn** (`area < 1.3` in
  `submitMesh`, after the silhouette test has used them). At 0.2-0.33 px/mm
  a third of a decimated arm's faces are that small, and each was a bucket
  entry, a sort key and a path segment. **A skipped face stays FRONT for the
  lines.** For three releases the skip also cleared `MESH_FRONT`, so every
  crease and silhouette edge beside a sub-pixel face blinked out and back as
  the arm moved and the face crossed the size threshold — half of the
  one-frame pops on the settled SO-ARM (3,330 → 1,465 per 90 frames with
  the skip's line effect removed; `?noskip` had shown the same number). The
  silhouette test needs the face's facing, not whether it was worth filling. With this, dark-only sealing and the
  budgets below, the page measures the same with the acts redrawing every
  other frame as it did redrawing every fourth: p50 17.0 / p90 17.2 in
  Firefox with the lanyards running. **The lanyards are the other half of
  every long frame** — with their WebGL off the page holds p90 17.2 whatever
  the art does — so a heavier robot shows up first on the Experience and
  Research pages, where the badges are.
- **Budgets** (faces per mesh file, `bake-robots.mjs`): SO-ARM101 460, with
  the servo STL — one file placed five times, a fifth the size of the base —
  at 300 and the mounting plate at 220 (6.9k a robot), Franka 540 + 1350
  for the base + the hand schedule at three quarters (7.3k), UR5e 285
  (5.8k), Fairino 480 (3.8k); a group is never under 100. The camera is
  drawn, not baked (see the D435i). **A quarter came off every budget in the
  lag round** (Sept 2026, from 620 / 720+1800 / 380 / 640) when the stage
  ZOOM went to 0.85: 15% smaller on screen wants 15% fewer faces for the
  same screen density, and the banded shading hides the rest — checked by
  montage at every settle point, both themes. Before that the SO-ARM was
  10.7k faces and the most expensive page by half.
- **Do not peel interiors.** A `peelInterior` pass once dropped inward-facing
  faces from hollow shells to stop them showing through. It opened a boundary
  around every hole it made, every boundary edge is an outline, and the parts
  came out covered in lines. Inside-out shells were the real cause of the
  see-through, and per-shell orientation fixes that; inner surfaces face away
  from the viewer and cull themselves.
- **Facets are not features.** At 28°, then 55°, the decimation's own facets
  qualified as feature edges and the robots read as wireframes; the crease
  angle is per robot now, and nothing is drawn along a non-crease edge.
- **The camera's pitch sign: POSITIVE LOOKS UP.** `setCam(yaw, pitch, dolly)`
  with a positive pitch puts a floor point toward the viewer HIGHER on
  screen than one away — the camera is below the floor, looking up. Every
  act ran at +10..+28 for two releases, believed to be "looking down", and
  the owner saw the robots "from under angles" with the table tops hidden.
  Checked numerically (project (0,0,±100) at ±20°), then flipped: the acts
  now end at −8 / −18 / −22 / −26 on the right and −16 on the left's ground
  plane, each act starting at the pitch the last one ended on. If a scene's
  floor is hidden, check the sign before moving anything.
- **Frames.** MuJoCo is Z-up; `standing()` turns Z to screen-up and scales mm
  to stage px; the camera uses `facing()` (its sensors are on +Z, so Z stays
  toward the viewer and Y is flipped with a half turn). MuJoCo quaternions are
  (w, x, y, z); its default euler sequence is intrinsic xyz.
- **Signs.** In this UR5e model a positive elbow bends the forearm UP.
- **Poses** (`RB`) are joint angles in each MJCF's joint order — the task
  waypoints from `scripts/ik-poses.mjs`, the packed poses by hand — checked
  by screenshot at the settle points and by the ink bounding box; the stage
  overhangs the screen edge by 14-20 px, so keep ink inside ~x 20-320. The
  SO-ARM101's signs, from rendering each joint alone: +shoulder_lift tilts the
  upper arm toward its reach, +elbow_flex bends the forearm DOWN, +wrist_flex
  points the gripper down, +gripper opens the jaw. It stands at yaw 195 so
  it reaches into the page with its base servo toward the viewer; at yaw 30
  the forearm ran off the right edge.
- **Dev hooks, kept**: `?dev=<robot>:q1,q2,…;k;yaw;x;y[;tilt]` draws one baked
  machine at that pose on the right stage (this is how the G1's joint signs
  and its wave were found: a pose per screenshot, five at a time), on the OP1's body at half alpha
  for reference, tilted as a shoulder-mounted arm when `tilt` is given (and
  the camera on the left; `?dev=d435i;k;yaw;pitch` reframes it), `&part=0,5`
  limits the camera to those parts. Both need the page scrolled to just past the hero (`art()`
  runs there). They have paid for themselves several times. The dev view
  looks UP (pitch +12): fine for a part, misleading for a table top.
  **Profiling and glitch hooks** (all dev-only, none costs anything when
  absent): `?perf` writes each frame's `ms`, `flush` (raster share), `calls`
  (fill+stroke), `segs` and `flips` (faces that changed tone band) to
  `canvas.dataset` — a DOM write per frame, so never on by default — and
  installs `window.__f3dT_<side>(t)` to set the task clock; `?idledt=16`
  advances the settled animation a fixed 16ms per DRAWN frame instead of by
  wall clock, so a harness at 5fps still sees consecutive frames 16ms of
  motion apart; `?exact` sorts fills by exact depth (no slabs), `?nolines`
  drops the mesh lines, `?noskip` draws sub-pixel faces, `?sileps=0.03`
  puts a deadband on the silhouette test, `?hyst=0` turns band hysteresis
  off, `?bands=N` sets the band count.
- **A "flicker detector" over settled frames measures MOTION, not glitches.**
  Counting pixels that change and change straight back (A→B→A) on the
  working SO-ARM gave 0 pops with the animation frozen, 21 at a 4ms step,
  3,700 at 16ms and 9,150 at 200ms — thin lines and jaw teeth crossing a
  pixel in two frames are legitimate pops. It is only good for A/B: same
  page, same fixed step (`?idledt`), same frame count, one variant at a time
  (parallel Chromiums change the frame count). Used that way it found the
  blinking edges (skip fix) and cleared the sort: `?exact` (exact-depth
  fills) changed nothing visible and cost 4x the draw calls, so the depth
  slabs stay.
- **Chromium here cannot play the .mp4s** (no H.264) — check card videos in Firefox, where they play — so in the SwiftShader
  harness every card video shows its POSTER — `CoverVideo`'s `onError` path —
  and the network log shows the four `.mp4` requests as failed. That is the
  environment, not the page; Firefox and production play them.
- **Screenshot harness gotcha:** the settle snap moves the page two seconds
  after a scripted scroll and the eased glide takes a second, so mid-act
  captures were blank or of the wrong frame. `?nosnap` on the URL turns the
  snap off for harnesses.
- The morph's capture (`cap`) records mesh lines too, so the hero's waves fly
  into the real camera's outline.

### The ATLAS is the exception: rendered in WebGL (`atlasGL.js`), Sept 29

The owner, after two rounds of a drawn Atlas: "Is there a different way of 3d
modeling it without having the triangles show up? I feel like the current
method isn't working properly." They were right about the method: Canvas2D
fills each triangle with ONE flat tone, so any curved surface shows facets
however many triangles it has. The final humanoid is therefore rendered by
three.js on a second canvas (`.f3d-gl`) laid exactly over the right stage's
drawing box: rounded boxes, lathed shells, tapered cylinders and spheres, lit
per pixel (hemisphere fill, warm key, cool rim, ACES), a glowing ring light.
**It owns no kinematics**: `drawAtlasE` still computes every Atlas body's
placement (`growPlacements` — the wave, the grow-in and the Fairino morph
drive it unchanged) and hands them over with the stage camera (`camState`:
yaw, pitch, dolly). The mapping: stage space is x right, y DOWN, z toward the
viewer with a divide at 600 and ZOOM 0.85, so the GL world is (x, −y, z), the
camera sits at z 600 with fov `2·atan((H/2)/0.85/600)`, and the stage camera
becomes `rotation.x = −pitch` on an outer group and `rotation.y = yaw` inside
it. The robot is modelled per body in the URDF body frames (mm, z up, x
forward); limbs are bones between body origins. The module is lazy (6.5 KB;
three.js is already the badges' chunk), fetched from act 4, hidden whenever
a frame does not draw the Atlas, resized with the stage, disposed with it,
and absent where WebGL is not (the drawn `solid()` Atlas is the fallback).
This IS verifiable here — SwiftShader Chromium renders it (see the top of
this file) — which is the condition the rule below was waiting for. The rest
of the page stays line art. Harness note: a stage can now hold two canvases;
select `.f3d canvas:not(.f3d-gl)` for the 2D one.

**Sept 28, later: the hover LENS, a natural centre, a smooth modal close.**
The pointer no longer lifts /portfolio's bulge under itself: the rows PART
around it (a derivative-of-gaussian push, up above the pointer and down
below, `LENS_R` 46 / `LENS_H` 40 virtual units, windowed by (1 - d²/9R²)² so it reaches exactly zero at 3R — a hard cutoff there left a visible step in every row), the lens eases after the
pointer (`stepLens`, ~9/s) and fades in and out, and the loop runs only
while it is still moving. `CENTER_SOFT` 55 → 14: at 55 the soft centre
flattened a whole half-wave into a plateau ("looks a bit unnatural"); 14
rounds only the tip. The modal CLOSE (`Modal.jsx`): `CLOSE_S` 0.8 s on an
in-out curve (`CLOSE_EASE`) instead of 0.48 s of EXPAND_EASE, which did ~80%
of the shrink in its first 100 ms; the modal's text fades out over ~0.3 s,
the card copy fades in over 0.32-0.72 s, and the surface's shadow fades as
it lands (the resting card has none, and it used to vanish at the end).
Measured frame by frame: width 1280 → 235 over 0.78 s, ghost opacity rising
from 0.45 s.

**Sept 28, waves:** 34 rows (was /portfolio's 25) with the per-row phase
step scaled so the field keeps the same total twist; the stroke tapers
3.8 → 0.6 px on an eased curve (`pow(i/(ROWS-1), 0.75)`) so the upper rows
stay heavy; and the centre is no longer a V — the mirrored wave uses a soft
absolute value, `sqrt(d² + CENTER_SOFT²) - CENTER_SOFT` (55 virtual units),
in `waveY`. The numbers in "Its numbers are /portfolio's" below are the
originals.

**Sept 28: the resume and CV are IN THE REPO** (the owner: "commit this to
the repo so that a drive link isn't needed"): `Resume/Aadhav_Sivakumar_Resume.pdf`
and `Resume/Aadhav_Sivakumar_Extended_CV.pdf`, served from the site. The
viewer shows PAGE IMAGES (`Resume/preview/resume-N.webp`, `cv-N.webp`, 150
dpi) scrolling inside the frame, not an iframe: a PDF in an iframe is blank
on Android Chrome, one page on iOS, and Playwright's Firefox downloads it.
Clicking a page, or "Open PDF", opens the PDF itself; "Download" downloads
it. **To update: replace the PDF, run `node scripts/pdf-previews.mjs`
(pdftoppm + Pillow), commit both** — `pages` in `resumeDocsData` lists the
images and the build fails if one is missing (update the list if the page
count changes). The transcripts are hosted too since Oct 1 (redacted; see `resumeDocsData`). The old resume PDFs
in `Resume/` are unreferenced and left in place. The hero is ONE line over
the name now — "New York & San Francisco" (the role in front of it was
removed at the owner's request on Sept 30; the page title and share card
still carry it) — with the serif statement and the descriptive line removed
at the owner's request ("consolidate the information").

**Sept 29, header and share card.** The header is a three-column grid:
wordmark left, the page links CENTRED, and on the right the owner's
profiles (`SOCIALS` in Header.jsx: LinkedIn, GitHub, email, X, Instagram — the resume PDF until Oct 6)
as 17px line icons beside the theme toggle; on a phone the profiles sit at
the header bar beside the burger since Oct 8 (`.socials--bar`; they were at the bottom of the menu panel, `.socials--menu`, now hidden) and the toggle and burger
sit right. The link preview is `Media/web/og.jpg` (1200x630 JPG — WebP does
not unfurl on LinkedIn or Slack): the big AS mark, name, role, the gold
waves, rendered from an HTML page with Playwright; og/twitter image, type,
size and alt are set. Roboflow stays in the PRESENT tense everywhere (the
owner). Hero chips: Robotics first, Embodied AI last.

**Oct 6, projects consolidated (the owner).** The tactile sensor's card is
gone: its text is the UCSC entry's first bullet, its footage the UCSC
modal's gallery, its two lab links the modal's buttons (`links` on an
`experienceData` row — `toModal` turns them into buttons). PONG, the Sand
Table and the ASL glove are ONE card, "Advanced Mechatronics" (id 'b';
'a' and 'm' retired): PONG's cover, a section per build, both reports as
buttons, the Sand Table clips and the glove photo in its gallery. Twelve
small cards now (5 · 5 · 2). Note: the ASL glove was the Mechatronics
class, not Advanced Mechatronics; the card says so in its text.

**Oct 6, NYU footage.** The owner's three LAIR clips are the NYU entry's
modal gallery (`gallery` on `exp-nyu`): a first-person teleoperation view
(1), a simulated training demonstration of "put the cube in the box" (2)
and an ACT policy's successful rollout of it (3). Originals in
`Media/projects/x_nyu/` (not deployed), web copies
`Media/web/gallery/x_nyu/1-3.mp4` + posters (silent, crf 27, native size,
0.2-0.6 MB). The sim clips show the bimanual robot whose teleop data the
work used, as the owner sent them; the TEXT still does not name it.
Round 2 (same day): six more — VR teleoperation of that robot (4, first in
the gallery), setting up the SO-ARM101 stations (5) and the lab workstation
(6), unboxing (7) and wiring (8) the BlueROV2, and its OceanSim / Isaac Sim
camera flying over a reconstruction (9; CROPPED to the viewport — the full
frame had the Isaac Sim tab bar and a clideo.com converter watermark).
Silent (phone audio dropped), 960 px phone clips, crf 28-31. Order: 4, 1,
2, 3, 5-9. Colleagues appear in 6 and 7, as the owner filmed them.

**Oct 6, the glass is REAL now (navbar AND tags).** The owner asked
again ("are you using the glass things I sent… navbars and the tags").
GlassSurface's SVG refraction is ON in Chromium (`forceFallback` removed):
the earlier rainbow arcs were its colour split (red/green/blue offsets, now
all 0) and the "grey block" came from layering `blur()` before the
displacement in our own CSS (removed; a 50% page-colour tint keeps the link
text legible over the waves). Firefox/Safari get its frosted mode, as
upstream. Every tag is a GlassSurface too (`GlassTag.jsx`, carrying
`.project-tag` so the size/fit rules hold; the look is the `TAGS are
React Bits' GlassSurface` block at the end of App.css). FluidGlass is
still NOT used: it refracts only its own three.js scene, not the page's
HTML, and needs the ~3 MB r3f stack. The header's profile marks no longer
follow the pointer (Magnet removed) and are 46px targets with 28px marks.
Measured: Firefox scroll p50/p90 17.1, 0 mutations on still pages, pages
one screen.

**Oct 6, smaller asks.** No cursor caption on the cards any more ("don't
have the learn more appear next to the mouse"): LiftCard still supports
`tilt.caption`, nothing passes one. The lanyard badges' small text moved off
the monospace ("still looks AI generated"): name in Zodiak, role, dates,
holder, back meta and tags in Switzer with tabular figures, the hint below
in Zodiak italic.

**Oct 6, the navbar is floating glass** (the owner: React Bits' FluidGlass /
GlassSurface "to make the navbar look more modern"). On screens ≥769px the
header has no bar: three GlassSurface capsules (wordmark + theme, the links,
the profiles) float over the page (`Glass` / `useWide` in Header.jsx; phones
keep the frosted bar and menu). FluidGlass was NOT used: it needs
@react-three/fiber, drei and maath, the ~3 MB stack the badges dropped.
GlassSurface's SVG-displacement mode was tried in Chromium and REJECTED,
each seen: clear glass let the waves run through the link text again (the
problem the frosted bar fixed); the colour-split distortion drew rainbow
arcs; and its feImage map renders misaligned inside backdrop-filter (a grey
block in each capsule). So `forceFallback` (a prop added to the copy) uses
its frosted mode in every browser, with the liquid look in CSS: blur 14px +
saturate, a gradient rim (bright top-left, gold low-right), an inner top
glare; darker fill on the dark theme. GlassSurface.css was adapted to follow
the site's theme toggle (`data-theme`), not the OS setting. Also: the modal
OPEN no longer flashes black — its flyer starts as a canvas still of the
card's frame (`src/snapshot.js`, shared with the close) and the live video
fades in on `playing`.

**Oct 6, Resume page again** (the owner: skills "just show up on the left
side where the resume is", bigger Resume button, a page-with-text icon and
cascading pages for the CV). The skill chips no longer open a modal: they
switch the VIEWER to that group (`skill` state in Skills.jsx; a grid of
icon + name + description cards, `.resume-skills`); the document buttons
switch it back. The document buttons are larger (20px padding, 48px icons,
1.55rem titles) with drawn SVG icons: `ResumeIcon` (one page, a heading bar
and text lines) and `CVIcon` (the same page with two cascading behind it).

**Oct 6, video pass** (the owner: "go through all the videos on the site
and see if anything can be optimized… keep the original"). Every card cover
video now has a LIGHT copy, `<name>-card.mp4` — twice the card's display
width (480 small / 880 major / 900 experience), no audio, crf 29-30 — and
the CARD plays that (`cardSrc` in ProjectCard.jsx) while the MODAL plays the
full file; the build fails if a card copy is missing. 14.9 MB → 8.4 MB of
card video. **Card copies are FULL LENGTH on purpose**: trimmed to 8 s they
were 5.7 MB, but a modal closed at 20 s into a 37 s clip would land on a
card that cannot show 20 s, and the close would jump again. All mp4s were
already faststart. 1.5 MB of deployed media nothing referenced any more
(MATE ROV, the CV desk arm, the 2D lidar, the depth-camera card, Sluice) was
removed from Media/web; the originals stay in Media/projects. Not changed:
H.264 stays the codec (hardware-decoded almost everywhere; VP9/AV1 would be
smaller but software-decoded on many machines, which is the owner's lag
problem), and the long gallery clips (Roboflow 6 is 156 s) only load when
picked in a modal.

**Oct 6, Roboflow footage, round 2 + video continuity.** Five more of the
owner's clips in the Roboflow gallery (originals kept, NOT deployed, in
`Media/projects/x_roboflow/`; web copies `x_roboflow/10-14.mp4`): the arm
putting a bottle in a box (10), the Orbbec ToF live depth (11, title bar
cropped), the ZED 2i stereo live depth (12), and the rivet-detection demo on
a toy school bus split into its 3D reconstruction + rivet-column view (13)
and its 2D detections window with the live count (14) — the screencast was a
full desktop with a code editor, so only those windows are kept. The
"Recording_2026-04-02" upload is the SAME Orbbec clip as TOFlive with the
editor and terminal visible, so it is kept as an original only. Gallery
order: 1, 2, 13, 14, 11, 12, 5, 6, 10, 7, 8, 9. **The card and modal
videos now share one clock**: the modal's own video starts at the flying
copy's time (it restarted from 0), and on close the card's video is set to
the modal's close time before it is revealed (it had kept playing hidden and
reappeared elsewhere). Measured in Firefox: open 4.40 → 6.15 s after 1.8 s;
close at 8.17 → card resumes at 8.17.

**Oct 6, fonts again** (the owner: "stop using fonts that claude commonly
uses, change all of the standard ones"). Newsreader + IBM Plex (and Geist,
Inter, Instrument, JetBrains Mono, Space Grotesk, Fraunces, DM Sans) are the
defaults of AI-built pages. Now ZODIAK (display) + SWITZER (body) from
Indian Type Foundry's Fontshare (ITF Free Font License) and FRAGMENT MONO
(OFL), chosen from four rendered pairings, SELF-HOSTED in
`src/assets/fonts/` (Vite hashes them; licences beside them) — no Google
Fonts request any more. Gotcha found doing it: Fontshare's CSS API with
several families in one request registered only the first in Playwright;
download the woff2 files instead. Switzer's word space is narrow, so body
text has neutral tracking and `word-spacing: 0.05em`. Still in the OLD
fonts: `Media/web/og.jpg` (the Manim clips moved to Fragment Mono the same
day).

**Oct 6.** (1) UCSC's role reads "Undergraduate Research Assistant · TML"
(as NYU's carries "· LAIR"). (2) TAGS are small glass pills in the hero
chips' language (tinted fill with a top light, a gradient hairline rim, a
gold dot, warming toward the accent when the card is hovered); over a small
card's picture they are frosted pills; 0.8rem in modals. (3) The badge
"brush" nudge was COMPOUNDING: it added to the running velocity on every
pointermove (60-120/s), so hovering near a badge spun it wildly ("the
lanyard physics are messed up when I put my mouse close to it"). Now one
nudge per 250 ms, only from a quick sideways move, never while on the card
(the tilt owns that), speed capped at 70°/s. (4) The Resume page has no bar
above the viewer: "Resume" and "Extended CV" are LARGE buttons at the top
of the side column (`.resume-bigdoc`, title + page count), Open PDF /
Download for the shown document under them, then the transcripts.

**Oct 5, the modal's card copy keeps the card's type** (the owner: "when I
click on a card, all the text/fonts suddenly change… a discontinuity when
the modal is going back to the card"). The lifting/landing copy lives in
the modal, outside the card's grid, so every grid-scoped rule fell away the
moment it lifted. `frozenHTML` (App.jsx) now copies each element's COMPUTED
type, colour, box and flex/grid layout inline (`FROZEN_PROPS` — freezing
`display: flex` without `flex-direction` once laid a major card's title,
text and tags out side by side; freezing a gradient without
`background-clip` turned "Learn more" into a grey bar), and the small
card's pseudo-elements (scrim, tag dots) have `.modal-ghost` copies of their
rules. MEDIA-FIRST cards (small projects: the picture is the card) carry
their text and scrim INSIDE the flying picture (`media.overlay`, Modal
`.flyer-overlay`): held through the lift, faded as the expand starts, faded
back in over the last 40% of the close, so the card lands whole. Checked by
measuring real card vs copy element by element (identical up to the lift's
1.06 scale) and by real-time recordings of open/close for every card type.

**Oct 5, REACT BITS across the site** (the owner: "use [TiltedCard] for
the cards", then "refactor A LOT of things on the site with either
reactbits or framer components, as many as you can"). Sources are copied
into `src/components/reactbits/` with React Bits' licence (`LICENSE.md`:
MIT + Commons Clause — fine on a website, not to be resold) and a notice
per file; motion (Framer Motion) is the only dependency any of them needs.
What uses what:
- **TiltedCard** → `LiftCard.jsx` (every card): the card tilts toward the
  pointer on TiltedCard's springs, scales up, and a caption ("View
  project" / "Learn more" / "Read bio") follows the cursor, rotating with
  its vertical speed. The tilt is RESET synchronously on click so the
  modal measures the card at rest. Small project cards also take the
  component's LOOK: the cover is the card (15px radius, 4:3; 16:11 / 16:10
  on short screens), title and tags over it on a scrim, lifted 30px in z.
- **BlurText** → `SectionTitle.jsx` (replaced the anime.js letter cascade).
- **DecryptedText** → the hero eyebrow, once on view.
- **Magnet** → the header profile marks and every page's down arrow (the
  arrow's page-bottom position moved to `.page-next-magnet`).
- **Dock** → the Get In Touch links (adapted: real <a> links, fixed height).
- **ClickSpark** → gold sparks wherever you click (one fixed canvas).
- **StarBorder** → the Resume page's Download button.
- **SpotlightCard**, **GlareHover**, **ShinyText** → CSS adaptations: a light
  under the pointer on experience/major cards and the resume viewer; a glare
  sweep on skill chips, transcript buttons and modal buttons; a shine on
  "Learn more" while its card is hovered.
**Upstream loops that would have broken "a still page is still", fixed in
the copies**: ClickSpark ran requestAnimationFrame forever (now only while
sparks live); Magnet re-rendered on every mouse move anywhere (now writes
the transform directly, only near it); ShinyText animates always (used as
hover-only CSS instead). Measured 0 mutations in 3 s on all six pages.
**ProfileCard was tried for the about card and dropped**: its holographic
shine needs a dark cut-out portrait and texture maps; on this photo it
flooded the card with rainbow and white.

**Oct 5, MATE ROV replaced** (the owner) by "Underwater Drone for
Shipwreck Reconstruction" (id `'rov'`, same slot): the LAIR BlueROV2 work
from the Extended CV (built and deployed for 3D reconstruction of
shipwrecks; Isaac Sim 5.0 + OceanSim for mission planning — the CV says no
more, so neither does the card). The cover is a STOCK photo of the platform,
not the lab's unit: "BlueROV2 flying with ArduSub" by Yoleeth, Wikimedia
Commons, CC BY-SA 4.0 — the licence requires the credit, which is in the
modal with a link to the file page. Original in `Media/projects/o_bluerov/`,
web copy `Media/web/projects/bluerov2.webp`. Replace with the owner's own
photo when there is one.

**Oct 4, later (the owner):** the header is NOT enlarged at the top any
more (the Sept 30 large-at-top rules are deleted; 82px everywhere); the
theme toggle sits on the LEFT beside the wordmark (`.header-start`); the
profile marks are 40px targets with 22px marks (Gmail 27, PDF 26 — their
artwork is padded). Measured clear of the centred links from 1024 up.

**Oct 4, header and labels.** (1) The header's profile marks are the REAL
logos in their own colours (`SOCIALS` in Header.jsx: LinkedIn blue with a
white backing behind its cut-out letters, GitHub in the page ink, Gmail's
four-colour M, a PDF-red document); the Contact links match. (2) The
header is FROSTED GLASS in both states (the owner: the waves "clashing
with the navigation options"): a translucent page-coloured fill, blur 18px
+ saturate 1.5, an inner top highlight and a hairline — the waves become a
gold haze behind the links. One block at the end of App.css. (3) The
experience cards' "N highlights →" reads "Learn more →".

**Oct 3, type and the hero chips.** (1) The owner: "the font looks too
much like AI". Geist (the Vercel/v0 default) is gone: headings, the name,
page/card/modal titles, the wordmark and badge names are NEWSREADER (an
editorial serif, `--font-display`, applied by one rule after the premium
block's h1-h4), body and UI IBM PLEX SANS, labels IBM PLEX MONO. Chosen by
rendering the hero and a card in twelve candidates; neutral grotesks
(Plex, Instrument Sans, Hanken…) were indistinguishable from Geist at
heading size. Every page still one screen at the five sizes. NOT yet
re-done in the new type: the Manim clips' labels (Geist Mono, baked into
the video) and `Media/web/og.jpg`. (2) The chips are LIQUID GLASS again
("make it more cool/liquid glassy"): a near-clear body refracting the
waves through `#hero-liquid-glass` (displacement 18-30, broader noise), a
masked gradient RIM on `::before`, an inner top glare and bottom shade, a
soft lift shadow — one block at the end of App.css (`#hero .hero-chip`).
(3) The hero was not still: the filter ripple was an anime.js loop calling
setAttribute every frame and the scroll cue a motion loop — 510 mutations
in 3 s on an idle hero (found by the Oct 3 review). The ripple is SMIL
`<animate>` inside the filter (paused off screen via pauseAnimations,
removed under reduced motion), the cue a CSS keyframe paused by
`#hero[data-idle]`: 0 mutations now. The name's anime.js cascade now
honours reduced motion (it did not).

**Sept 30, Glass-2-Bot gallery.** The owner's three demo videos (red,
green, and green-and-red object detection) are the project's gallery:
originals in `Media/projects/c_glass2bot/demo*.mp4`, web copies
`Media/web/gallery/c_glass2bot/{1,2,3}.mp4` + posters. Unlike the other
gallery items they are FULL LENGTH (28-61 s: each is one complete run) at
their native 848x480, crf 29, and keep a 64k mono audio track (the player
starts muted, with controls): 1.2-3.0 MB each.

**Sept 30, Roboflow footage.** The owner's own work videos (nine, from
their Drive folder; the ~700 MB originals stay there, NOT in the repo) are
the Roboflow entry's modal gallery: `gallery` on the `experienceData` row,
passed through `toModal` in Experience.jsx (any experience row can have
one now). `Media/web/gallery/x_roboflow/1-9.mp4` + posters, 22 MB: SILENT
(phone clips carry room audio and colleagues' voices), 1280 wide for screen
recordings, 960 for phone clips, crf 28. Reviewed frame by frame before
publishing: the GTC quality-control screen recording is CROPPED to the app
(crop=3012:1476:6:308) — the full frame showed the browser's tabs, an
internal IP, bookmarks to internal tools and the dock. Order: part-presence
app, the stacked inspection view, the workcell, the annotated frames, the
QC dashboard, the xArm pick-and-place, the owner at the xArm, the arm with
a trim panel, gesture control. (Oct 6: the workcell and annotated-frames clips — files 3 and 4,
the modal's items 4 and 5 — were removed at the owner's request.)

**Sept 30, the header grows at the top.** At the very top of the page the
bar is LARGE (the owner: "make the navbar very large at the beginning, but
then as soon as it scrolls down have it shrink"): `scrolled` is set past
12px (was 50) and `header:not(.scrolled)` raises the padding, wordmark, link
type and profile icons, transitioned over 0.45s. Only from 1200px wide (121px
tall; at 1024 the large links would run into the profile icons) and bigger
from 1600 (150px); measured with no overlap 1024-1920 and the portrait
clear of the bar at every size. Phones keep the compact burger bar.

**Sept 29, lighter.** Three cuts, each measured:
- **Skill icons are SELF-HOSTED** in `Media/web/icons/` as
  `<iconify-prefix>--<name>.svg` (devicons as `devicon--<dir>--<file>.svg`):
  about 65 files, where there used to be 59 requests to the Iconify and
  jsDelivr CDNs at runtime. The monochrome sets (`mdi--`, `simple-icons--`)
  have no colour of their own, so the modal draws them as CSS MASKS in
  `--icon-resting-color` (`.skill-icon-mono`, the regex in `Modal.jsx`),
  which follows the theme; coloured devicons stay `<img>`. When fetching a
  new icon, check that the file is really SVG: Iconify rate-limits bulk
  fetches and answers "error code: 1015" with a 200-looking body.
  `@mdi/svg` and `simple-icons` on jsDelivr's npm mirror are the fallbacks.
  Linux is the simple-icons mark; the devicon one was 192 KB of paths.
- **Badge photos are WebP**, at most 360px: UCSC's went from 292 KB to
  41 KB. Roboflow's stays a PNG because its WebP came out larger. The unused
  Dublin High and "Researcher" badges were dropped from `badgeCards.js`.
- **The left side's drawn code is deleted from `Flourish3D.jsx`** (4,354 →
  3,450 lines): the D435 camera, the sensor, the VLA, the world model, the
  simulator, the arc and the mirrorless `CAMERA`. The left stage is
  `LeftFilm` (Manim) and has only ever mounted `side="right"` since then,
  so the hero's left strands just fade, as they always did without a piece.
  Main script: 502.7 → 485.5 KB (175.1 → 169.3 KB gzipped). Everything in
  this file about drawing the left camera, sensor, VLA and simulator is
  history now; git has it (before this commit).

**Sept 29, the Manim restyle** (the owner: "the background doesn't blend
in with the site. The manim animation still looks a little too AIcoded").
The clips are rendered on the PAGE'S OWN background colour (PAL.bg =
--background-color, light #F6F5F1 / dark #0C0C0D; measured across the stage
edge: ≤2 levels of 255 apart) — keep the two in step if the page colour
changes. (Rendering on white/black and blending with multiply/screen was
tried: the stage's opacity isolates the video and it blended against
nothing — a black box in the dark theme.) The drawing speaks the site's
language: ink hairlines, near-white fills, ONE accent (the target cube, the
flows, the tracker: terracotta #C0553A / #E0735A), no primary-coloured
props (the other cubes are hairline boxes, `iso_cube`), no drop-shadow
copies under the slabs and latent blocks, hairline frames, and Geist Mono
labels (since Oct 6: Fragment Mono, see the Manim section).

**Sept 29, premium pass round 2** (the owner: "take some time, do a few
renders, and make it an iterative process"). Found by rendering every page
and RECORDING the modal in real time (`openvid.mjs` in the session scratch:
Playwright recordVideo + ffmpeg frames — slowing the browser's animation
clock via CDP is NOT a valid test here, it slows CSS/WAAPI but not motion's
JS-driven top/left/width, so the frames mix two timelines):
- the lifting card copy showed its picture and a blank half: the card's
  grid comes from rules scoped to its parent and its odd/even position,
  which the detached copy did not match. `frozenHTML` in App.jsx now
  freezes each direct child at its measured offset; the ghost has no
  padding/border of its own.
- the ghost fades out as the expand STARTS (0.2s at OPEN_HOLD) so the
  growing media does not slide over text still fading.
- the modal × mounted visible and flashed on the lifting card: initial 0.
- the left stage DIMS to 0.28 while the lanyard column shares it
  (Experience, Research) and returns as the reader leaves.
- "policy · trained in sim" moved in from the stage's clipped left edge.

**Sept 29: the PREMIUM PASS** (the owner: "make the site feel less AI and
feel more premium. Look at the websites for very modern startups"). Looked
at Linear, Physical Intelligence, Skild AI and Figure: one neutral grotesk
at medium weights with tight tracking, monospace for small labels, a
near-monochrome palette, hairline borders, no gradients, no metallic gold,
no resting shadows. Implemented as ONE block at the END of App.css ("PREMIUM
PASS") that overrides by order, plus: Geist + Geist Mono (Google Fonts) in
place of Playfair Display + Poppins everywhere (`--font-sans`, `--font-mono`);
new neutral tokens (ink #111110 on #F6F5F1; #EDECE8 on #0C0C0D); the nav
pill a quiet surface pill (no gold gradient); section titles centred (left
ran into the left-hand art and the lanyard pins), weight 500, tight, with a
mono index over each ("01 /" … "06 /", `INDEX` in SectionTitle.jsx) and no
underline bar; cards flat with a hairline and no gold rule; tags monospace
and outlined, status a coloured DOT; buttons solid ink pills; an ink favicon.
The gold stays in the ART and in `--accent-*`. The modal backdrop is lighter
(0.32 light / 0.55 dark, 2px blur) and fades across the whole lift + expand
instead of in 0.4s. Copy: the Get in Touch line and the about teaser were
stock phrasing ("I'm always open to…", "this website is meant to
showcase…") and are plain statements now. Tag text is --secondary-color on
the surface: 5.3:1 light, ~6:1 dark (above the 4.5:1 floor).

**Sept 29, later.** (1) `actAt` counts t ≥ 0.985 as finished for BOTH
sides (a snap stops a fraction of a pixel short on a 2x screen). (2) The
settled work loop could miss its start: the page reports settled before
this piece's rate-limited redraw lands on the section top, so held(lastY)
said no and nothing retried — the SO-ARM stood still on Research.
`settledNow` + `idleKick()` in paint() start the loop from the redraw that
lands. (3) The 2R arm is drawn LAYER BY LAYER (a flush after each of base,
servo 1, link 1, servo 2, link 2): sorted by face centres, link 2's centre
lay far out along it and slipped behind the elbow servo it is mounted on;
in the SO-ARM act it is drawn after the SO-ARM. (4) The modal OPENS in two
beats: lift (22px, 1.06x, 0.42s), a 0.1s hold, then an in-out expand over
0.7s (`LIFT_*`, `OPEN_*` in Modal.jsx), the card copy and the flying media
on the same numbers.

**Sept 29, SO-ARM hand-over:** the 2R arm used to FADE out while lying in
the SO-ARM's plane; half-transparent faces interleaved with the SO-ARM's in
the depth sort and flickered ("glitching textures"). It stays opaque, 30 mm
in front, and SHRINKS into the shoulder once the SO-ARM has grown.

**Sept 28, the 2R arm's servos** (the owner: "the servo motors are not
oriented properly"): the output spline came out of the servo's big side
face. `planarServo(F, a, id, off)` now draws a hobby servo as one is: the
spline on the small 40 x 20 TOP face, 10 mm off centre, facing the viewer
along the joint axis; the 38 mm body running back behind it; the mounting
tabs off its short ends, a top seam. The shoulder servo sits body-down on
the base plate; the elbow servo lies back along link 1 (`off` -1), 3 mm
clear of it, with link 2 on its spline at z 48 and the pen's trace at z 64.

**Sept 28, sixth round.** Waves: a point every ~6 px joined by quadratic
curves through the midpoints (straight segments showed their corners on
the thick top rows). The D435i: the stereo module and the PCB were
rectangles wider than the casing's rounded ends (84 x 20 and 82 x 20 in a
stadium of radius 12.5), so their corners came out through the shell as
little tabs; they are 80 x 15 and 78 x 15 now. The CAPTURE CONE: the RGB
imager's 69° x 42° field of view drawn out from its lens (40 mm), a faint
pyramid with a frame of light sweeping out along it at every shutter while
settled; it goes as the camera explodes. The 2R arm: its layers touched
face to face (horn, link, servo, horn, link), traded places in the depth
sort and looked to pass through each other; they have gaps now (link 1 at
z 6, the elbow servo 20-40, link 2 at 46, the pen at 56). The HERO: an
eyebrow of tracked small caps between hairlines ("Robotics · Embodied AI ·
New York"), a serif statement ("Building robots that see, learn and act.",
the verbs in an accent italic with a slow sheen kept above 3:1, paused
off screen via `#hero[data-idle]`), the owner's descriptive line under it,
and the chips as fine glass pills — hairline gold border, near-clear
fill, tracked small caps — instead of the glossy gold gradient.

**Sept 28, fifth round: the waves are their own thing.** The owner: "you
don't have to make the sine waves become the animation, the sine waves can
be their own thing. hopefully that saves on compute/lag. Also, make the
waves a little thicker at the top and thinner at the bottom." `WaveField`
draws only the field now — full-width rows riding the page by -scrollY,
scrolling away with the hero, cleared past it — with the stroke tapering
from `STROKE_TOP` 2.8 px to `STROKE_BOTTOM` 0.7 px down the rows. The plan,
the strand flights and the pieces' capture/publish on every resize and
theme change are no longer run; `prelude` in Flourish3D fades each piece in
WHOLE (through `GMUL`) as the hero leaves. Everything the sections below
say about strands flying, `publishTargets`, `cap` and `partA` describes
code that no longer runs (the functions are still in the file). Measured
in headless Firefox the hero scroll was already p90 17.2 and is p90 17.1;
the saving is the capture and the per-frame strand maths on slower
machines.

**Sept 28, fourth round.** (1) The first piece on the right is no longer
the IEC motor with a fan: it is TWO SERVOS driving a 2R PLANAR ARM
(`drawPlanar`, `PL`, `PLANAR_HOME`) — a base plate, the shoulder servo, a
printed link, the elbow servo on its end, a second link, a pen — the
owner's sand-table arm. Settled, the pen traces a figure-eight by 2R
inverse kinematics (`planarIK`, elbow up) and leaves its line in copper;
the hero's waves land on it (it is what `art()` draws, captured per part:
base, servo1, link1, servo2, link2, tip). In act one it BECOMES the
SO-ARM's arm: it stays in its plane, slides and scales until its shoulder
is on the SO-ARM's shoulder and bends its joints onto the SO-ARM's upper
arm and forearm as seen, its base sinking, and holds there until the
SO-ARM has grown into it (a single 3D similarity was tried first and swung
the whole arm through space). The motor's data (`MOTOR`) remains only for
the parametric fallback drawn before the meshes load. (2) Skills & Resume
is the RESUME page (`Skills.jsx`, id still `skills`): the resume's live
Drive preview fills most of it, with a tab for the extended CV and "Open
full size"; a transparent button covers the iframe (a cross-origin frame
swallows the wheel, and the page could not be scrolled past it) and opens
the modal; the iframe mounts only when the page is near. Beside it, small:
the two transcripts and the eight skill groups as chips (each opens its
modal). `SkillGroupCard.jsx` and `DocStrip.jsx` are gone. (3) The DGAM card
is off Additional Projects (fourteen cards now); DGAM stays in the
experience and skills text.

**Sept 28, third round: the world model IS one; the gripper grips; the end
is 3D.** (1) Act 3 used to relabel the VLA's own stack "world model"; now it
draws a latent world model (Dreamer / Cosmos style): the frame's tokens
GATHER into z_t (the encoder), a chain of latent blocks (`drawLatents`,
`LAT_X`, `LAT_Y`) steps z → z' with an action dropping into every step from
the action chunk (the dynamics), and each predicted latent decodes down
into an imagined frame (`drawFilmstrip`). The VLA's layers and instruction
step back as it forms. The dashed "rollouts" are gone (`drawFutures`
deleted). (2) The pick loop is abstract keys (`PICK_KEYS`: spot, level,
open, phase) shared by the picture (`pickAt`) and the 3D table (`pick3At`).
The phases were one key late — the closed gripper lifted off without the
cube, then the cube rode up with the gripper after it let go — and the
fingers closed to inside the cube; now the phase is the cube's state during
the segment a key starts, and the fingers close onto its faces. (3) Act 5
is 3D: `drawWorldAct(t, real, pk)` — the same workspace the simulator stood
on turns into a solid table (grid, twins, curve, frustum fade by
`1 - real`), the cubes are cubes in their own colours at their own sizes
(`CUBE3`; heights used to come from detection confidence and the green and
blue went grey), and a 3D gripper comes down and runs the loop. Checked by
settled montages at 12 moments, 2D and 3D.

**Sept 28, later: act one rebuilt, acts 2-3 in depth** (the owner: "more
refined… maybe in 3d. The camera at the start should explode better and
expose the sensor more interestingly"). `EXPLODE` gives every D435 part a
3D displacement (plate up and forward, lenses further and fanned, casing
back, PCB back and down) while the view ORBITS (yaw 26 → -22, pitch 15 →
24, dolly -70 → -20); then everything but the stereo module fades, the
module comes to the middle at three-quarters (`TB`), the RGB lens barrel —
its own piece now, `RGB_BARREL`, lifted off the module solid — tips up and
away, light rays with photons run through the aperture onto the exposed
die, the photosites light as they land, and the die grows into
SENSOR_HOME as the view squares up (end state unchanged: act 2's seam 0
px). `drawD435(alpha, t, opt)` takes the plan (`e`, `fade`, `modT`,
`lift`, `modFade`); at rest it draws exactly as before, so the hero's
strands still land on it. Acts 2-3: tokens become CUBES as they arrive,
the layers and the action panel are solid slabs, and the view looks DOWN
on the stack from its left (act 2 ends at yaw -18 / pitch -14, act 3 at
-10 / -12, act 4 starts there). The tracker sits at y -270.

**Sept 28.** (1) The left side is ONE STORY, real → sim → real (the owner:
"too many words… just go from real 2 sim to real over the course of all the
animations, and include the most crucial terminology"): a tracker at the
top of the stage (`drawArc`: real · sim · real, a copper dot travelling —
real through acts 1-3, to sim over act 4, back to real over act 5); the
captions are only the key terms — "VLA · vision + language → action",
"action chunk", "world model", "imagined futures", "real2sim", "domain
randomization", "training in sim", "sim2real" — every other label is gone
(the instruction chips are blank). Act 5 is new on the left
(`drawSim2RealAct`): the simulator fades as one (`GMUL`, a whole-drawing
alpha multiplier honoured by fill, stroke, flush and caption) while its
ground rises back into an upright camera frame and the gripper runs the
pick loop on the real scene. (2) Modal: `html { scrollbar-gutter: stable }`
— the scrollbar vanishing under the modal's lock and returning on close
shifted the page; the media flight runs on the surface's clock (lifted and
scaled with the card, then grown over the same 0.6 s ease — it used to fly
over 0.85 s from the first frame); and a GALLERY per project like
/portfolio's: `gallery` in siteData (web-sized copies under
`Media/web/gallery/<dir>/`, from `Media/projects/<dir>`, 720 px, 20 s max,
crf 30, silent, a poster each — ~11 MB for 32 items), a thumbnail strip,
arrows and the arrow keys; items after the cover are letterboxed, not
cropped (portrait phone clips). The build's asset check walks `gallery` too.

**Sept 27, third round.** (1) "The texture changes between morphs is too
jarring": nothing SWAPS look any more. In act 5 the OP1 parts fade out over
a short window while the Atlas pieces fade in on top of them wearing the
SOURCE's look, then ease into their own materials as they travel
(`atlasGL.render(..., look)`: id → {k, src, op}; materials are per piece
now so one piece can be re-tinted). In Canvas2D, `submitMeshMix` draws a
mesh in a tone BETWEEN two materials (`mixTone`, quantised to three steps
— each step is a new set of fill styles); it replaced the stepped
poly → iron → steel → alu material changes of the beams → Fairino and the
UR → servo-chain morphs. (2) "Make the animations on the left more
engaging… too matrixy": the camera frame is a DRAWN SCENE now
(`drawScene`: a table, the red/green/blue cubes, a gripper) that the
photosites resolve into in act 2; settled, the gripper RUNS the action
chunk — a pick-and-place loop (`pickAt`, `PICK_PERIOD` 8 s) — and the
action panel shows that same path as 16 waypoints with the gripper's
opening; the layers are smooth slabs with a copper glow sweeping along
them and attention ARCS with pulses running down them (the cells are
gone); the world model's imagined frames are the scene further along the
loop, fading with distance; the detection box follows the cube. Act 4
lays the scene down as the ground. Measured: act 4 (Additional Projects →
Skills) now sits at the frame-budget edge in headless Firefox, 5-7 of 59
frames over 20 ms against 2-5 before — the Ultra unit's extra detail;
flat single-polygon horns (`SERVO_HORNS`) replaced drums to keep it there.

**Sept 27, second round (the owner: "the transition from the ultra to the
atlas is still really wonky"; "the ultra robot arms and body are not
detailed enough").** The pieces had flown on their own straight lines at
their own times and scattered. Now ONE carrier frame moves everything:
every point's coordinates in the unit's frame blend into its coordinates
in the Atlas torso's frame while that frame travels (`mapP`, `lerpT`), and
the groups (torso, arms, legs) leave within 0.04 of each other, so the body
moves as one and connected chains stay connected. The Fairino's upper arm,
forearm and wrist become BOTH legs (thigh, shin, foot, offset either side:
one arm splitting into two legs), the pelvis stands on them, and its base
and shoulder sink into the pedestal. A piece's thinning is measured AFTER
it is stretched onto its source (thinned against its own width, a thigh on
a Fairino link came out a fat slab). The cart's parts flatten where they
are, then slide together under the Atlas. **The unit**: a rounded-edge
torso (`TORSO_SIL`), a proud front panel, side handle slots, Ultra's
orange mark (a cup and two squares); the arm modules are FILLS ONLY — at
~10 px a module, its edges (lifted by LINE_BIAS) showed through its faces
and the arms read as a see-through lattice — black, with steel horn discs
for the joint rhythm.

**Sept 27: in act 5 the ATLAS'S OWN PIECES make the whole journey** (the
owner: the in-between was "very not detailed" — a blue slab and plain
drums). `atlasGL.render(..., vis, over)` takes a placement per piece in
flight; `carry()` in `drawHumanoidAct` lays each piece onto its source's
joint-to-joint segment, thinned to the source's width, the instant that
source stops being drawn, and slides the segment's ends and relaxes the
thinning back to the piece's own place (simOnto: smallest rotation, so no
collapse through zero). Unit → torso, each small-arm segment → its arm
piece, each Fairino link → pelvis/thigh/shin/foot. Seam into act 5: 6 px.

**Workcell → OP1 → Atlas are PART-FOR-PART MORPHS** (Sept 26; the owner:
"it's just shrinking and reappearing... It should also morph from the ultra
to the atlas"). Shared helpers before `drawUltraAct`: oriented boxes (`OB`,
`obAxis`, `obIn`, `obLerp`, `obDraw`), `simOnto` (carries a mesh link so its
joint ends land on a target segment, optionally thinned across it),
`lerpEl`, `matStep`. **Act 4:** the table is cut into six strips (no overlap
at t=0) → the cart's rails, cross members, electronics box, and the unit's
TORSO; the left post → the signal pole and lamp; the canted mounts → the
pedestal; the RIGHT POST and CROSSBAR → the FAIRINO (its seven links laid
along them, squeezed to beam thickness, unfolding into the arm); the pack
box → the packing-table top; the URs → the unit's arms (as before). Each
hands over to its real drawing where it lands; the settled state draws the
cart. **Act 5:** `atlasGL.pieces(at, k0)` reports every Atlas piece's
placement, local box and two stage points; `atlasGL.render(..., vis)` shows
only the pieces whose sources have landed. The unit's box → the torso piece's
box; each small-arm segment (a drum) → the matching upper arm / forearm /
hand (the two arms take OPPOSITE sides); the Fairino's seven links → pelvis,
thighs, shins, feet; the cart and packing table flatten onto a floor plate.
Reviewed by `glscan.mjs` (page screenshots — the Atlas is WebGL).

**THE ATLAS IS NOW THE OWNER'S OWN MODEL** (Sept 26; "scrap the previous
robot, use this instead"): a Blender scene they supplied (OBJ + MTL; 181
named parts, metres, Y up, +Z forward, arms hanging, 1.74 m). Baked by
`scripts/bake-atlas26.mjs <obj> <mtl>` into `src/robots/atlas26.bin` (1.46
MB, 587 KB gzipped; int16 positions at 0.1 mm, int8 normals, uint16 indices
per part, a JSON header with the materials; the studio backdrop dropped),
fetched lazily by `atlasGL.js`. The source OBJ/.blend stay out of the repo
(re-bake from the owner's upload). **Rigged onto the DRC skeleton**, so the
grow-in, the Fairino morph and the wave are unchanged: parts are grouped by
name into pieces (`pieceOf`: torso incl. head, pelvis, and per side upper
arm, forearm, hand, thigh, shin, foot); model → skeleton coordinates are
`(z, x, y)` about a reference point, ×1160 (puts the model pelvis at the
skeleton's 930 mm); the torso and pelvis ride the `utorso` / `pelvis`
bodies; each limb piece HANGS from the end of the piece above (so a limb
never parts) and is turned onto the skeleton's bone (scap→larm, larm→hand,
uleg→lleg, lleg→talus) with its front kept on the parent's forward
(`frame()` / rest frames); the foot takes the `foot` body's orientation at
the ankle. `drawAtlasE` uses it only once loaded (`atlasGL.ready`); until
then, and with no WebGL, the drawn fallback shows. Everything below about
the hand-built GL Atlas is history. Harness note: `taskzoom.mjs` copies only
the 2D canvas — screenshot the page to see the Atlas.

**Oct 4 (Sept 26 by the calendar).** Atlas remodelled from the owner's Fab
listing (fab.com/listings/56263696-…, the same RandomRepresent 2026 model):
only its GALLERY renders were used — three small ones of this robot (blue,
white variant, grey clay front/back; the other four are the seller's other
products). The listing's 3D previewer also loads the model's own texture
maps; those belong to the paid asset and were deliberately not used. From
the clay render: limbs are ROUNDED SLABS, not tubes (`placeSlab`: a unit
`RoundedBoxGeometry` given a basis per frame whose depth axis follows the
parent body's forward, so the flat face stays forward), shoulders are black
BLOCKS, the blue upper arm starts right under the shoulder block, the blue
thigh runs down to the knee hub.

**Oct 3.** UR → Ultra arms, reviewed frame by frame at 3x until seamless:
the tube stand-in is gone (it popped in at 0.2 and out at 0.8). Each UR link
keeps its OWN mesh and is carried by a similarity transform that sends its
two joint ends (body origins, plus a tool tip 230 mm down wrist3) onto the
matching Ultra-arm joints (a mount above the shoulder, S, S, E, Wr, two
stations down the tool axis, tcp), squeezed across its axis to 0.72 so it
lands at the servo chain's width, blended ELEMENT-WISE (lerpT
re-orthonormalises and would undo the squeeze), darkening in steps
alu → steel → iron → poly; the gripper closes and slims. Three causes of the
earlier jump, each seen: aiming at the unit's REST frame while it was still
unfolding with the Fairino (aim at `drawUltraRobot`'s return, which is now
the unit AS DRAWN, growth included); the unit still growing at the swap (its
`growOrder` span is 0.45, whole by ~0.78); fat links landing on a thin chain.
The frame now stays until the arms are leaving it (0.3–0.75). Atlas: slimmed
to the reference's build (narrower chest and waist bar, smaller shoulder
balls and hubs, thinner limbs), the hip collars moved onto the thighs (they
floated beside the body), a ribbed dark waist column. The linked 2024 and
2026 Sketchfab Atlases are both NOT downloadable (Standard licence, sold on
Fab); they were captured from the embed viewer as references only.

**Oct 2.** Atlas reworked after the owner's reference, the Sketchfab "Atlas
Boston Dynamics 2026" (RandomRepresent; NOT downloadable, viewed only —
captured spinning in its embed viewer): saturated blue #3f72b8, a CYAN ring
light, a black upper chest carrying the Hyundai and Boston Dynamics marks over
a big rounded blue lower block, a horizontal ribbed bar at the waist and one
at the pelvis with drum ends, white ribbed collars under the shoulders and at
the hips, black shoulder balls and actuators, blue upper arms, black
forearms, silver three-finger grippers, blue thigh fronts, blue donut HUBS at
knees and ankles, long flat black shin slabs, black feet on steel soles, a
mesh-grille face with a sensor slot, and a fin on top of the head. The head
lathe is turned −90° about z so its OPEN end faces forward (at +90 its closed
dome covered the face). **Ultra** reworked after Ultra's own videos
(ultra.tech HERO / ORDER PACKAGING, in the session scratch): each arm is a
chain of small square black SERVO modules with steel horns, joined by pairs
of steel brackets, with a cable along it; a shoulder yoke beam across the
torso's top; side vents. **UR → Ultra arms is a TUBE MORPH**: each UR becomes
a jointed tube along its own skeleton (mount, shoulder, elbow, wrist, tip) in
its own white, whose joints travel one by one onto the small arm's skeleton
(`smallArmFrames`: mount, S, E, Wr, tcp), thinning and darkening, and the
small arm takes over exactly there (t 0.8).

**Oct 1: detail passes, iterated by photograph.** `atlasshots.mjs` (scratch)
shoots the settled Atlas at 3x from four yaws via the dev hook `?atlasyaw=`
and montages them; three rounds against the product collage added: a
two-block chest with rounded shoulders, a proud blue front panel with seams,
blue side panels with vent slots, a back battery pack, a WIDE ribbed waist
with a belt block (narrow, it read as a spring), shoulder blocks with an
outboard drum, a head with a front lip, a sensor bar with two lenses and
recessed side vents, a "Boston Dynamics" wordmark (a CanvasTexture — its
plane faces +x from behind its normal, so the texture is mirrored back with
`repeat.x = -1`), joint drums with bevel rings and steel caps (`drumJ`), a
pelvis front plate, and LEGS modelled in their own body frames so shells can
face a direction: a blue thigh shell over the front and outside (three's
cylinder puts theta 0 on +z, which the Z-up turn sends to −y, so +x is theta
π/2), a blue calf plate behind a graphite shin, a shin guard, jointed
three-finger hands with a thumb, soles and heel rollers. **UR pair → OP1 now
TURNS** (the owner: "it should be TURNING into the arms on the ultra robot"):
each UR link travels, turns and resizes onto the matching link of the small
arm on its side (base and shoulder → the mount, upper arm → S, forearm → E,
wrist → Wr, via `smallArmFrames`), base first, and only then gives way to
the small arm's own drawing in the same place.

**Sept 30: the GL Atlas is the current PRODUCT Atlas** (the product page's
collage and warehouse render): graphite body, blue shells (chest front panel,
side panels, upper arms, thighs, head shell), graphite forearms and shins,
huge black rounded shoulder blocks, a ribbed black waist, lateral black hip,
knee and ankle drums, three-finger dark grippers, long black feet with a round
heel, and a warm-white ring light round a glossy black visor with a sensor
slot. The visor sits PROUD of the head shell's face (inside it, the lathe's
closed front hid it). **The modal's media is SHARED**: App passes the card's
picture/video rect, src and playback time (`mediaOf`); the modal lays its
content out at the FINAL size from the start (`.modal-content` sized to
`finalRect()`), measures its own `.modal-image` slot, and flies a copy
(`.modal-flyer`, still playing) from the card's slot to the modal's on open
and back on close, both originals hidden while it is in the air. Experience
rows put their video in `imageUrl` so it is that top slot. The close now
shrinks the surface straight onto the card's exact rectangle with the card
copy at its TRUE size (it used to scale the copy uniformly against a
non-uniform surface, then drop from a lifted pose), reveals the card, and
fades off it in 0.12s.

**The modal close lands without a jump**: `collapse` → `onLanding` (App
reveals the real card INSTANTLY, transition suppressed — its own un-hide
transition, a fade and grow from 95%, ran after the copy vanished and was the
jump) → `settle` fades the copy off the card.

### Oct 6: the right stage RASTERISES in WebGL (`robotGL.js`)

The owner, repeatedly: "textures still glitching on the so-arm101", "I can
see a lot of triangles". Both were the Canvas2D painter: one flat tone per
triangle, and parts ordered by face centres in depth slabs. Now, once
`robotGL.js` has loaded (lazily, as the hero leaves; three.js is already the
Atlas's chunk), the SAME frame goes to WebGL: Flourish3D still does all
geometry and projection (`cam()`), and `flush()` / `submitMesh` hand the
projected points WITH their view depth (`PZ`, parallel to `PTS`) to a
second canvas (`.f3d-gl--robots`, right after the 2D one, under the Atlas's)
drawn by an orthographic camera over the stage box. Baked meshes are lit per
pixel from their smooth normals rotated into view space (`glMesh`), in
their real material colours (`PLA_LIGHT` for white PLA on the light theme);
drawn props are unlit polygons in their Canvas2D tones; the line art is
depth-tested lines. No bands, no seals, no mesh lines, no sort. Direct
`stroke()`/`fill()` calls (the 2R pen trace) stay on the 2D canvas below.
Without WebGL (headless Firefox here) `createRobotGL` returns null and the
Canvas2D path below runs unchanged; `?nogl` forces it. Verified in
SwiftShader Chromium: every settle point and three moments of every act in
both themes, no page errors; still pages 0 mutations. Everything below
about the Canvas2D renderer describes that fallback.

**Later the same day: the GPU projects, not the CPU** (the owner chose
"three.js for all of it" over removing it). Each baked part is uploaded ONCE
as a static BufferGeometry (`geoOf` in robotGL.js, keyed by the part object,
with a pool of instances because a part can be drawn several times a frame);
a frame hands over one matrix per part — `VIEW` (cam()'s rotation and dolly
as a 3x4, y flipped up, written by `setCam`) composed with the placement —
and a PerspectiveCamera at z = PERSP with tan(fov/2) = (H/2)/(PERSP·ZOOM)
does cam()'s divide. No mesh vertex is touched in JS any more (`submitMesh`
returns before projecting). The drawn props still stream per frame, but in
view space (`glPts` / `glFaces`), not projected. Faces are FrontSide: three
flips the front face for V's negative determinant, and the props' winding
is the one the Canvas2D screen test calls front. Measured on this box with
`?perf` (dataset `ms` minus `gl`, settled, median): JS per frame 0.7-1.4 ms
→ 0.3-1.0 ms, and the ~200 KB/frame vertex re-upload is gone; the GPU side
cannot be measured here (SwiftShader). **The lighting changed, and the old
look was the bug**: the earlier ortho path flipped y on positions, which
mirrored the winding, so under DoubleSide every outward face was a "back"
face and the shader flipped its normal — the robots were lit from inside,
the dark metallic streaks on the SO-ARM. Now white PLA reads white with the
key from the upper left. Seen at every settle point and mid-act in both
themes against the previous build (geometry identical, props present).

**Oct 6, evening (the owner: gripper/cube timing off, broken UR textures,
Ultra and Atlas to look like the real ones, a PUMA first).** Each checked
against the makers' photos (ultra.tech, bostondynamics.com/products/atlas,
franka.de, generalistai.com):
- **Props were hollow ghosts in GL.** The drawn props' front winding is
  three's BACK side (identity world matrix, clockwise as seen), so FrontSide
  culled every visible face; and they were toned toward the PAGE
  (`paperTone`, line art's occluders). Now `BackSide`, and `glTone` uses the
  real material colour (MAT.poly is black: Ultra's cart/torso/arms and
  Generalist's frame/table read solid). Steel is a neutral silver in GL
  (`GL_STEEL`; its tint came out sky blue). GL lines are at 0.45.
- **UR meshes have wrongly wound patches**: robot meshes are DoubleSide,
  lit from the smooth normal unflipped (`onBeforeCompile` replaces
  `gl_FrontFacing ? 1.0 : -1.0` with 1.0).
- **Grasp timing**: a grasp/drop is two waypoints at one place differing
  only in the gripper, and the cardinal spline passed through them WITH
  velocity — the hand dipped into the cube while closing, then the cube
  snapped; a held cube went into the table before release. `splineAt` now
  takes `grip` (the gripper's joint indices per task) and gives such a
  waypoint a ZERO tangent: arrive, stop, close/open, leave.
- **Ultra**: a green stack light, Ultra's orange ring on the Fairino's elbow
  housing (`drawUltraRobot`).
- **Atlas** (`restyle` in atlasGL.js): the owner's blue model's materials
  re-assigned by part name — aluminium shells, graphite joints and chest
  panel, teal wrist rolls, a dark glass face with only the ring light (no
  eye, no screen icons).
- **The first robot is a PUMA** (`drawPuma`, `PUMA`; PUMA 560 numbers: 660
  shoulder, 432 / 433 links), drawn from the owner's Unimate PUMA 500 photo:
  pedestal column, turning trunk, broad tapered upper arm with a counterweight
  tail and a black stripe, inboard forearm, black wrist. Settled it traces
  the old figure-eight by IK (`pumaIK`). Act 1: its joints swing onto the
  SO-ARM's links while it slides/scales its shoulder onto the SO-ARM's, the
  pedestal retracts, then it shrinks into the shoulder. `?puma=yaw,k,x,y`
  reframes it. The 2R arm (`drawPlanar`) is kept for the fallback acts.
- **Privacy**: the SoleGait gallery's second item was NYU's award LETTER
  (student ID, NYU email, signature). Removed from Media/web and untracked
  from Media/projects (git-ignored, still on disk). It remains in git
  HISTORY of a public repo.

**Oct 7: Ultra, Atlas and the Generalist cell matched to photos again** (the
owner: "do iterative passes and comparisons to the real robots"). Each
shot from several angles (`rob.mjs` / `acts.mjs` in the session scratch)
against the makers' photos, both themes, every transition re-scanned:
- **Generalist** (their GTC photo): the goalpost frame is GONE. The URs come
  off a black extrusion TOWER behind the table (`TOWER_TOP`, `TOWER_W`),
  each base on a plate tilted OUTWARD (`TILT` 55° about the stage's z, `LEAN`
  −14° about x — `urMountR`, used by `leaning`), so the pair is a V reaching
  down over the top; the table stands on black legs with dark blue rails
  (`MAT.teal`); in GL the caps are a pale grey-blue (`GL_URCAP`) and the
  links aluminium (`GL_ALU`); a black CABLE loops outboard off each arm,
  drawn as a ribbon (a GL line is one pixel). The waypoints are re-solved in
  `scripts/ik-poses.mjs` (same mount; MULTI-START, wrist2 free — the default
  seed found a bad branch, and with wrist2 fixed the tool could not point
  down; now < 0.5 mm, axis 0). Each arm has its own packed pose
  (`foldedR` / `foldedL`). In the act-4 morph the tower becomes the signal
  pole, the plates and wedges the pedestal, the legs and rails the cart's
  base frame (stagger capped at nine).
- **Ultra** (ultra.tech's front photo): `RB.ul.yaw` 62 → 90 so the torso and
  its orange mark FACE the viewer with the Fairino behind, and the rest pose
  holds the unit chest-high with the Fairino's base below it
  ([0.3, −1.7, 1.7, 0, 1.57, 0]). The packing table's legs are black. Dev
  hooks: `?ulyaw=<deg>`, `?ulq=j1_j2_j3_j4_j5_j6`.
- **Atlas** (`RULES` in atlasGL.js): the illustration's drawers, shields,
  chevrons and icons are hidden; what is left is a silver shell with a dark
  chest panel (`Torso_DrawerRecess`), as photographed; silver waist drum and
  pelvis, graphite shoulder pods, elbows, forearms, knees and shins, silver
  upper arms and thighs, teal wrist bands, a silver helmet round the ring
  light, and the head 0.84x (`HEAD_K`, scaled about the bottom of its shell).
Measured: Firefox scroll p50/p90 17.1, 0 mutations on still pages.

**Oct 7, later: the Ultra unit rebuilt from Ultra's front and side photos**
(the owner: "the ultra robot still doesn't look right"). Mismatch → fix:
the torso was a tall box under a yoke beam → a T: a 180-wide case under a
300-wide SHOULDER COWL with chamfered lower corners (`COWL_*`, module
scope; `U_*` mirror `UNIT`); the arms hung 170 mm out, beside the case →
240 (`UNIT.SY`), off actuators bridging from the cowl's ends; the arms were
ladders of tiny servos with steel dots, elbow UP → modules + black links,
ELBOW DOWN (upper arm hanging, forearm reaching forward, gripper pointing
forward-down, as photographed; the IK clamp is now elbow ∈ [-2.6, 0]); the
gripper was a T with specks of orange → a wide body across the wrist with
steel rails, fingers at its ends sliding along y, big orange tips; the
logo was a cup with two squares → a cup holding a ball on a step; the ZED
sat on a square stick → a round column + bracket; the unit was a toy on the
FR20 (Ultra uses a much smaller Fairino) → drawn at `UNIT.S` 1.4x the
Fairino's scale (in `unitFrame`; everything in the unit frame — props,
IK — is unaffected); the cart was a rectangle → an H on casters with the
feet running forward, a base plate, an open rack with the pedestal column
inside, the e-stop on the left foot's rear, a red cable coil (`CART_BOXES`:
ONE list that drawCart, the act-4 pairs and the act-5 flattening all use);
the elbow's orange ring stuck out past its housing → on the face (r 80);
plus the white braided cable from the unit down the Fairino. The waypoints
were re-solved (`scripts/ik-poses.mjs` prints a clearance check: lowest
point 20 mm above the table, arms ≥ 270 mm apart, every target < 1 mm).

**Oct 7, the left film (the owner).** (1) It is no longer dimmed on
Experience and Research, and the badges' page-coloured halos
(`.mlan::before`) are gone: "the animation on the left seems dim". The
badges now sit over the film. (2) Things APPEAR by Manim's drawing
animations, not by scaling in: `DrawBorderThenFill` (die, view cameras,
splats, encoder; give it an explicit `stroke_color`, or the outline comes out
Manim's default blue), `Create` (wall copies, layers, the demo frame) and
`Uncreate` (the mosaic, the splats leaving). Text still FADES in (`show`).
(3) The VLA's four bars read as nothing ("horizontal bars with dots going
down"): each layer is now the same 16 token slots (12 patches, 4 words) the
tokens feed into, with arrows in and out; a training step lights the layers
copper top to bottom (forward pass) and the arrow into the action chunk, then
outlines them in ink bottom to top (backprop), named beside the caption
(`layers`, `pass_state`). (4) The arm has a turntable, actuator housings with
hubs and index marks, module seams, a cable along the upper arm and a wrist
camera, element for element in both looks.

**Oct 8 (the owner).** (1) The OP1's item and box clipped ("the box and the
cube are slightly clipping through each other"): the item waited ON the
right flap, which folded up through it; the drop point put the item 4 mm
into the right wall; and lowered into the box, the gripper (rolled inward
~0.5 rad, so its outer finger dips ~35 mm) went 6 mm into the wall. Now the
item waits on the table beyond the flap's swing (`ITEM` in
`ik-poses.mjs`; the table is 740 long, `OPB.TL`), the arm lets go with every
part above the rim and the item FALLS to the floor (`unitTaskState`), and
it is drawn square to the box (`unitRot(TU.m)`), not the stage.
`ik-poses.mjs` prints an `op box check` — gripper and held item into a
wall, gripper inside the resting item — that must read 0 / 0 / 0. (2) The
hero chips are LABELS, not buttons ("don't need to be clickable just make
them bigger so the liquid glass effect is more pronounced"): 1rem, 15px 30px
padding, 51px tall; the tilt and sheen stay. (3) The portrait is 20% bigger
(`--photo` 180-269px) inside a GLASS BUBBLE (`.hero-bubble`): GlassSurface
as a 14-19px ring (borderWidth 0.3, blur 18, distortion −100 — at −130 with
a narrow edge band the waves tore into dashes), a gradient rim and a glint
on top; no outer shadow and no filter or blend mode on it (the chips'
backdrop-root lesson). In FIREFOX the hero's GlassSurface layers are not
drawn at all (`@supports (-moz-appearance: none)`, end of App.css): its
frosted fallback on the bigger chips plus the bubble took the hero scroll
to p90 34 ms (the wave canvas was not the cost — hidden, nothing changed;
any translucent fill in their place cost too), and Firefox gets no
refraction anyway. Rim and glint remain; Safari keeps the frosted fallback.
(4) The waves: `A_BOTTOM` 0.1 → 0.5 and
`STROKE_BOTTOM` 0.6 → 0.9 ("don't have the sine wave rows fade so much going
down"), two rows above row 0 that run behind the floating navbar so it has
waves to bend, four below that run the field off the hero's bottom
(`ROW_FIRST` / `ROW_LAST`, same spacing and twist). Hero still one screen at
the five sizes, chips on one row. (5) The left film on the Resume page,
checked for sense: the arrow out of the VLA left the network's left end and
pointed past the chunk's frame (it runs down the middle now, "VLA policy"
moved left of it); the instruction read "pick red cube place" (now "put red
cube on mark"); and backprop now starts with an ink arrow UP from the
chunk-vs-demo frame, then climbs the layers.

**Oct 8, phones** (the owner: "in mobile, make the animations smaller, and
make sure the relevant stuff fits on each page. Also, the socials links
should be at the top at all times"). One block at the end of App.css
(`PHONES, Oct 8`), ≤768px: the band is `min(19vh, 40vw, 160px)`; the
profiles sit in the header bar beside the burger; every `.page` (and the
hero) is exactly `100svh`, its content between `--head-h` (62px) and
`--dock-room` (the band, or 24px collapsed), and the grids share out that
height with `minmax(0, 1fr)` rows so it holds on any phone: Experience /
Research cards are the clip beside the role with a 3-line summary (no tags);
Major Projects a 2x2 of covers + titles; Additional Projects a 3x4 of tiles;
Resume the two documents, the transcripts, the viewer filling what is left,
the actions and the skills on one swipeable row (the aside is `display:
contents` and its children placed on the layout's grid); Get In Touch the
about card as a row. Descriptions and tags are in the modals. The down
buttons are hidden on phones. A `max-height: 600px` block covers the 568px
iPhone SE. Checked on six phones (320x568 to 430x740, 412x839) by measuring
every element of every page against the header and the band — no overlap,
no sideways scroll — and 0 mutations on still pages. **Phones snap now**:
the pages fit, so `scrollSnap.js`'s FIT test passes there; it waits while a
finger is down (`touching`), so it never pulls a page the reader is holding.
Measuring gotchas: wait ~1.5s after scrolling (the cards' entrance slides
them up and reads as overflow), scroll with `scroll-behavior: auto`, and
skip what is inside a scrolling frame (`.resume-pages`, `.skill-chips`).

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

### The motor's one frame

It is the old sequence's LAST frame, so the fit measured for it still holds:
camera yaw 16°, pitch 14°, dolly 30; module scale `MOTOR_K_MAX`; the axis at
`MOTOR_TILT` (~69° on screen — the parts have diameter as well as length, and
the diagonal of a 340x660 box is 63°, not the 41° it once was); the shaft
rotated where the old run left it (`SPIN`). Change any of those and re-run the
ink bounding-box measurement (see Verifying).

- Anything that indexes a part must index it BY ID (`STATOR_I`, `partA[id]`).
- **The copper must project past the core.** The bars sit at r=46 inside a
  closed stator and are invisible from the side; the END TURNS bulge to r=64
  past the r=62 core, and that is what carries the colour. At r=50 they were
  hidden by the core's own surface.
- **The propeller's pitch falls from root to tip** (34° → 12°), or the blade
  reads as a flat paddle rather than a screw.
- A wound stator is copper IN THE SLOTS with end turns; a coil around the
  shaft axis is a solenoid.

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
- **One meaning per colour**: gold is the sine field and nothing on the
  finished motor; copper is the winding and nothing else.
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
frame. The progress bar, the header shadow, the wave field and the motor go through it.
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

**The one deliberate exception** is what runs while the page is SETTLED on a
section (the fan, the shutter, the arm, the sensor readout) — see "Settling on
a page". It is canvas painting only, so the mutation check above still reads 0.

## Pages: one screen each

From Experience down, every section is a `.page` — at least the viewport tall,
content centred under the fixed header — in the owner's order: **Experience
(Roboflow, Starship) · Research (NYU, UCSC) · Major Projects · Additional
Projects · Skills & Resume · Get In Touch.** The nav has one link per page in
that order ("More" is Additional Projects). Only the hero comes before them.
**Get In Touch carries the about card** (portrait, name, the bio behind a
click) beside the invitation and the links; it used to be its own section
right under the hero. **Skills & Resume is one page** (`Skills.jsx` +
`DocStrip.jsx`): the eight skill groups four across, and under them the
resume, extended CV and two transcripts as a row of 48px compact tiles
(`.doc-tile--compact`, a compound selector because `.doc-tile`'s 180x180
comes later in the file and won on order). The resume was a page of its own
— four tiles on an otherwise empty screen — until the owner merged the two;
`Resume.jsx` and `.docs-grid` are history. Anything that lists the pages
(`ACTS` in `waveField.js`, `IDS` in `scrollSnap.js`, `LINKS` in `Header.jsx`,
the `PageNext` targets) changed with it; the last act now ends at the top of
Skills & Resume.

**Every page but the last ends in a down button** (`PageNext`) to the next
one. It is a link, so it works from the keyboard and without JavaScript, and
html's `scroll-behavior` does the smooth scroll (instant under reduced motion).
It does NOT bob like the hero's cue: six never-ending loops is exactly the
failure mode "keeping a still page still" is about. It sits in the page's
bottom padding (56px), absolutely positioned, so it never moves the content.

**Each page's content is sized to fit one screen**, and that is checked by
measurement, not by eye: every page's `offsetHeight` equals the viewport at
1440x900, 1536x864, 1920x1080, 1280x800 and (within 2px) 1366x768. What it
took, in case something is added and a page grows past the screen:

- **The title's line-height.** `.section-title` inherited the body's 1.7 —
  ~25px of air above every page. `.page .section-title` sets 1.15.
- **Major projects are SIDEWAYS rows, the picture zig-zagging** — left on the
  first, right on the second (`:nth-child(even)` swaps the grid columns) —
  with the row height taken from the screen (`--mp-h`: what is left under the
  title and the playback toggle, in four) and the picture 2.3:1 at that
  height (16:10 until the owner asked for the video bigger and the text
  smaller; the row cannot grow without breaking the fit, so the picture grew
  sideways and the text column, padding and type came down). The owner's words were "picture on the left and text on the right,
  then the next one should be picture on the left and text on the right";
  read as alternating, and flagged. **The card has a MIN-height, not a
  height**: at a fixed height the vertically centred text overflowed both
  ends and the card clipped 3-13px of the tag row at 1440x900 and 1280x800.
  The picture is taken out of the row-height sum (absolutely positioned in its
  own grid cell); both grid lines are always stated, because for an absolute
  grid child an unstated end line means the container's far edge —
  `grid-column: 1` spread the picture under the text on every odd card.
  Skills four across, additional projects
  five to a row (the last row centred), with covers at a fixed aspect ratio;
  small
  cards carry title, status and two tags on one line faded at the edge — the
  description is in the modal. A second line of chips was enough to push the
  grid past the screen.
- **Experience cards are teasers** (see `experienceData`), with the card
  height taken from the viewport (`--exp-row-h`), not the content. **With a
  video beside the text** (`.exp-card--media`: a grid, the video in a
  `clamp(240px, 44%, 440px)` column as a 16:9 frame centred in the card's
  height — the owner asked for it "more horizontal"; it was a tall strip
  filling the height — absolutely positioned inside its cell so it never
  adds to the row height) the text column is a third narrower,
  and the Research page ran 92px past one screen at 1440x900 from wrapping
  alone — so beside a video the type comes down a step, the organisation
  and degree keep to ONE line (the location is dropped from the card; it is
  in the modal), and the tag row holds three (`SHOWN_TAGS_MEDIA`). On a
  phone the video goes above the text at 16:9, and the tags wrap again (the
  card's height is free there). **A no-wrap line ellipsises only if every
  box above it may shrink**: the head's text cell needed `min-width: 0` and
  the phone's `.exp-head` track `minmax(0, 1fr)`, or the degree line's full
  width became the grid's minimum and the WHOLE phone layout grew to 408px
  in a 390px viewport — found because the phone harness's tap on the dock's
  tab was intercepted by a card that had slid under it.
- **A short-screen block** (`max-height: 840px`) drops to one highlight per
  experience card, shortens the covers and hides the skill icons, and a
  mid-height block (`max-height: 880px`, for 1536x864) tightens the experience
  cards and small covers a little. **Both come after the base rules in
  `App.css` on purpose**: they override rules of equal specificity, and placed
  above them the short block silently lost — the covers never shrank.
- **The down button's room was paid for** by trimming the page's top padding
  to the header's own 80px. Adding it cost research and additional projects
  ~25px at 1536x864 before that.

Tablets in landscape (1024x768, 1100x820) still run a page or two 20-80px
over and scroll within it; 769-991px the pages stack naturally (PHONES, ≤768px, are one screen per page since Oct 8 — see "Oct 8, phones") and the
lanyards are not loaded. **On phones the nav is a MENU behind a hamburger
button** (`.nav-burger` in `Header.jsx`, ≤768px): a panel that drops from
the header with the seven links stacked and the theme toggle last; it
closes on a link, on Escape, on a tap outside the header, and when the
viewport grows past the breakpoint. It used to swipe sideways, masked at the
right edge, which reached everything but told no one it was there. The
`scrollLeft` effect that kept the active link in view is still there and a
no-op in the column (nothing overflows).

## Settling on a page, and what runs while it is settled

**Stop with a section half in frame and, after 0.7s of stillness, the page
eases until it fills the screen** (`src/scrollSnap.js`); a section ALREADY in
frame counts as settled 120ms after the scroll stops, so the robots start
working the moment the reader arrives. It was two seconds for both, which
the owner found "taking too long". Every page is one screen
tall, so a settled page shows exactly one — and that is also where the art is
at a keypoint: `S_MORPH` ends at exactly 1.0 hero heights, the top of
Experience, so the waves finish becoming the camera and the motor at the
moment the page comes to rest there; act two finishes at the top of Research.

It must never fight the reader, so it does nothing at all when:

- a modal has locked the page (`body.style.overflow`), a badge is being
  dragged (`body.style.cursor`), or a text field or iframe has focus. A
  blocked attempt RETRIES in 600ms rather than giving up: closing a modal
  fires no scroll event, and without that the page would sit misaligned until
  the reader scrolled again (seen in test).
- the nearest section does not FIT the screen (`FIT` 1.05) — on a phone, or a
  short laptop in landscape, pulling someone to a section top would skip what
  they are reading. In practice this turns snapping off below 992px.
- the pull would be more than `MAX_PULL` (0.55) of a screen: they are
  mid-section on purpose, not near a boundary.
- the reader asked for reduced motion — then nothing moves on its own, and
  the beats below do not run either.

**What runs while settled** (`onSettle` → the idle loop in `Flourish3D.jsx`):
the motor **spins its fan** (and the rest of the shaft line), the camera
**takes a picture** (the iris shuts and the rim flashes, every 2.6s), and
from Research down the robots **work** — a pick-and-place cycle in joint
space per machine (`RB.*.cycle`, see "The acts"), the UR pair out of phase —
and the sensor **reads out** (a band sweeps the grid and each sweep leaves a
slightly different picture). This is the one thing on the page that animates without
the scroll driving it, so it is fenced: settled only, held states only
(`held()`), 20fps desktop / 10fps phone, rAF stops it when the tab is hidden,
never under reduced motion, and the piece is redrawn at its resting frame the
moment the page moves — a shutter frozen half-shut looks broken. **It runs at
frame rate, backing off in proportion to what a draw costs on THAT machine**
(rAF; one frame skipped for every 6ms of the draw's running cost, up to
three — 60 → 30 → 20 → 15fps; every other frame on a phone on top; `idleCost`
is fast-down/slow-up so the first draw after a mesh arrives does not set the
rate for seconds): the 20fps it first ran at read as lag once the robots
were doing real work, and a fixed "skip one over 6ms" left a 20ms draw on a
30fps schedule, two thirds of every frame. Nothing here can measure the
owner's machine — "there's still quite a bit of lag" arrived with this box
at p50 17.0 — so the levers are the ones that scale: ZOOM 0.85 (28% fewer
pixels), a quarter off the mesh budgets, two thirds off the lines, and this. The scroll-driven redraw keeps its every-other-frame floor (32ms)
but the cost multiplier is 2x instead of 8x — the acts were at 12-25fps.
Drawing every frame was tried and measured: a 6ms draw on top of Firefox's
own scroll work overran the budget and p90 went from 17 to 33ms.

Two details worth keeping:

- The iris STARTS at the lens rim at zero alpha and closes to a point. Drawn
  at its mid-size it pops on as a dark disc over the glass.
- `canvas.dataset.segs` is NOT written while the loop runs. It is a debug
  read-out, and it is a DOM write: leaving it in made "hold still and count
  mutations" measure this attribute instead of the page. With it skipped, a
  settled page still measures 0 mutations in 3s.

Measured: settled on Experience, p50 16.5ms / p90 17.2 in Firefox.

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

**The scroll cost of this page was a CSS backdrop filter, not a library.**
Asked whether fewer frameworks would raise the frame rate, measured over a
scripted pass down the whole page in Firefox (249 frames, 1440x900):

| what is switched off | p50 | p90 | frames > 20ms |
|---|---|---|---|
| nothing | 17.1 | 33.5 | 54 |
| the lanyards (WebGL + rapier) | 17.1 | 33.3 | 55 |
| both canvas pieces | 16.7 | 33.2 | 43 |
| **the cards' `backdrop-filter`** | **16.6** | **17.2** | **1** |

`blur(4px)` on `.lift-card` and `.doc-tile` (16px on hover) has to read back
and blur everything behind twenty-odd elements on every frame they move. It is
gone; the fill went from 70% to 86% of the surface colour to compensate, and
the page now measures p50 16.7 / p90 17.2 with everything on, 6 frames over
20ms. The hero chips keep their glass — there are five of them, on one screen.

**Acts 3 and 4 run at p90 33ms in headless Firefox, and the cause is the
cards' `box-shadow`, not the art.** Measured per act (`ffacts2.mjs`-style:
frame intervals while scrolling each act at 12px a frame, 1440x900): the
art alone (page content `visibility: hidden`) fits, p90 17; the content
alone (the pieces not mounted) fits, p90 17; both together overrun to 33 in
the two acts whose pages carry a screen of shadowed cards — Major Projects
and, since the merge, Skills & Resume. With `box-shadow: none` on the cards
both acts drop to p90 17.1; a 4px shadow, or the same 15px shadow in a
literal rgba instead of the `color-mix()` token, changes nothing — it is the
presence of a blurred shadow being repainted under a scroll on a software
rasteriser (this Firefox has no GPU). The videos are not it (hidden, no
change), nor are the masked icons or layer promotion. **So the cards have no
resting shadow** — the owner: "remove the shadows if it's going to improve
performance" — on `.major-project-card`, `.small-project-card`,
`.skill-group-card`, `.doc-tile` and `.exp-card`; the 1px border carries the
edge, and the HOVER shadow stays because it is one element at a time. Acts
3 and 4 measure p90 17 with it.

So: **the libraries are a DOWNLOAD cost, not a frame cost.** `index-*.js` is
~400KB and the lazy `Lanyard-*.js` ~3MB (three + rapier + drei + meshline),
fetched only when the Experience page comes near. anime.js and motion do
nothing at all on a still page — the idle check is 0 mutations. If the weight
ever has to come down, the target is that 3MB chunk (the badges), not
anime.js or motion.

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

**The tags are flat, not gold.** `.project-tag` — on every card, the
skills, the experience cards and the modal — used to be the metallic gold
gradient with an inset highlight and a text shadow; the owner found it "such a
shiny gold", and beside it the status chips were neon (`#7CFC00`, `#FFA500`).
It is now a 16% wash of the accent with a dark ink of it, and the statuses a
muted green and amber. Text on pill, measured: tag 8.2:1 light / 8.1:1 dark,
completed 5.6 / 8.3, in progress 5.3 / 7.7. At 11px a tag is normal text under
WCAG regardless of its 600 weight, so the floor is 4.5:1, not 3:1 — re-measure
if the colours move.

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

**That last sentence was false until 2026-09-10, and the way it was false is
worth knowing.** The old portfolio hard-coded absolute
`https://aadhavsivakumar.github.io/Media/...` URLs and shipped no media of its
own, so it was being served its images out of THIS repo's Pages deployment.
When the deploy here was narrowed from `cp -r Media dist/` to just `Media/web`
+ `Media/skills` (commit `52d7aa1`, the asset-repair pass — the change that
took the root from ~414MB to ~44MB), 53 of the old site's images and videos
404'd and nobody noticed for a month. The tell was that `Media/skills/*` still
worked, because that is one of the two directories that survived the trim.

It is fixed in the other repo, not here: that site now hosts its own media
under `public/` and builds every URL from `import.meta.env.BASE_URL`, so the
two are genuinely decoupled and the sentence above is true now. **Do not
"restore" anything to the root deploy on its behalf**, and if you ever add a
root-level asset directory, remember the root domain is a shared namespace
between these two sites.

What reaches the site root: everything Vite emits into `dist/`, plus the four
directories `scripts/copy-static.mjs` copies (`Media/web`, `Media/skills`,
`projectpdf`, `Resume`). `Media/projects`, `misc/` and `legacy/` are **not**
deployed — an earlier workflow copied them and uploaded ~414 MB per push, ~390 MB
of it unreferenced. Deployed size is now ~44 MB.

## Current progress (as of 2026-09-15)

Working tree is clean and everything is committed and live (last: `19b7ece`,
verified against production — every page one 900px screen, six down buttons,
the about card in Get In Touch, four 250x600 badge canvases, no page errors or
failed requests). The owner has been directing the design iteratively and
**expects further improvements**, so treat it as in-flight rather than final.
Every animation and layout decision of the September rounds is written up in
its own section above: the hero and the waves, the pieces and act two, Pages,
and the lanyard.

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
- Positioned for robotics / ML / CV roles: Roboflow role, public-safe
  experience entries, the four major projects the owner chose, claim-backed
  skills (see "The site is positioned…").
- September redesign: the /portfolio-style hero; the sine field flying
  straight into a camera (left) and a motor (right); act two between
  Experience and Research (camera to sensor pixels, motor to 2R arm); every
  section one screen with a down button; zig-zag lanyard badges, bigger, on
  smaller pegboards; sideways zig-zag major projects; the about card moved to
  Get In Touch.

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
