// Runs after `vite build` (see package.json). Two jobs:
//
//   1. Copy the static directories the app links to at runtime into dist/.
//      Vite only bundles assets that are *imported*; everything referenced by
//      a root-relative URL string in src/data/siteData.js has to be placed by
//      hand. This used to live in .github/workflows/deploy.yml, which meant
//      `npm run preview` served a site missing every image.
//
//   2. Verify that every root-relative URL the site references actually exists
//      in dist/, and fail the build if one does not. In Dec 2025 Images/ was
//      renamed to Media/ without updating siteData.js; 50 covers and icons
//      404'd in production for eight months because nothing checked.
//
// Deliberately NOT copied: Media/projects (the multi-hundred-MB originals the
// derivatives in Media/web are made from), Media/lanyardimgs (imported, so
// Vite bundles it), misc/ and legacy/ (referenced by nothing).

import { cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

if (!existsSync(dist)) {
  console.error('copy-static: dist/ does not exist — run `vite build` first.');
  process.exit(1);
}

const DIRS = ['Media/web', 'Media/skills', 'projectpdf', 'Resume'];

for (const dir of DIRS) {
  const from = path.join(root, dir);
  if (!existsSync(from)) {
    console.error(`copy-static: missing source directory ${dir}`);
    process.exit(1);
  }
  await cp(from, path.join(dist, dir), { recursive: true });
  console.log(`copy-static: ${dir} -> dist/${dir}`);
}

// --- verification -----------------------------------------------------------

const data = await import(pathToFileURL(path.join(root, 'src/data/siteData.js')).href);

const urls = new Set();
const walk = (node) => {
  if (typeof node === 'string') {
    if (node.startsWith('/')) {
      urls.add(node);
      // Every video cover is expected to ship a poster alongside it.
      if (/\.(mp4|webm)$/i.test(node)) urls.add(node.replace(/\.(mp4|webm)$/i, '-poster.webp'));
    }
  } else if (Array.isArray(node)) {
    node.forEach(walk);
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach(walk);
  }
};
walk(data);

const missing = [...urls].filter((u) => !existsSync(path.join(dist, decodeURIComponent(u))));

if (missing.length) {
  console.error(`\ncopy-static: ${missing.length} referenced asset(s) are not in dist/:`);
  for (const m of missing) console.error(`  ${m}`);
  console.error('\nEither commit the file or update src/data/siteData.js.');
  process.exit(1);
}

console.log(`copy-static: verified ${urls.size} referenced assets exist in dist/`);
