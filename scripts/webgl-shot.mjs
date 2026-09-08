#!/usr/bin/env node
// Screenshot the site WITH WebGL, on a machine that has no GPU.
//
// Headless Firefox on this box cannot create a WebGL context at all, even with
// every software-rendering pref forced, so for a long time nothing that needed
// WebGL (the lanyard badges) could be looked at here — it was verified by
// simulating the maths. Chromium ships SwiftShader, a CPU rasteriser that gives
// a real WebGL 2.0 context, and Playwright downloads a Chromium into
// ~/.cache/ms-playwright without root. So:
//
//   npx playwright install chromium        (once, ~150MB, no sudo)
//   npm run build && npx serve -s dist -l 4900 &
//   node scripts/webgl-shot.mjs http://127.0.0.1:4900/ '#experience' out.png
//
// Args: url, a selector to scroll to (optional), output path (optional).
// Prints the WebGL renderer string so it is obvious when it silently fell back.
import { chromium } from 'playwright';

const [url = 'http://127.0.0.1:4900/', target = null, out = 'webgl-shot.png'] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox',
]});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'networkidle' });
console.log('WebGL:', await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return gl ? gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'UNAVAILABLE';
}));
await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
if (target) {
  await page.evaluate(sel => { document.querySelector(sel)?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); }, target);
  await page.waitForSelector('canvas', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(6000);       // lazy chunk, then the physics settle
}
await page.screenshot({ path: out, fullPage: false });
console.log('saved', out, errors.length ? `| page errors: ${errors.join(' | ')}` : '| no page errors');
await browser.close();
