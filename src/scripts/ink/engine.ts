// The live ink: one fixed, transparent WebGL2 canvas behind the page.
//
// It draws (1) ink left by the pointer, simulated on a small grid, (2) the flooded
// "night" sections with ragged, slowly bleeding edges, measured from the DOM every
// frame, (3) the drop that falls onto the hero, and (4) page-turn floods.
// It renders only when something on screen needs it, and idles otherwise.

import { DISPLAY, SIM, VERT } from './shaders';

type RGB = [number, number, number];
export type InkTheme = 'paper' | 'night';
export type TrailMode = 'full' | 'soft' | 'quiet' | 'off';

const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;

const PALETTES: Record<InkTheme, Record<'ink' | 'wet' | 'region' | 'dropInk', RGB>> = {
  paper: {
    ink: rgb('#1c1a24'),
    wet: rgb('#4e49b0'),
    region: rgb('#15121d'),
    dropInk: rgb('#1c1a24'),
  },
  night: {
    ink: rgb('#aaa6f6'),
    wet: rgb('#5a55b8'),
    region: rgb('#1b1830'),
    dropInk: rgb('#e4e2e8'),
  },
};

const TRAIL: Record<TrailMode, number> = { full: 0.95, soft: 0.6, quiet: 0.3, off: 0 };
const TRAIL_LIFE = 7; // seconds of evaporation before the simulation goes idle

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInQuad = (x: number) => x * x;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

interface RegionState {
  el: HTMLElement;
  seed: number;
  floodFrom: number | null;
  front: number;
  done: boolean;
}

interface Tween {
  from: number;
  to: number;
  start: number;
  duration: number;
  ease: (x: number) => number;
  resolve: () => void;
}

export interface InkEngineOptions {
  reducedMotion: boolean;
  lowPower: boolean;
  /** Called if the GPU cannot keep up or the context is lost; the caller falls back to CSS. */
  onFail: (reason: string) => void;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

function program(gl: WebGL2RenderingContext, frag: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name));
    return uniforms.get(name)!;
  };
  return { p, u };
}

export class InkEngine {
  private gl: WebGL2RenderingContext;
  private display: ReturnType<typeof program>;
  private sim: ReturnType<typeof program>;
  private vao: WebGLVertexArrayObject;
  private targets: [Target, Target] | null = null;
  private simFormat: { internal: number; type: number };
  private simW = 0;
  private simH = 0;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private quality = 1;
  private simEnabled = true;

  private regions: RegionState[] = [];
  private dropEl: HTMLElement | null = null;
  private dropStart = -1;
  private coverState = { active: false, x: 0, y: 0, r: 0 };
  private drain = { active: false, front: 0 };
  private tweens = new Map<string, Tween>();

  private pointer = { x: 0, y: 0, px: 0, py: 0, moved: false, burst: 0, has: false };
  private lastInk = -1e9;
  private simClear = true;
  private time = 0;
  private lastScrollY = 0;
  private trail = TRAIL.full;
  private palette = PALETTES.paper;
  private drew = false;
  private lastDraw = 0;
  private lastSignature = '';
  private probe = { frames: 0, total: 0, degraded: false, done: false };
  private dead = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: InkEngineOptions,
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      // The engine skips frames when nothing moves; keep the last one on screen everywhere.
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;

