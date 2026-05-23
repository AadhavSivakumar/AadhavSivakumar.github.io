# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This is Aadhav Sivakumar's personal portfolio site, served via GitHub Pages from `https://aadhavsivakumar.github.io/`. It is a static site with no build system, no package manager, and no test suite. Edits to HTML/CSS/JS files take effect on push to `master`.

To preview locally, open `index.html` directly in a browser or serve the repo root with any static server (e.g. `python -m http.server`).

## Top-level layout

- `index.html` — the active portfolio. It both contains the full single-page portfolio markup/CSS/JS *and* opens with `<meta http-equiv="refresh" content="0; URL=https://aadhavsivakumar.github.io/portfolio" />`. The redirect is what the root URL actually does in production; the inline content below it is the source of truth for the portfolio that lives at the `/portfolio` path. When editing the portfolio, edit this file.
- `legacy/` — older versions of the portfolio (`legacyindex.html`, `legacyindex20250725.html`, `old_index.html`) plus per-project legacy pages under `legacy/Projects/` and `legacy/Home/`. Don't edit these to make changes to the current site — they are kept for archive only.
- `Media/` — local image/video assets (`Media/projects/`, `Media/skills/`, profile photos).
- `projectpdf/` — PDF reports linked from project modals.
- `Resume/` — dated resume PDFs.
- `misc/` — unrelated data files (e.g. `Gmatquantquestions.json`, `highqworldmap.json`).

## Architecture of `index.html`

The site is a single self-contained HTML file (~1500 lines) split into three regions:

1. **`<style>` block** — all CSS, including CSS variables under `:root` and `html[data-theme="dark"]` that drive light/dark theming. Theme tokens: `--primary-color`, `--accent-color` (`#C5A35C` / `#D4B47C`), `--background-color`, `--surface-color`. Tailwind is included via CDN but most styling is hand-written CSS.
2. **`<main>` markup** — `hero`, `about`, `projects`, `additional-projects`, `skills`, `resume`, `contact` sections. The about card, project grids, skill grids, and resume card are empty containers populated by JS on load.
3. **`<script>` block (after `</main>`)** — all data and logic. The pattern is data-driven: arrays of plain JS objects feed render functions that build DOM nodes and attach modal handlers.

### Where to edit content (not markup)

Project, skill, about, and resume content all live as JS object arrays near the top of the `<script>` block — search by variable name:

- `aboutMeData` — about-me modal content.
- `majorProjectsData` — large project cards (`#projects` section). Each entry: `{ id, title, cardDescription, imageUrl, tags, status, modalContent }`. `modalContent` is an array of `{ type: 'text' | 'button' | 'embed', ... }` blocks.
- `smallProjectsData` — additional project cards (`#additional-projects` section), same shape but `id` is a letter.
- `resumeData` — the resume card and its modal.
- `skillGroupsData` — skill category cards on `#skills`; each group has `items` with `{ name, imageUrl, description }`.

To add a project: append an object to the appropriate array. The render functions (`populateProjects`, etc.) pick it up on next load — no other wiring needed.

### Asset URL conventions (important gotcha)

`majorProjectsData`/`smallProjectsData`/`skillGroupsData` reference images via these base paths:

- `baseProjectImagePath = 'https://aadhavsivakumar.github.io/Images/projectcovers/'`
- `baseProjectPdfPath  = 'https://aadhavsivakumar.github.io/projectpdf/'`
- `baseSkillImagePath  = 'https://aadhavsivakumar.github.io/Images/skills/'`

Note that the live site reads project/skill images from `/Images/projectcovers/` and `/Images/skills/`, but the repo stores them under `Media/projects/` and `Media/skills/`. There is no `Images/` directory in this repo — those URLs resolve against assets hosted in a different location/branch of GitHub Pages. When adding a new project image, you must place the file where the `Images/...` URL actually resolves (not just under `Media/`), or the card will 404. Confirm with the user where new assets need to live before assuming `Media/` is sufficient.

PDFs under `projectpdf/` *are* served from this repo, so those URLs match the local directory.

### Modal, theme, and scroll behavior

- A single modal (`.modal-backdrop` → `.modal-animator` → `.modal-content`) is reused for all cards. Clicking a card calls into the modal logic at the bottom of the script; the renderer reads `modalContent` blocks and injects text/buttons/embeds into `#modal-dynamic-content-area`.
- Theme toggle (`#theme-toggle`) flips `data-theme` on `<html>` and is the only mechanism for dark mode — CSS variables do the rest.
- Two floating "animated objects" (`#scroll-down-btn`, `#scroll-up-btn`) provide section-to-section scrolling. The next-section logic explicitly skips `#about` when scrolling down from hero (see the `if (nextSection.id === 'about') ...` branch ~line 1427) — preserve this if you reorder sections.

## Editing guidance

- Keep all changes in `index.html` unless you are explicitly working on a legacy page. Do not duplicate the portfolio into new top-level HTML files.
- When changing data arrays, preserve the existing `id` values — they are used by the modal lookup logic (`majorProjectsData.find(p => p.id.toString() === itemId)`).
- The site has no linter, formatter, or tests. Validate changes by opening `index.html` in a browser and exercising the affected card/modal/theme/scroll path.
