// One interface for the ink, whether it is drawn live in WebGL or faked with CSS.
// Callers never need to know which one they got.

import { InkEngine, type InkTheme, type TrailMode } from './engine';

export type { InkTheme, TrailMode };

export interface Ink {
  readonly live: boolean;
  setTheme(theme: InkTheme): void;
  setTrail(mode: TrailMode): void;
  setRegions(els: HTMLElement[]): void;
  setDrop(el: HTMLElement | null, delay?: number): void;
  cover(x: number, y: number): Promise<void>;
  reveal(): Promise<void>;
  frame(now: number): void;
}

const root = document.documentElement;

/** CSS page turns: a clip-path bloom in, a wipe down. Also used for reduced motion (a quick fade). */
class CssInk implements Ink {
  readonly live = false;
  constructor(
    private wipe: HTMLElement | null,
    private reduced: boolean,
  ) {}
  setTheme() {}
  setTrail() {}
  setRegions() {}
  setDrop() {}
  frame() {}

  async cover(x: number, y: number) {
    const el = this.wipe;
    if (!el) return;
    el.style.visibility = 'visible';
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
    const anim = this.reduced
      ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'forwards' })
      : el.animate(
          [
            { opacity: 1, clipPath: `circle(0px at ${x}px ${y}px)` },
            { opacity: 1, clipPath: `circle(${r}px at ${x}px ${y}px)` },
          ],
          { duration: 560, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
        );
    await anim.finished.catch(() => {});
  }

  async reveal() {
    const el = this.wipe;
    if (!el) return;
    const anim = this.reduced
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
      : el.animate(
          [
            { opacity: 1, clipPath: 'inset(0 0 0 0)' },
            { opacity: 1, clipPath: 'inset(100% 0 0 0)' },
          ],
          { duration: 720, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
        );
    await anim.finished.catch(() => {});
    el.getAnimations().forEach((a) => a.cancel());
    el.style.visibility = 'hidden';
  }
}

/** WebGL ink, with page turns handed to CSS when motion is reduced. */
class LiveInk implements Ink {
  readonly live = true;
  private started = false;
  constructor(
    private engine: InkEngine,
    private css: CssInk,
    private reduced: boolean,
  ) {}
  setTheme(t: InkTheme) {
    this.engine.setTheme(t);
  }
  setTrail(m: TrailMode) {
    this.engine.setTrail(m);
  }
  setRegions(els: HTMLElement[]) {
    this.engine.setRegions(els);
  }
  setDrop(el: HTMLElement | null, delay?: number) {
    this.engine.setDrop(el, delay);
  }
  cover(x: number, y: number) {
    return this.reduced ? this.css.cover(x, y) : this.engine.cover(x, y);
  }
  reveal() {
    return this.reduced ? this.css.reveal() : this.engine.reveal();
  }
  frame(now: number) {
    this.engine.frame(now);
    if (!this.started) {
      this.started = true;
      root.classList.add('ink-live');
    }
  }
}

function canUseWebGL(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if ((nav.deviceMemory ?? 8) <= 2 && (nav.hardwareConcurrency ?? 8) <= 4) return false;
  return !isSoftwareRenderer();
}

/** Software rasterisers can run WebGL, but not this. */
function isSoftwareRenderer(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return true;
  }
}

function isLowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = matchMedia('(pointer: coarse)').matches;
  return (nav.deviceMemory ?? 8) <= 4 || (coarse && (nav.hardwareConcurrency ?? 8) <= 4);
}

/**
 * Creates the ink. `onFallback` is called if a live engine later gives up
 * (slow GPU, lost context) so the caller can swap in the returned replacement.
 */
export function createInk(canvas: HTMLCanvasElement | null, wipe: HTMLElement | null, onFallback: (ink: Ink) => void): Ink {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = new CssInk(wipe, reduced);
  if (!canvas || !canUseWebGL()) return css;

  try {
    const engine = new InkEngine(canvas, {
      reducedMotion: reduced,
      lowPower: isLowPower(),
      onFail: (reason) => {
        root.dataset.inkFallback = reason;
        engine.destroy();
        root.classList.remove('ink-live');
        canvas.style.display = 'none';
        onFallback(css);
      },
    });
    return new LiveInk(engine, css, reduced);
  } catch {
    canvas.style.display = 'none';
    return css;
  }
}
