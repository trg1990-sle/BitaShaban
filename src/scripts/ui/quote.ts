// Select any words of a piece and a small "Note this line" button appears.
// It hands the selection to the comment form (Marginalia.svelte) as a quote.

import { getLenis, prefersReduced } from '../motion';
import { sendQuote } from '~/lib/quote-bus';

export function initQuote(scope: HTMLElement) {
  const quotable = scope.querySelector<HTMLElement>('[data-quotable]');
  const form = scope.querySelector('#marginalia');
  if (!quotable || !form) return () => {};

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'quote-button label';
  btn.innerHTML = '<span aria-hidden="true">✎</span> Note this line';
  btn.hidden = true;
  quotable.after(btn);
  let text = '';

  const update = () => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      btn.hidden = true;
      return;
    }
    const range = sel.getRangeAt(0);
    if (!quotable.contains(range.commonAncestorContainer)) {
      btn.hidden = true;
      return;
    }
    text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) {
      btn.hidden = true;
      return;
    }
    if (text.length > 300) text = `${text.slice(0, 297).replace(/\s+\S*$/, '')}…`;
    const r = range.getBoundingClientRect();
    const host = (btn.offsetParent as HTMLElement | null) ?? document.body;
    const h = host.getBoundingClientRect();
    btn.hidden = false;
    const left = Math.min(Math.max(r.left - h.left, 0), h.width - btn.offsetWidth);
    btn.style.left = `${left}px`;
    // below the selection, where it won't collide with the phone's own selection menu
    btn.style.top = `${r.bottom - h.top + 10}px`;
  };

  let raf = 0;
  const onChange = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  };
  document.addEventListener('selectionchange', onChange);

  const onClick = () => {
    sendQuote(text);
    getSelection()?.removeAllRanges();
    btn.hidden = true;
    const target = document.getElementById('marginalia-form') ?? form;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(target as HTMLElement, { offset: -innerHeight * 0.25 });
    else target.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
  };
  btn.addEventListener('click', onClick);

  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('selectionchange', onChange);
    btn.remove();
  };
}
