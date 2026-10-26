// Paper / Night. Follows the system until the reader chooses, then remembers.

export type Theme = 'paper' | 'night';
const KEY = 'bs:theme';
const root = document.documentElement;

export function currentTheme(): Theme {
  const set = root.dataset.theme as Theme | undefined;
  if (set === 'paper' || set === 'night') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
}

function sync() {
  const night = currentTheme() === 'night';
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(night));
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', night ? '#121019' : '#e4e2e8');
}

export function initTheme(onChange: (t: Theme) => void) {
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('[data-theme-toggle]');
    if (!btn) return;
    const next: Theme = currentTheme() === 'night' ? 'paper' : 'night';
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
    sync();
    onChange(next);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (root.dataset.theme) return;
    sync();
    onChange(currentTheme());
  });
  document.addEventListener('astro:page-load', sync);
}
