<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { CommentsError, LIMITS, hasErrors, validateComment, type Comment, type FieldErrors } from '~/lib/comments';

  interface Props {
    postId: string;
    /** Set when replying. */
    parent?: Comment;
    quote?: string;
    ready: boolean;
    save: (input: { author: string; body: string; quote?: string; parentId?: string; website?: string }) => Promise<Comment>;
    onsaved: (c: Comment) => void;
    oncancel?: () => void;
  }

  let { postId, parent, quote = $bindable(''), ready, save, onsaved, oncancel }: Props = $props();

  const NAME_KEY = 'bs:reader-name';
  const uid = `${postId}-${parent?.id ?? 'new'}`;

  let author = $state('');
  let body = $state('');
  let website = $state('');
  let status: 'idle' | 'saving' | 'saved' | 'error' = $state('idle');
  let errors: FieldErrors = $state({});
  let message = $state('');
  let attempted = $state(false);
  let authorEl: HTMLInputElement | undefined = $state();
  let bodyEl: HTMLTextAreaElement | undefined = $state();

  const length = $derived(body.trim().length);
  const near = $derived(length > LIMITS.body * 0.85);

  onMount(() => {
    try {
      author = localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      /* not available */
    }
    if (parent) (author ? bodyEl : authorEl)?.focus();
  });

  export function focusBody() {
    bodyEl?.focus({ preventScroll: true });
  }

  function revalidate() {
    if (attempted) errors = validateComment({ author, body, quote });
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (status === 'saving') return;
    attempted = true;
    errors = validateComment({ author, body, quote });
    if (hasErrors(errors)) {
      status = 'idle';
      message = '';
      await tick();
      (errors.author ? authorEl : bodyEl)?.focus();
      return;
    }
    status = 'saving';
    message = '';
    try {
      const saved = await save({
        author: author.trim(),
        body: body.trim(),
        quote: quote || undefined,
        parentId: parent?.id,
        website,
      });
      try {
        localStorage.setItem(NAME_KEY, author.trim());
      } catch {
        /* not remembered */
      }
      status = 'saved';
      message = parent ? 'Your reply is in the margin.' : 'Your note is in the margin.';
      body = '';
      quote = '';
      attempted = false;
      errors = {};
      onsaved(saved);
      setTimeout(() => {
        if (status === 'saved') status = 'idle';
      }, 4000);
    } catch (err) {
      status = 'error';
      if (err instanceof CommentsError && err.code === 'validation') {
        errors = err.fieldErrors as FieldErrors;
        message = 'Some fields need attention.';
      } else {
        message = err instanceof CommentsError ? err.message : 'The note was not saved. Try again in a moment.';
      }
    }
  }
</script>

