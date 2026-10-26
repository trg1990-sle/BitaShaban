<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { getCommentsService, type Comment } from '~/lib/comments';
  import { onQuote } from '~/lib/quote-bus';
  import NoteForm from './NoteForm.svelte';

  interface Props {
    postId: string;
    /** "poem", "prose poem", … used in the hint copy. */
    formName: string;
    /** Server-rendered notes (the seed), replaced by the service's list once loaded. */
    initial?: Comment[];
  }

  let { postId, formName, initial = [] }: Props = $props();

  let comments: Comment[] = $state(initial);
  let hydrated = $state(false);
  let loading = $state(false);
  let loadError = $state('');
  let replyTo: string | null = $state(null);
  let fresh: string[] = $state([]);
  let quote = $state('');
  let mainForm: ReturnType<typeof NoteForm> | undefined = $state();

  const threads = $derived(
    comments
      .filter((c) => !c.parentId)
      .map((c) => ({ ...c, replies: comments.filter((r) => r.parentId === c.id) })),
  );
  const count = $derived(comments.length);

  const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const when = (c: Comment) => (fresh.includes(c.id) ? 'Just now' : dateFmt.format(new Date(c.createdAt)));

  async function load() {
    loading = true;
    loadError = '';
    try {
      const service = await getCommentsService();
      comments = await service.list(postId);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') loadError = (e as Error).message || 'The notes could not be loaded.';
    } finally {
      loading = false;
    }
  }

  async function save(input: Parameters<ComponentSave>[0]) {
    const service = await getCommentsService();
    return service.create({ postId, ...input });
  }
  type ComponentSave = (input: { author: string; body: string; quote?: string; parentId?: string; website?: string }) => Promise<Comment>;

  async function added(c: Comment) {
    comments = [...comments, c];
    fresh = [...fresh, c.id];
    replyTo = null;
    await tick();
    document.getElementById(`note-${c.id}`)?.focus({ preventScroll: false });
  }

  onMount(() => {
    hydrated = true;
    load();
    return onQuote((text) => {
      quote = text;
      replyTo = null;
      tick().then(() => mainForm?.focusBody());
    });
  });
</script>

