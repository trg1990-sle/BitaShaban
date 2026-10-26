// Wet-to-dry: the only entrance animation on the site.
// Type arrives soft (Fraunces SOFT 100), blurred and in wet violet, and dries crisp.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger };

const root = document.documentElement;
export const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;
export const getLenis = () => lenis;

/** Smooth wheel scrolling on fine pointers only; touch and reduced motion stay native. */
export function initScroll(onFrame: (now: number) => void) {
  if (!prefersReduced() && matchMedia('(pointer: fine)').matches) {
    lenis = new Lenis({ lerp: 0.12, smoothWheel: true, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
  }
  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
    onFrame(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

const wetColour = (el: Element) => getComputedStyle(el).getPropertyValue('--accent').trim() || '#4e49b0';

// Iron-gall ink goes on pale: wet type is faint, not invisible (and so already painted).
const WET = { opacity: 0.07, filter: 'blur(7px)', '--soft': 100 } as const;
const DRY = { opacity: 1, filter: 'blur(0px)', '--soft': 0 } as const;

/**
 * Sets up every entrance on the page inside `scope`.
 * Things already on screen dry after `delay`; the rest dry as they scroll in.
 * Returns a cleanup for page swaps.
 */
export async function revealPage(scope: HTMLElement, delay = 0): Promise<() => void> {
  if (!root.classList.contains('wet')) {
    root.classList.add('wet-ready');
    return () => {};
  }
  let alive = true;
  const ctx = gsap.context(() => {
    const vh = innerHeight;
    const onScreen = (el: Element) => el.getBoundingClientRect().top < vh * 0.92;
    const later = (el: Element, play: () => void) => {
      if (onScreen(el)) gsap.delayedCall(delay, play);
      else ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: play });
    };

    // Titles: character by character.
    scope.querySelectorAll<HTMLElement>('[data-wet="chars"]').forEach((el) => {
      const split = SplitText.create(el, { type: 'words,chars', wordsClass: 'w', charsClass: 'c' });
      gsap.set(split.chars, { ...WET, yPercent: 14 });
      later(el, () =>
        gsap.fromTo(
          split.chars,
          { ...WET, yPercent: 14, color: wetColour(el) },
          {
            ...DRY,
            yPercent: 0,
            color: getComputedStyle(el).color,
            duration: 1.5,
            ease: 'expo.out',
            stagger: { each: 0.045, from: 'start' },
            clearProps: 'filter,color,opacity,transform,--soft',
            onComplete: () => split.revert(),
          },
        ),
      );
    });

    // Long headings and ledes: line by line. Lines depend on the final font, so these
    // wait for it; everything else starts straight away.
    const lineEls = [...scope.querySelectorAll<HTMLElement>('[data-wet="lines"]')];
    gsap.set(lineEls, WET);
    const splitLines = () => {
      if (!alive) return;
      ctx.add(() =>
        lineEls.forEach((el) => {
          gsap.set(el, { clearProps: 'opacity,filter,--soft' });
          const split = SplitText.create(el, { type: 'lines', linesClass: 'l' });
          gsap.set(split.lines, WET);
          later(el, () =>
            gsap.fromTo(
              split.lines,
              { ...WET, y: '0.25em', color: wetColour(el) },
              {
                ...DRY,
                y: 0,
                color: getComputedStyle(el).color,
                duration: 1.4,
                ease: 'expo.out',
                stagger: 0.14,
                clearProps: 'filter,color,opacity,transform,--soft',
                onComplete: () => split.revert(),
              },
            ),
          );
        }),
      );
    };
    (document.fonts?.ready ?? Promise.resolve()).then(splitLines);

    // Whole elements.
    scope.querySelectorAll<HTMLElement>('[data-wet="block"]').forEach((el) => {
      gsap.set(el, WET);
      later(el, () =>
        gsap.fromTo(el, { ...WET, y: 14 }, { ...DRY, y: 0, duration: 1.2, ease: 'expo.out', clearProps: 'all' }),
      );
    });

    // Poems: every line, section heading and fragment number, in reading order.
    // Batches keep a whole stanza readable within about a second.
    const parts = [
      ...scope.querySelectorAll<HTMLElement>(
        '[data-reveal="lines"] .verse__section, [data-reveal="lines"] .verse__frag, [data-reveal="lines"] .line, [data-reveal="blocks"] > *',
      ),
    ];
    if (parts.length) {
      gsap.set(parts, WET);
      const play = (batch: Element[]) => {
        const colour = wetColour(batch[0]);
        gsap.fromTo(
          batch,
          { ...WET, y: '0.3em', color: colour },
          {
            ...DRY,
            y: 0,
            color: (_i: number, el: Element) => getComputedStyle(el.parentElement ?? el).color,
            duration: 1.1,
            ease: 'expo.out',
            stagger: Math.min(0.085, 0.9 / batch.length),
            clearProps: 'filter,color,opacity,transform,--soft',
          },
        );
      };
      const first = parts.filter(onScreen);
      if (first.length) gsap.delayedCall(delay, () => play(first));
      const rest = parts.filter((p) => !first.includes(p));
      if (rest.length) ScrollTrigger.batch(rest, { start: 'top 94%', once: true, onEnter: (batch) => play(batch) });
    }
  }, scope);

  root.classList.add('wet-ready');
  requestAnimationFrame(() => ScrollTrigger.refresh());
  return () => {
    alive = false;
    ctx.revert();
  };
}