<form class="note-form" class:note-form--reply={!!parent} novalidate onsubmit={submit} aria-labelledby={`${uid}-legend`}>
  <p class="note-form__legend label" id={`${uid}-legend`}>
    {parent ? `Reply to ${parent.author}` : 'Leave a note'}
  </p>

  {#if quote}
    <div class="note-form__quote">
      <p class="label">Responding to</p>
      <blockquote><p>{quote}</p></blockquote>
      <button type="button" class="text-button" onclick={() => (quote = '')}>Remove quote</button>
      {#if errors.quote}<p class="note-form__error">{errors.quote}</p>{/if}
    </div>
  {/if}

  <div class="field" class:field--invalid={!!errors.author}>
    <label for={`${uid}-name`} class="label">Your name</label>
    <input
      bind:this={authorEl}
      bind:value={author}
      oninput={revalidate}
      id={`${uid}-name`}
      name="author"
      type="text"
      autocomplete="name"
      spellcheck="false"
      aria-invalid={errors.author ? 'true' : undefined}
      aria-describedby={errors.author ? `${uid}-name-error` : undefined}
    />
    {#if errors.author}<p class="note-form__error" id={`${uid}-name-error`}>{errors.author}</p>{/if}
  </div>

  <div class="field" class:field--invalid={!!errors.body}>
    <label for={`${uid}-body`} class="label">{parent ? 'Your reply' : 'Your note'}</label>
    <textarea
      bind:this={bodyEl}
      bind:value={body}
      oninput={revalidate}
      id={`${uid}-body`}
      name="body"
      rows={parent ? 3 : 4}
      aria-invalid={errors.body ? 'true' : undefined}
      aria-describedby={`${uid}-count${errors.body ? ` ${uid}-body-error` : ''}`}
    ></textarea>
    <div class="field__foot">
      {#if errors.body}<p class="note-form__error" id={`${uid}-body-error`}>{errors.body}</p>{/if}
      <p class="field__count label" class:is-near={near} id={`${uid}-count`}>
        {length.toLocaleString('en')} / {LIMITS.body.toLocaleString('en')}<span class="visually-hidden"> characters</span>
      </p>
    </div>
  </div>

  <div class="note-form__honeypot" aria-hidden="true">
    <label for={`${uid}-website`}>Leave this empty</label>
    <input id={`${uid}-website`} name="website" type="text" tabindex="-1" autocomplete="off" bind:value={website} />
  </div>

  <div class="note-form__actions">
    <button class="note-form__submit" type="submit" disabled={!ready} aria-disabled={status === 'saving'}>
      {#if status === 'saving'}
        <span class="ink-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        {parent ? 'Leaving reply…' : 'Leaving note…'}
      {:else if status === 'error'}
        Try again
      {:else}
        {parent ? 'Leave reply' : 'Leave note'}
      {/if}
    </button>
    {#if oncancel}
      <button type="button" class="text-button" onclick={oncancel}>Cancel</button>
    {/if}
  </div>

  <p class="note-form__status" class:is-error={status === 'error'} role={status === 'error' ? 'alert' : 'status'}>
    {message}{status === 'error' && message ? ' Your words are still in the box.' : ''}
  </p>
</form>

<style>
  .note-form {
    display: grid;
    gap: 1.25rem;
    padding-block: 0.5rem;
  }
  .note-form--reply {
    margin-block: 1.25rem 0.5rem;
    padding-inline-start: 1.25rem;
    border-inline-start: 1px solid var(--rule);
  }
  .note-form__legend {
    color: var(--fg-2);
  }
  .field {
    display: grid;
    gap: 0.45rem;
  }
  .field .label {
    color: var(--fg-2);
  }
  input,
  textarea {
    width: 100%;
    min-height: 2.9rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid color-mix(in oklab, var(--fg) 22%, transparent);
    border-radius: 3px;
    background: color-mix(in oklab, var(--bg) 70%, transparent);
    font-family: var(--serif);
    font-size: 1.0625rem;
    line-height: 1.5;
    transition:
      border-color var(--quick) ease,
      box-shadow var(--quick) ease;
  }
  /* what you write is still wet */
  textarea {
    resize: vertical;
    color: var(--accent);
    font-style: italic;
    min-height: 7.5rem;
  }
  input:hover,
  textarea:hover {
    border-color: color-mix(in oklab, var(--fg) 40%, transparent);
  }
  input:focus-visible,
  textarea:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent);
  }
  .field--invalid input,
  .field--invalid textarea {
    border-color: var(--error);
  }
  .field__foot {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }
  .field__count {
    margin-inline-start: auto;
    color: var(--fg-2);
    white-space: nowrap;
  }
  .field__count.is-near {
    color: var(--error);
  }
  .note-form__error {
    color: var(--error);
    font-size: var(--small);
    line-height: 1.45;
  }
  .note-form__quote {
    display: grid;
    gap: 0.35rem;
    justify-items: start;
    padding: 0.9rem 1rem;
    border-inline-start: 2px solid var(--accent);
    background: color-mix(in oklab, var(--accent) 7%, transparent);
  }
  .note-form__quote .label {
    color: var(--fg-2);
  }
  .note-form__quote blockquote {
    font-style: italic;
  }
  .note-form__honeypot {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  .note-form__actions {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
  .note-form__submit {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 3rem;
    padding: 0.75rem 1.4rem;
    border-radius: 999px;
    background: var(--fg);
    color: var(--bg);
    font-family: var(--mono);
    font-size: var(--label);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    transition:
      background-color var(--quick) ease,
      transform var(--quick) ease;
  }
  .note-form__submit:hover:not(:disabled) {
    background: var(--accent);
  }
  .note-form__submit:active:not(:disabled) {
    transform: scale(0.98);
  }
  .note-form__submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .note-form__submit[aria-disabled='true'] {
    cursor: progress;
  }
  .note-form__status {
    min-height: 1.5em;
    font-size: var(--small);
    color: var(--accent);
  }
  .note-form__status.is-error {
    color: var(--error);
  }
  .ink-dots {
    display: inline-flex;
    gap: 3px;
  }
  .ink-dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    animation: ink-dot 1.1s var(--ease-paper) infinite;
  }
  .ink-dots i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .ink-dots i:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes ink-dot {
    0%,
    100% {
      transform: scale(0.5);
      opacity: 0.4;
    }
    50% {
      transform: scale(1);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ink-dots i {
      animation: none;
    }
  }
</style>
