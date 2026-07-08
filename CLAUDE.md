# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This is Aadhav Sivakumar's personal portfolio — a React 18 + Vite single-page app. It is a modernized, animation-heavy rebuild of the older static portfolio that still lives at `https://aadhavsivakumar.github.io/portfolio` (that path serves a separately built bundle; this repo is the successor).

There is no test suite or linter. Validate changes by running the app and exercising the affected section.

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

## Current progress (as of 2026-07-03)

**Done and committed locally** (commits `lanyard update 1`, `lanyard 3d change 2`):

- Full rebuild of the site as a modern, animated version of the live `/portfolio`: motion + anime.js installed and wired throughout.
- 3D lanyard About section: six physics badges (education left / work right, content matching the live site's badges) around the about card; drag, click-to-flip, cursor sway, and hover tilt interactions; resize-safe layout; low-fps strap fix; vertical-equilibrium spawn.
- Content parity with live `/portfolio`: about card + modal bio, Resume/CV/Transcript Drive documents, contact text.
- Hero (anime.js letter cascade, aurora, keyword chips, scroll cue), scroll-spy nav with metallic pill, LiftCard/Reveal card entrances, SectionTitle letter cascades, scroll-scrubbed progress bar.
- Phased modal: lift → expand → content stagger, reversed on close.
- Teardown: AnimatedObjects (hexagons), SineWave, useInView hook, old class-based reveal CSS, old resume card.
- Mobile stays light: 3D stack only loads ≥992px via lazy chunk; production build verified clean (no console errors).

**Open items:**

- `git push` to origin/master blocked by stale GitHub auth (VS Code askpass served an expired token). Fix in flight: `env -u GIT_ASKPASS git push origin master` + browser sign-in as AadhavSivakumar, or restart VS Code after re-auth and use Sync. Local is 2 commits ahead.
- Visual QA pass pending — the Chrome window was hidden during automated checks, which suspends all animation. Eyeball: modal open/close feel, lanyard hover-tilt direction (sign flip in `Lanyard.jsx` `pitchErr`/`tilt.nx` if it leans the wrong way), section-title cascades, both themes, mobile layout.
- Spline not integrated (user's requested stack item) — needs a scene designed at spline.design first; wire via `@splinetool/react-spline`, lazy-loaded like the Lanyard.
- Deployment flow for the built `dist/` is undecided (see Deployment above).
