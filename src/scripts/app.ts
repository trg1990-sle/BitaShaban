// Client entry. Runs once per visit; pages come and go through Astro's router.

import { createInk, type Ink, type TrailMode } from './ink';
import { initScroll, revealPage, getLenis, ScrollTrigger } from './motion';
import { currentTheme, initTheme } from './ui/theme';
import { initTextSize } from './ui/text-size';
import { bindHeader, headerTick } from './ui/header';
import { initPreviews } from './ui/previews';
import { initQuote } from './ui/quote';
import { initShare } from './ui/share';
import { initWritingIndex } from './ui/writing-index';

const root = document.documentElement;
const KEEP = ['js', 'wet', 'ink-live', 'is-turning'];

let ink: Ink = createInk(
  document.querySelector<HTMLCanvasElement>('.ink-canvas'),
  document.querySelector<HTMLElement>('.ink-wipe'),
  (fallback) => (ink = fallback),
);
ink.setTheme(currentTheme());

initTheme((t) => ink.setTheme(t));
initScroll((now) => {
  ink.frame(now);
  headerTick();
});

let cleanups: (() => void)[] = [];
let firstLoad = true;
let turning = false;

// Remember where a navigation started, so the ink can bloom from there.
let origin = { x: innerWidth / 2, y: innerHeight / 2 };
document.addEventListener(
  'pointerdown',
  (e) => {
    origin = { x: e.clientX, y: e.clientY };
  },
  { capture: true, passive: true },
);
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key !== 'Enter') return;
    const r = (e.target as Element).getBoundingClientRect?.();
    if (r) origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },
  { capture: true },
);

document.addEventListener('astro:before-preparation', (event) => {
  const e = event as Event & { loader: () => Promise<void> };
  const load = e.loader;
  const from = origin;
  origin = { x: innerWidth / 2, y: innerHeight / 2 };
  e.loader = async () => {
    turning = true;
    root.classList.add('is-turning');
    await Promise.all([ink.cover(from.x, from.y), load()]);
  };
});

document.addEventListener('astro:before-swap', (event) => {
  const e = event as Event & { newDocument: Document };
  cleanups.forEach((fn) => fn());
  cleanups = [];
  const next = e.newDocument.documentElement;
  for (const c of KEEP) if (root.classList.contains(c)) next.classList.add(c);
  if (root.dataset.theme) next.dataset.theme = root.dataset.theme;
  const scale = root.style.getPropertyValue('--reading-scale');
  if (scale) next.style.setProperty('--reading-scale', scale);
});

document.addEventListener('astro:after-swap', () => {
  getLenis()?.scrollTo(scrollY, { immediate: true, force: true });
});

document.addEventListener('astro:page-load', async () => {
  const main = document.getElementById('main');
  if (!main) return;

  ink.setTheme(currentTheme());
  ink.setTrail((main.dataset.inkTrail as TrailMode) || 'soft');
  ink.setRegions([...document.querySelectorAll<HTMLElement>('[data-ink-region]')]);
  ink.setDrop(null);
  bindHeader();
  getLenis()?.resize();

  cleanups.push(initTextSize(main), initPreviews(main), initQuote(main), initShare(main), initWritingIndex(main));

  if (turning) {
    turning = false;
    ink.reveal().then(() => root.classList.remove('is-turning'));
  }

  const delay = firstLoad ? 0.1 : 0.45;
  const done = await revealPage(main, delay);
  cleanups.push(done);
  // the drop lands while the name is still drying
  ink.setDrop(document.querySelector<HTMLElement>('[data-ink-drop]'), delay + 0.75);
  firstLoad = false;
  ScrollTrigger.refresh();
});

if (import.meta.env.DEV) (window as unknown as { __ink: () => Ink }).__ink = () => ink;
