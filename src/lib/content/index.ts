// The content layer. Pages and components get everything from here.
//
//   getPosts()            all pieces, newest first
//   getPost(slug)         one piece, or undefined
//   getFeaturedPosts()    pieces marked `featured`
//   getAdjacentPosts()    previous / next piece for "turn the page"
//   getFacets()           forms and themes with counts, for the index filters
//   getAbout()            the About page
//
// Swap `source` for a CMS adapter and nothing else changes.

import { source, type PostRecord } from './source';
import { countWords, openingSentence, parseProse, parseVerse, segmentsToText } from './format';
import type { AboutPage, Facet, Post, PostBody, PostForm } from './types';

export type * from './types';

export const FORM_LABELS: Record<PostForm, string> = {
  poem: 'Poem',
  'prose-poem': 'Prose poem',
  essay: 'Essay',
  fragments: 'Fragments',
};

export const FORM_PLURALS: Record<PostForm, string> = {
  poem: 'Poems',
  'prose-poem': 'Prose poems',
  essay: 'Essays',
  fragments: 'Fragments',
};

export const themeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const isVerse = (form: PostForm) => form === 'poem' || form === 'fragments';

function toPost(r: PostRecord): Post {
  let body: PostBody;
  let firstLine: string;
  let excerpt: string[];
  let measure: string;
  const words = countWords(r.body.replace(/^##.*$/gm, ''));

  if (isVerse(r.form)) {
    const verse = parseVerse(r.body);
    body = { kind: 'verse', ...verse };
    const lines = verse.blocks.flatMap((b) => (b.type === 'stanza' ? b.lines : []));
    firstLine = lines[0]?.text.trim() ?? '';
    excerpt = lines.slice(0, 2).map((l) => l.text.trim());
    measure = `${verse.lineCount} ${verse.lineCount === 1 ? 'line' : 'lines'}`;
  } else {
    const blocks = parseProse(r.body);
    body = { kind: 'prose', blocks };
    const first = blocks.find((b) => b.type === 'paragraph');
    const text = first?.type === 'paragraph' ? segmentsToText(first.segments) : '';
    const opening = openingSentence(text);
    firstLine = openingSentence(text, 64);
    excerpt = [opening];
    measure = `${Math.max(1, Math.round(words / 200))} min read`;
  }

  return {
    slug: r.slug,
    url: `/writing/${r.slug}/`,
    title: r.title,
    form: r.form,
    formLabel: FORM_LABELS[r.form],
    date: r.date,
    themes: r.themes,
    featured: r.featured,
    description: r.description ?? excerpt.join(' '),
    epigraph: r.epigraph,
    firstLine,
    excerpt,
    body,
    words,
    measure,
    inkStudy: r.inkStudy,
    placeholder: r.placeholder,
  };
}

let cache: Promise<Post[]> | undefined;

export function getPosts(): Promise<Post[]> {
  cache ??= source.posts().then((records) => records.map(toPost).sort((a, b) => b.date.getTime() - a.date.getTime()));
  return cache;
}

export async function getPost(slug: string): Promise<Post | undefined> {
  return (await getPosts()).find((p) => p.slug === slug);
}

export async function getFeaturedPosts(): Promise<Post[]> {
  return (await getPosts()).filter((p) => p.featured);
}

/**
 * Reading order for "turn the page": `next` is the next older piece (wrapping to the
 * newest after the oldest), `previous` the next newer one.
 */
export async function getAdjacentPosts(slug: string): Promise<{ previous?: Post; next?: Post }> {
  const posts = await getPosts();
  const i = posts.findIndex((p) => p.slug === slug);
  if (i < 0 || posts.length < 2) return {};
  return { previous: posts[i - 1], next: posts[(i + 1) % posts.length] };
}

export async function getFacets(): Promise<{ forms: Facet[]; themes: Facet[] }> {
  const posts = await getPosts();
  const count = (values: string[]) =>
    values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>());
  const forms = [...count(posts.map((p) => p.form))].map(([value, n]) => ({
    value,
    label: FORM_PLURALS[value as PostForm],
    count: n,
  }));
  const order: PostForm[] = ['poem', 'prose-poem', 'fragments', 'essay'];
  forms.sort((a, b) => order.indexOf(a.value as PostForm) - order.indexOf(b.value as PostForm));
  const themes = [...count(posts.flatMap((p) => p.themes))]
    .map(([value, n]) => ({ value, label: themeLabel(value), count: n }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { forms, themes };
}

export async function getAbout(): Promise<AboutPage> {
  const r = await source.about();
  const chapters: AboutPage['chapters'] = [];
  for (const block of parseProse(r.body)) {
    if (block.type === 'heading') chapters.push({ heading: block.text, paragraphs: [] });
    else if (block.type === 'paragraph') {
      if (!chapters.length) chapters.push({ heading: '', paragraphs: [] });
      chapters[chapters.length - 1].paragraphs.push(block.segments);
    }
  }
  return {
    title: r.title,
    description: r.description,
    lede: r.lede,
    glimpse: r.glimpse ?? r.description,
    pullQuote: r.pullQuote,
    image: r.image,
    imageNote: r.imageNote,
    chapters,
    placeholder: r.placeholder,
  };
}
