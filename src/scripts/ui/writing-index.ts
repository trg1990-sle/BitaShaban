// The writing index: Contents or Index of first lines, filtered by form and theme.
// Without JavaScript both lists show in full; the state lives in the URL so a
// filtered view can be shared.

export function initWritingIndex(scope: HTMLElement) {
  const index = scope.querySelector<HTMLElement>('[data-index]');
  if (!index) return () => {};

  const state = { view: 'contents', form: '', theme: '' };
  const params = new URLSearchParams(location.search);
  state.view = params.get('view') === 'first-lines' ? 'first-lines' : 'contents';
  state.form = params.get('form') ?? '';
  state.theme = params.get('theme') ?? '';

  const count = index.querySelector<HTMLElement>('[data-count]');
  const empty = index.querySelector<HTMLElement>('[data-empty]');
  const total = index.querySelectorAll('.contents [data-item]').length;

  function render(announce = true) {
    index!.dataset.view = state.view;
    index!.querySelectorAll<HTMLButtonElement>('[data-view-btn]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.viewBtn === state.view));
    });
    index!.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => {
      const key = b.dataset.filter as 'form' | 'theme';
      b.setAttribute('aria-pressed', String((b.dataset.value ?? '') === state[key]));
    });

    let shown = 0;
    index!.querySelectorAll<HTMLElement>('[data-item]').forEach((li) => {
      const ok =
        (!state.form || li.dataset.form === state.form) &&
        (!state.theme || (li.dataset.themes ?? '').split(' ').includes(state.theme));
      if (li.hidden === ok) {
        li.hidden = !ok;
        if (ok) li.classList.add('is-arriving');
      }
      if (ok && li.closest('.contents')) shown++;
    });
    index!.querySelectorAll<HTMLElement>('[data-letter-group]').forEach((g) => {
      g.hidden = !g.querySelector('[data-item]:not([hidden])');
    });

    if (empty) empty.hidden = shown > 0;
    if (count && announce)
      count.textContent =
        shown === total ? `${total} pieces` : `${shown} of ${total} ${total === 1 ? 'piece' : 'pieces'}`;

    const url = new URL(location.href);
    for (const [k, v] of Object.entries({ view: state.view === 'contents' ? '' : state.view, form: state.form, theme: state.theme })) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    history.replaceState(history.state, '', url);
  }

  const onClick = (e: Event) => {
    const t = e.target as Element;
    const view = t.closest<HTMLElement>('[data-view-btn]');
    const filter = t.closest<HTMLElement>('[data-filter]');
    if (view) state.view = view.dataset.viewBtn!;
    else if (filter) state[filter.dataset.filter as 'form' | 'theme'] = filter.dataset.value ?? '';
    else if (t.closest('[data-clear]')) {
      state.form = '';
      state.theme = '';
    } else return;
    render();
  };
  const onAnimEnd = (e: AnimationEvent) => (e.target as Element).classList.remove('is-arriving');

  index.addEventListener('click', onClick);
  index.addEventListener('animationend', onAnimEnd);
  index.classList.add('is-enhanced');
  render(false);
  return () => {
    index.removeEventListener('click', onClick);
    index.removeEventListener('animationend', onAnimEnd);
  };
}
