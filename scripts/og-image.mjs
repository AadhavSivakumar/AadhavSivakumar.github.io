#!/usr/bin/env node
// The link preview (Media/web/og.jpg, 1200x630) is the site's OWN hero,
// photographed: the gold sine field, the portrait in its glass bubble, the
// eyebrow, the name in Zodiak and the glass chips, exactly as the page draws
// them, with the navbar and the scroll cue hidden. It used to be a separate
// card drawn in an HTML page of its own (a big AS mark, the old fonts, the
// employer named); the owner asked for one that looks like the site.
//
//   npm run build && npx serve -s dist -l 4900 &
//   node scripts/og-image.mjs http://127.0.0.1:4900/ Media/web/og.jpg [light|dark]
//
// Chromium (SwiftShader here) because only it draws the glass refraction.
// Rendered at 2x and saved at 1x (`scale: 'css'`), so the waves come out
// antialiased. A JPG, not a WebP: WebP previews do not unfurl on LinkedIn or
// Slack. When the image changes, bump the `?v=` on og:image / twitter:image in
// index.html, or the platforms keep showing the copy they cached.
import { chromium } from 'playwright';

const [url = 'http://127.0.0.1:4900/', out = 'Media/web/og.jpg', theme = 'light'] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
]});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(t => { try { localStorage.setItem('theme', t); } catch { /* no storage */ } }, theme);
await page.goto(`${url}${url.includes('?') ? '&' : '?'}nosnap`, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: `
  html { scrollbar-gutter: auto !important; overflow: hidden !important; }
  header, .hero-scroll-cue, .skip-link { display: none !important; }
  #hero { padding: 0 16px !important; }
` });
await page.evaluate(() => document.fonts.ready);
// the waves' drop-in and the name's blur-in are over by ~3.2 s
await page.waitForTimeout(5000);
await page.screenshot({ path: out, type: 'jpeg', quality: 88, scale: 'css' });
await browser.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
console.log(`${out} (${theme})`);
