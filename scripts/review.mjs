#!/usr/bin/env node
// Visual and behavioural review in real browsers (Playwright).
//
//   npm run build && npm run preview          (in one terminal)
//   node scripts/review.mjs                   (Chromium, all pages, all widths)
//   node scripts/review.mjs --browser webkit --pages /,/writing/
//   node scripts/review.mjs --reduced-motion
//   node scripts/review.mjs --gpu             (Chromium with the real GPU, so the WebGL ink runs;
//                                              headless otherwise uses a software renderer and
//                                              the site correctly falls back to CSS ink)
//
// Screenshots go to .review/<browser>/. Console errors and failed requests are printed;
// the exit code is non-zero if any page logged an error.

import { chromium, firefox, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt('base', 'http://localhost:4321');
const browserName = opt('browser', 'chromium');
const reduced = args.includes('--reduced-motion');
const pages = opt('pages', '/,/writing/,/writing/inventory-of-a-small-house/,/writing/rain-descending/,/writing/the-night-bus/,/writing/what-the-sea-gives-back/,/about/,/no-such-page/').split(',');
const widths = opt('widths', '390,768,1440').split(',').map(Number);
const heights = { 390: 844, 768: 1024, 1024: 768, 1440: 900, 1920: 1080 };
const shots = Number(opt('shots', '4'));

const outDir = path.join('.review', `${browserName}${args.includes('--gpu') ? '-gpu' : ''}${reduced ? '-reduced' : ''}`);
await mkdir(outDir, { recursive: true });

const engine = { chromium, firefox, webkit }[browserName];
const gpu = args.includes('--gpu') && browserName === 'chromium';
const browser = await engine.launch(gpu ? { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] } : {});
let errors = 0;

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: heights[width] ?? 900 },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    colorScheme: opt('scheme', 'light'),
    hasTouch: width < 768,
    isMobile: browserName === 'chromium' && width < 768,
  });
  for (const p of pages) {
    const page = await context.newPage();
    const problems = [];
    const expect404 = p.includes('no-such-page');
    page.on('console', (m) => m.type() === 'error' && !(expect404 && m.text().includes('404')) && problems.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', (r) => r.status() >= 400 && !r.url().includes('no-such-page') && problems.push(`HTTP ${r.status()}: ${r.url()}`));

    await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3200);
    const slug = (p.replace(/\//g, '_').replace(/^_|_$/g, '') || 'home') + `-${width}`;
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let i = 0; i < shots; i++) {
      const y = Math.round((total * i) / Math.max(1, shots - 1));
      await page.mouse.wheel(0, 0);
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(i === 0 ? 300 : 2200);
      await page.screenshot({ path: path.join(outDir, `${slug}-${i}.png`) });
    }
    const info = await page.evaluate(() => ({
      ink: document.documentElement.classList.contains('ink-live'),
      fallback: document.documentElement.dataset.inkFallback ?? '',
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${browserName} ${width} ${p}  ink=${info.ink}${info.fallback ? ` (${info.fallback})` : ''}${info.overflowX ? '  HORIZONTAL OVERFLOW' : ''}`);
    problems.forEach((m) => console.log(`       ${m}`));
    errors += problems.length + (info.overflowX ? 1 : 0);
    await page.close();
  }
  await context.close();
}

await browser.close();
process.exit(errors ? 1 : 0);
