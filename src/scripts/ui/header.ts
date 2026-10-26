// The header steps aside while you read down the page and comes back when you
// scroll up. Over a flooded section it switches to night colours.

let header: HTMLElement | null = null;
let regions: HTMLElement[] = [];
let lastY = 0;
let hidden = false;
let onInk = false;

export function bindHeader() {
  header = document.querySelector<HTMLElement>('.site-header');
  regions = [...document.querySelectorAll<HTMLElement>('[data-ink-region]')];
  lastY = scrollY;
  hidden = false;
  onInk = false;
  header?.classList.remove('is-hidden', 'is-on-ink');
}

export function headerTick() {
  if (!header) return;
  const y = scrollY;
  const dy = y - lastY;
  lastY = y;

  if (Math.abs(dy) > 3) {
    const next = y > 160 && dy > 0 && !header.contains(document.activeElement);
    if (next !== hidden) {
      hidden = next;
      header.classList.toggle('is-hidden', hidden);
    }
  }
  header.classList.toggle('is-scrolled', y > 8);

  const mid = header.offsetHeight / 2;
  let ink = false;
  for (const r of regions) {
    const b = r.getBoundingClientRect();
    if (b.top - 24 <= mid && b.bottom + 24 >= mid) {
      ink = true;
      break;
    }
  }
  if (ink !== onInk) {
    onInk = ink;
    header.classList.toggle('is-on-ink', onInk);
  }
}