<div class="marginalia" aria-busy={loading}>
  <header class="marginalia__head">
    <h2 class="marginalia__title" id="marginalia-title">Marginalia</h2>
    <p class="marginalia__count label">
      {count === 0 ? 'No notes yet' : `${count} ${count === 1 ? 'note' : 'notes'}`}
    </p>
    <p class="marginalia__hint">
      Notes left by readers. Select any line of the {formName} to quote it in yours.
    </p>
  </header>

  <div class="marginalia__body">
    {#if loading && !comments.length}
      <p class="marginalia__state" role="status">
        <span class="ink-dots" aria-hidden="true"><i></i><i></i><i></i></span> Gathering notes…
      </p>
    {:else if loadError}
      <div class="marginalia__state marginalia__state--error" role="alert">
        <p>{loadError}</p>
        <button type="button" class="text-button" onclick={load}>Load notes again</button>
      </div>
    {/if}

    {#if !comments.length && !loading && !loadError}
      <div class="marginalia__empty">
        <p class="marginalia__empty-line">The margin is still empty.</p>
        <p>Be the first to write in it: a word, a question, the day you read this.</p>
      </div>
    {/if}

    {#if comments.length}
      <ol class="notes">
        {#each threads as c (c.id)}
          <li class="note" class:note--poet={c.byPoet} class:note--fresh={fresh.includes(c.id)}>
            <article id={`note-${c.id}`} tabindex="-1" aria-label={`Note from ${c.author}`}>
              <div class="note__meta">
                <p class="note__author">
                  {c.author}{#if c.byPoet}<span class="note__badge label">Poet</span>{/if}
                </p>
                <p class="label"><time datetime={c.createdAt}>{when(c)}</time></p>
              </div>
              <div class="note__content">
                {#if c.quote}
                  <blockquote class="note__quote"><p>{c.quote}</p></blockquote>
                {/if}
                <p class="note__text">{c.body}</p>
                {#if hydrated && replyTo !== c.id}
                  <button type="button" class="note__reply text-button" onclick={() => (replyTo = c.id)}>
                    Reply<span class="visually-hidden"> to {c.author}</span>
                  </button>
                {/if}
              </div>
            </article>

            {#if c.replies.length}
              <ol class="notes notes--replies">
                {#each c.replies as r (r.id)}
                  <li class="note note--reply" class:note--poet={r.byPoet} class:note--fresh={fresh.includes(r.id)}>
                    <article id={`note-${r.id}`} tabindex="-1" aria-label={`Reply from ${r.author}`}>
                      <div class="note__meta">
                        <p class="note__author">
                          {r.author}{#if r.byPoet}<span class="note__badge label">Poet</span>{/if}
                        </p>
                        <p class="label"><time datetime={r.createdAt}>{when(r)}</time></p>
                      </div>
                      <div class="note__content">
                        <p class="note__text">{r.body}</p>
                      </div>
                    </article>
                  </li>
                {/each}
              </ol>
            {/if}

            {#if replyTo === c.id}
              <div class="note__reply-form">
                <NoteForm {postId} parent={c} ready={hydrated} {save} onsaved={added} oncancel={() => (replyTo = null)} />
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    {#if loading && comments.length}
      <p class="marginalia__checking label" role="status">Checking for new notes…</p>
    {/if}

    <div class="marginalia__form" id="marginalia-form">
      <NoteForm bind:this={mainForm} {postId} bind:quote ready={hydrated} {save} onsaved={added} />
    </div>
  </div>
</div>

<style>
  .marginalia {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: full;
    row-gap: 2.5rem;
  }
  .marginalia__head {
    grid-column: margin;
    align-self: start;
  }
  .marginalia__body {
    grid-column: text;
    display: grid;
    gap: 2.5rem;
  }
  .marginalia__title {
    font-size: clamp(2rem, 1.4rem + 2vw, 3rem);
    font-weight: 330;
    font-style: italic;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .marginalia__count {
    margin-block-start: 0.9rem;
    color: var(--fg-2);
  }
  .marginalia__hint {
    margin-block-start: 0.9rem;
    font-size: var(--small);
    line-height: 1.55;
    color: var(--fg-2);
    max-width: 22rem;
  }
  .marginalia__state {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--fg-2);
    font-style: italic;
  }
  .marginalia__state--error {
    display: grid;
    justify-items: start;
    gap: 0.5rem;
    font-style: normal;
    color: var(--error);
  }
  .marginalia__checking {
    color: var(--fg-2);
  }
  .marginalia__empty {
    padding-block: 1rem;
    color: var(--fg-2);
  }
  .marginalia__empty-line {
    font-size: 1.5em;
    font-style: italic;
    font-weight: 330;
    color: var(--fg);
    margin-block-end: 0.35rem;
  }

  .notes {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 2.25rem;
  }
  .notes--replies {
    margin-block-start: 1.5rem;
    margin-inline-start: clamp(1rem, 4vw, 2.5rem);
    padding-inline-start: 1.25rem;
    border-inline-start: 1px solid var(--rule);
    gap: 1.5rem;
  }
  .note article {
    display: grid;
    gap: 0.5rem;
    border-radius: 2px;
  }
  .note article:focus-visible {
    outline-offset: 8px;
  }
  .note__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.9rem;
  }
  .note__meta .label {
    color: var(--fg-2);
  }
  .note__author {
    font-family: var(--mono);
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    font-weight: 500;
    font-variation-settings: normal;
  }
  .note__badge {
    margin-inline-start: 0.6rem;
    padding: 0.15rem 0.45rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 0.62rem;
  }
  .note__quote {
    padding-inline-start: 0.9rem;
    border-inline-start: 2px solid var(--rule);
    font-style: italic;
    color: var(--fg-2);
    font-size: 0.95em;
  }
  .note__text {
    white-space: pre-line;
    overflow-wrap: anywhere;
    font-size: 1.0625em;
    line-height: 1.6;
  }
  .note--reply .note__text {
    font-size: 1em;
  }
  .note--poet .note__text {
    font-style: italic;
  }
  .note__reply {
    justify-self: start;
    margin-inline-start: -0.25rem;
    min-height: 2.25rem;
  }

  /* a new note is written in wet ink and dries */
  .note--fresh .note__text {
    animation: note-dry 3.6s var(--ease-ink) both;
  }
  @keyframes note-dry {
    from {
      color: var(--accent);
      --soft: 100;
      filter: blur(0.6px);
    }
    35% {
      filter: blur(0);
    }
    to {
      color: var(--fg);
      --soft: 0;
    }
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

  @media (max-width: 47.99rem) {
    .marginalia__head,
    .marginalia__body {
      grid-column: text;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .note--fresh .note__text {
      animation: none;
    }
    .ink-dots i {
      animation: none;
    }
  }
</style>
