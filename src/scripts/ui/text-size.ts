// Reading size, remembered per reader. Scales poem and prose text only.

const KEY = 'bs:text-scale';
const MIN = 0.9;
const MAX = 1.3;
const STEP = 0.1;
const root = document.documentElement;

const current = () => parseFloat(getComputedStyle(root).getPropertyValue('--reading-scale')) || 1;

function apply(scale: number) {
  const s = Math.round(Math.min(MAX, Math.max(MIN, scale)) * 10) / 10;
  root.style.setProperty('--reading-scale', String(s));
  try {
    localStorage.setItem(KEY, String(s));
  } catch {
    /* not persisted */
  }
  sync(s);
}

function sync(s = current()) {
  document.querySelectorAll<HTMLButtonElement>('[data-text-size]').forEach((b) => {
    const dir = Number(b.dataset.textSize);
    b.disabled = (dir < 0 && s <= MIN + 0.001) || (dir > 0 && s >= MAX - 0.001);
  });
  document.querySelectorAll('[data-text-size-value]').forEach((el) => {
    el.textContent = `${Math.round(s * 100)}%`;
  });
}

export function initTextSize(scope: HTMLElement) {
  const onClick = (e: Event) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-text-size]');
    if (!btn) return;
    const dir = Number(btn.dataset.textSize);
    apply(dir === 0 ? 1 : current() + dir * STEP);
  };
  scope.addEventListener('click', onClick);
  sync();
  return () => scope.removeEventListener('click', onClick);
}
