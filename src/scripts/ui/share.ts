// "Copy link" everywhere, "Share…" where the device has a native share sheet.

export function initShare(scope: HTMLElement) {
  const native = scope.querySelectorAll<HTMLButtonElement>('[data-share="native"]');
  if ('share' in navigator) native.forEach((b) => (b.hidden = false));

  const onClick = async (e: Event) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-share]');
    if (!btn) return;
    const url = btn.dataset.url || location.href;
    const title = btn.dataset.title || document.title;
    const status = scope.querySelector<HTMLElement>('[data-share-status]');
    if (btn.dataset.share === 'native') {
      try {
        await navigator.share({ title, url });
      } catch {
        /* dismissed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      const label = btn.querySelector('[data-label]');
      if (label) {
        label.textContent = 'Link copied';
        setTimeout(() => (label.textContent = 'Copy link'), 2400);
      }
      if (status) status.textContent = 'Link copied to the clipboard.';
    } catch {
      if (status) status.textContent = `Copying is blocked here. The link is ${url}`;
    }
  };
  scope.addEventListener('click', onClick);
  return () => scope.removeEventListener('click', onClick);
}
