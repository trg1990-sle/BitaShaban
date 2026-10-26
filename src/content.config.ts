// Content collections: the local source behind src/lib/content/.
// Components never import from here directly; see src/lib/content/index.ts.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  // Raw bodies are parsed by src/lib/content/format.ts, not by Markdown,
  // so that line breaks and leading spaces survive exactly.
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    form: z.enum(['poem', 'prose-poem', 'essay', 'fragments']),
    date: z.coerce.date(),
    themes: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    /** Short description for search engines and share cards. */
    description: z.string().optional(),
    /** File name (without .png) of the ink study in src/assets/images. */
    inkStudy: z.string().optional(),
    /** Optional dedication or epigraph, shown under the title. */
    epigraph: z.string().optional(),
    /** true while this is placeholder writing, not Bita's own. */
    placeholder: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Large opening line of the page. */
    lede: z.string(),
    /** A few sentences used on the home page to lead into the full page. */
    glimpse: z.string().optional(),
    pullQuote: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageNote: z.string().optional(),
    placeholder: z.boolean().default(false),
  }),
});

export const collections = { posts, pages };