    const floatOk = !!gl.getExtension('EXT_color_buffer_float');
    this.simFormat = floatOk
      ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT }
      : { internal: gl.RGBA8, type: gl.UNSIGNED_BYTE };

    this.display = program(gl, DISPLAY);
    this.sim = program(gl, SIM);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    if (opts.lowPower) {
      this.quality = 0.6;
      this.simEnabled = false;
    }
    if (opts.reducedMotion) this.simEnabled = false;

    canvas.addEventListener('webglcontextlost', this.onLost, false);
    this.bindPointer();
    this.resize();
    this.lastScrollY = window.scrollY;
  }

  /* ---- public API -------------------------------------------------- */

  setTheme(theme: InkTheme) {
    this.palette = PALETTES[theme];
    this.lastSignature = '';
  }

  setTrail(mode: TrailMode) {
    this.trail = this.opts.reducedMotion ? 0 : TRAIL[mode];
  }

  /** Register the flooded sections of the current page. */
  setRegions(els: HTMLElement[]) {
    const vh = window.innerHeight;
    this.regions = els.slice(0, 4).map((el, i) => {
      const top = el.getBoundingClientRect().top;
      // Already on screen (or above it) when the page appears: no flood, it is simply night.
      const done = this.opts.reducedMotion || top < vh * 0.62;
      // CSS paints the section's inside, clipped to the flood front (see global.css).
      if (done) el.style.removeProperty('--ink-front');
      else el.style.setProperty('--ink-front', '0px');
      return { el, seed: 3.7 + i * 11.3, floodFrom: done ? 0 : null, front: 0, done };
    });
    this.lastSignature = '';
  }

  /** The hero's full stop: a drop falls onto this element and blooms. */
  setDrop(el: HTMLElement | null, delay = 0) {
    this.dropEl = el;
    this.dropStart = el ? (this.opts.reducedMotion ? -1e6 : this.time + delay) : -1;
    this.lastSignature = '';
  }

  /** Flood the page from (x, y). Resolves when the sheet is covered. */
  cover(x: number, y: number): Promise<void> {
    const r = Math.hypot(Math.max(x, this.w - x), Math.max(y, this.h - y)) * 1.35 + 120;
    this.drain.active = false;
    this.coverState = { active: true, x, y, r: 0 };
    return this.tween('cover', 0, r, 0.72, easeInOutCubic);
  }

  /** Drain the ink down the sheet to reveal the new page. */
  reveal(): Promise<void> {
    this.coverState.active = false;
    this.drain = { active: true, front: -400 };
    return this.tween('drain', -400, this.h + 420, 1.05, easeInOutCubic).then(() => {
      this.drain.active = false;
    });
  }

  get covering() {
    return this.coverState.active;
  }

  destroy() {
    this.dead = true;
    for (const r of this.regions) r.el.style.removeProperty('--ink-front');
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('touchstart', this.onTouch);
    window.removeEventListener('touchmove', this.onTouch);
  }

  /** Call once per animation frame. */
  frame(nowMs: number) {
    if (this.dead) return;
    const t = nowMs / 1000;
    const rawDt = this.time ? t - this.time : 1 / 60;
    const dt = Math.min(rawDt, 0.1);
    this.time = t;

    if (this.canvas.clientWidth !== this.w || this.canvas.clientHeight !== this.h) this.resize();

    const sy = window.scrollY;
    const scrollDy = sy - this.lastScrollY;
    this.lastScrollY = sy;

    this.stepTweens(t);

    // regions on screen
    const vh = this.h;
    const amp = this.edgeAmp();
    const regionData = new Float32Array(16);
    let count = 0;
    let animating = false;
    for (const r of this.regions) {
      const rect = r.el.getBoundingClientRect();
      if (r.floodFrom === null && rect.top < vh * 0.62) r.floodFrom = t;
      if (rect.bottom < -amp * 4 || rect.top > vh + amp * 4 || count >= 4) continue;
      let front = 1e6;
      if (!r.done) {
        if (r.floodFrom === null) front = -amp * 4;
        else {
          // Pours at about half a screen a second, so you can watch it cross the page,
          // but never trails more than 30% of a screen behind someone scrolling fast.
          const since = t - r.floodFrom;
          const poured = vh * 0.5 * since * Math.min(1, 0.3 + since / 0.4);
          const chasing = vh - rect.top - vh * 0.3;
          r.front = Math.max(r.front, poured, chasing);
          front = r.front;
          if (front >= rect.height + amp * 3) {
            r.done = true;
            r.el.style.removeProperty('--ink-front');
          } else r.el.style.setProperty('--ink-front', `${front.toFixed(1)}px`);
          animating = true;
        }
      }
      regionData.set([rect.top, rect.bottom, front, r.seed], count * 4);
      count++;
    }

    // the drop
    let drop: [number, number, number, number] = [0, 0, 0, 0];
    let fall: [number, number, number] = [0, 0, 0];
    let dropVisible = false;
    // Text splitting can replace the element under us; follow it by its attribute.
    if (this.dropEl && !this.dropEl.isConnected) this.dropEl = document.querySelector<HTMLElement>('[data-ink-drop]');
    if (this.dropEl && this.dropStart !== -1 && t >= this.dropStart) {
      const rect = this.dropEl.getBoundingClientRect();
      if (rect.bottom > -200 && rect.top < vh + 200 && rect.width > 0) {
        dropVisible = true;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const maxR = rect.width / 2;
        const fallTime = 0.62;
        const since = t - this.dropStart;
        if (since < fallTime) {
          const dist = Math.min(cy + 80, vh * 0.7);
          fall = [(1 - easeInQuad(since / fallTime)) * dist, maxR * 0.34, 1];
          animating = true;
        } else {
          const landed = since - fallTime;
          const bloom = easeOutExpo(Math.min(landed / 2.4, 1));
          const creep = 1 + 0.08 * (1 - Math.exp(-landed / 18));
          const dry = Math.min(landed / 5.5, 1);
          drop = [cx, cy, Math.max(0.6, maxR * bloom * creep), easeOutCubic(dry)];
          if (landed < 6 && !this.opts.reducedMotion) animating = true;
        }
      }
    }

    // pointer ink
    const inkLive = this.simEnabled && this.trail > 0 && t - this.lastInk < TRAIL_LIFE;
    const needSim = inkLive || this.pointer.moved || this.pointer.burst > 0;

    const transitioning = this.coverState.active || this.drain.active;
    const visible = count > 0 || dropVisible || transitioning || (this.simEnabled && !this.simClear);

    if (!visible) {
      if (this.drew) this.clear();
      return;
    }

    // With reduced motion nothing drifts; redraw only when positions change.
    const signature = `${count}:${regionData.join(',')}:${drop.join(',')}:${this.w}x${this.h}`;
    const calm = !animating && !transitioning && !needSim && signature === this.lastSignature;
    if (calm && (this.opts.reducedMotion || document.hidden)) return;
    // When only the edges are drifting, 30 fps is plenty; anything that moves with the page draws every frame.
    if (calm && t - this.lastDraw < 1 / 30) return;
    this.lastSignature = signature;
    this.lastDraw = t;

    if (this.simEnabled && needSim) this.stepSim(t, dt, scrollDy);
    else if (this.simEnabled && !this.simClear && t - this.lastInk >= TRAIL_LIFE) this.clearSim();

    this.draw(t, regionData, count, amp, drop, fall);
    this.measure(rawDt);
  }

  /* ---- internals ---------------------------------------------------- */

  private edgeAmp() {
    return Math.min(56, Math.max(22, this.w * 0.032));
  }

  private tween(name: string, from: number, to: number, duration: number, ease: (x: number) => number) {
    this.tweens.get(name)?.resolve();
    return new Promise<void>((resolve) => {
      this.tweens.set(name, { from, to, start: this.time || performance.now() / 1000, duration, ease, resolve });
    });
  }

  private stepTweens(t: number) {
    for (const [name, tw] of this.tweens) {
      const k = Math.min(Math.max((t - tw.start) / tw.duration, 0), 1);
      const v = tw.from + (tw.to - tw.from) * tw.ease(k);
      if (name === 'cover') this.coverState.r = v;
      if (name === 'drain') this.drain.front = v;
      if (k >= 1) {
        this.tweens.delete(name);
        tw.resolve();
      }
    }
  }

  private resize() {
    const gl = this.gl;
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5) * this.quality;
    this.canvas.width = Math.max(1, Math.round(this.w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.h * this.dpr));

    if (!this.simEnabled) return;
    const sw = Math.max(64, Math.round(this.w / 4));
    const sh = Math.max(64, Math.round(this.h / 4));
    if (sw === this.simW && sh === this.simH && this.targets) return;
    this.simW = sw;
    this.simH = sh;
    if (this.targets) for (const tg of this.targets) {
      gl.deleteFramebuffer(tg.fbo);
      gl.deleteTexture(tg.tex);
    }
    this.targets = [this.makeTarget(sw, sh), this.makeTarget(sw, sh)];
    this.simClear = false;
    this.clearSim();
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.simFormat.internal, w, h, 0, gl.RGBA, this.simFormat.type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && this.simFormat.type !== gl.UNSIGNED_BYTE) {
      // half-float targets not renderable after all: drop to 8-bit
      this.simFormat = { internal: gl.RGBA8, type: gl.UNSIGNED_BYTE };
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);
      return this.makeTarget(w, h);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex };
  }

  private clearSim() {
    if (!this.targets || this.simClear) return;
    const gl = this.gl;
    for (const tg of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, tg.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.simClear = true;
  }

  private clear() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.drew = false;
    this.lastSignature = '';
  }

  private stepSim(t: number, dt: number, scrollDy: number) {
    if (!this.targets) return;
    const gl = this.gl;
    const { u, p } = this.sim;
    const [read, write] = this.targets;
    const ptr = this.pointer;

    let amount = 0;
    let radius = 0;
    let ax = ptr.x, ay = ptr.y, bx = ptr.x, by = ptr.y;
    if (ptr.burst > 0) {
      amount = 0.9 * ptr.burst;
      radius = 20;
      ptr.burst = 0;
    } else if (ptr.moved) {
      const dist = Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py);
      amount = Math.min(0.5, 0.05 + dist / 70);
      radius = Math.min(26, 7 + dist * 0.18);
      ax = ptr.px;
      ay = ptr.py;
    }
    ptr.px = ptr.x;
    ptr.py = ptr.y;
    ptr.moved = false;
    if (amount > 0) {
      this.lastInk = t;
      this.simClear = false;
    }

    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, this.simW, this.simH);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(u('uPrev'), 0);
    gl.uniform2f(u('uSimRes'), this.simW, this.simH);
    gl.uniform2f(u('uA'), ax / this.w, 1 - ay / this.h);
    gl.uniform2f(u('uB'), bx / this.w, 1 - by / this.h);
    gl.uniform1f(u('uRadius'), radius / this.h);
    gl.uniform1f(u('uAmount'), amount * this.trail);
    gl.uniform1f(u('uDecay'), Math.pow(0.991, dt * 60));
    gl.uniform1f(u('uScroll'), scrollDy / this.h);
    gl.uniform1f(u('uTime'), t);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.targets = [write, read];
  }

  private draw(
    t: number,
    regions: Float32Array,
    count: number,
    amp: number,
    drop: [number, number, number, number],
    fall: [number, number, number],
  ) {
    const gl = this.gl;
    const { u, p } = this.display;
    const pal = this.palette;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(p);
    gl.disable(gl.BLEND);

    const hasSim = this.simEnabled && this.targets && !this.simClear;
    if (hasSim) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.targets![0].tex);
    }
    gl.uniform1i(u('uSim'), 0);
    gl.uniform1f(u('uHasSim'), hasSim ? 1 : 0);
    gl.uniform1f(u('uTrail'), this.trail);
    gl.uniform2f(u('uRes'), this.canvas.width, this.canvas.height);
    gl.uniform1f(u('uDpr'), this.canvas.width / this.w);
    gl.uniform1f(u('uTime'), this.opts.reducedMotion ? 0 : t);
    gl.uniform4fv(u('uRegions[0]'), regions);
    gl.uniform1i(u('uRegionCount'), count);
    gl.uniform1f(u('uEdgeAmp'), amp);
    gl.uniform4f(u('uDrop'), ...drop);
    gl.uniform3f(u('uDropFall'), ...fall);
    gl.uniform4f(u('uCover'), this.coverState.x, this.coverState.y, this.coverState.r, this.coverState.active ? 1 : 0);
    gl.uniform2f(u('uDrain'), this.drain.front, this.drain.active ? 1 : 0);
    gl.uniform3f(u('uInk'), ...pal.ink);
    gl.uniform3f(u('uWet'), ...pal.wet);
    gl.uniform3f(u('uRegion'), ...pal.region);
    gl.uniform3f(u('uDropInk'), ...pal.dropInk);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drew = true;
  }

  /**
   * Watch the first ~3 seconds of real work. If frames are slow, drop the simulation and
   * resolution; if they are still slow after that, give up and let CSS draw the ink.
   */
  private measure(dt: number) {
    const pr = this.probe;
    // A frame this late is a throttled or backgrounded page, not GPU cost.
    if (pr.done || document.hidden || dt > 0.25) return;
    pr.frames++;
    if (pr.frames <= 8) return; // warm-up: shader compile, first uploads
    pr.total += dt;
    if (pr.total < 3) return;
    const avg = pr.total / (pr.frames - 8);
    pr.frames = 0;
    pr.total = 0;
    if (avg <= 1 / 40) {
      pr.done = true;
    } else if (!pr.degraded) {
      pr.degraded = true;
      this.quality = 0.55;
      this.simEnabled = false;
      this.resize();
    } else {
      pr.done = true;
      this.opts.onFail('slow');
    }
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.dead = true;
    this.opts.onFail('context-lost');
  };

  private bindPointer() {
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('touchstart', this.onTouch, { passive: true });
    window.addEventListener('touchmove', this.onTouch, { passive: true });
  }

  private setPointer(x: number, y: number) {
    const ptr = this.pointer;
    if (!ptr.has) {
      ptr.px = x;
      ptr.py = y;
      ptr.has = true;
    }
    ptr.x = x;
    ptr.y = y;
    ptr.moved = true;
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // handled by touch events, which survive scrolling
    if (e.clientX === 0 && e.clientY === 0) return; // synthetic moves from some browsers
    this.setPointer(e.clientX, e.clientY);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.setPointer(e.clientX, e.clientY);
    this.pointer.px = e.clientX;
    this.pointer.py = e.clientY;
    this.pointer.burst = 1;
  };

  private onTouch = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    if (e.type === 'touchstart') {
      this.pointer.has = false;
      this.setPointer(touch.clientX, touch.clientY);
      this.pointer.burst = 0.7;
    } else this.setPointer(touch.clientX, touch.clientY);
  };
}
