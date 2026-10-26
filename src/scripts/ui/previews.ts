// On hover, a piece's ink study follows the pointer. Fine pointers only;
// touch layouts show the studies inline instead (see the list styles).

import { gsap } from '../motion';

export function initPreviews(scope: HTMLElement) {
  const items = [...scope.querySelectorAll<HTMLElement>('[data-preview]')];
  if (!items.length || !matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  const fig = document.createElement('div');
  fig.className = 'ink-preview';
  fig.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  fig.append(img);
  document.body.append(fig);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const xTo = gsap.quickTo(fig, 'x', { duration: reduced ? 0 : 0.55, ease: 'expo.out' });
  const yTo = gsap.quickTo(fig, 'y', { duration: reduced ? 0 : 0.55, ease: 'expo.out' });
  const rTo = gsap.quickTo(fig, 'rotation', { duration: 0.8, ease: 'expo.out' });
  let lastX = 0;
  let active: HTMLElement | null = null;

  // warm the cache when the list comes near
  const preload = () => items.forEach((el) => (new Image().src = el.dataset.preview!));
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      preload();
      io.disconnect();
    }
  });
  io.observe(items[0]);

  const move = (e: PointerEvent) => {
    xTo(e.clientX);
    yTo(e.clientY);
    rTo(gsap.utils.clamp(-9, 9, (e.clientX - lastX) * 0.35));
    lastX = e.clientX;
  };
  const enter = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    active = el;
    img.src = el.dataset.preview!;
    fig.classList.toggle('on-ink', !!el.closest('[data-ink-region]'));
    if (!fig.classList.contains('is-on')) {
      gsap.set(fig, { x: e.clientX, y: e.clientY });
      lastX = e.clientX;
    }
    fig.classList.add('is-on');
  };
  const leave = (e: PointerEvent) => {
    if (active === e.currentTarget) {
      active = null;
      fig.classList.remove('is-on');
    }
  };

  items.forEach((el) => {
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointermove', move);
  });
  const hide = () => fig.classList.remove('is-on');
  window.addEventListener('scroll', hide, { passive: true });

  return () => {
    io.disconnect();
    window.removeEventListener('scroll', hide);
    items.forEach((el) => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointermove', move);
    });
    fig.remove();
  };
}
