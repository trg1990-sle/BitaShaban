// The local content source: Markdown files in src/content, images in src/assets/images.
//
// To connect a CMS, write another module that exports the same `source` object
// (raw records in, nothing about design) and change the import in ./index.ts.

import { getCollection } from 'astro:content';
import type { ImageMetadata } from 'astro';
import type { ImageAsset, PostForm } from './types';

export interface PostRecord {
  slug: string;
  title: string;
  form: PostForm;
  date: Date;
  themes: string[];
  featured: boolean;
  description?: string;
  epigraph?: string;
  /** Raw body text, exactly as written. */
  body: string;
  inkStudy?: ImageAsset;
  placeholder: boolean;
}

export interface AboutRecord {
  title: string;
  description: string;
  lede: string;
  glimpse?: string;
  pullQuote?: string;
  image?: ImageAsset;
  imageNote?: string;
  /** Raw body: `## Heading` lines followed by paragraphs. */
  body: string;
  placeholder: boolean;
}

export interface ContentSource {
  posts(): Promise<PostRecord[]>;
  about(): Promise<AboutRecord>;
}

// Derived images only (see scripts/prepare-images.mjs); raw scans live in assets/source.
const images = import.meta.glob<{ default: ImageMetadata }>(
  ['/src/assets/studies/*.{png,jpg,jpeg,webp}', '/src/assets/images/*.{png,jpg,jpeg,webp}'],
  { eager: true },
);

export function localImage(key: string | undefined, alt: string): ImageAsset | undefined {
  if (!key) return undefined;
  const mod = Object.entries(images).find(([file]) => /\/[^/]+$/.exec(file)?.[0].replace(/\.\w+$/, '') === `/${key}`);
  if (!mod) return undefined;
  const meta = mod[1].default;
  return { src: meta, width: meta.width, height: meta.height, alt, file: `${process.cwd()}${mod[0]}` };
}

export const source: ContentSource = {
  async posts() {
    const entries = await getCollection('posts');
    return entries.map(({ id, data, body }) => ({
      slug: id,
      title: data.title,
      form: data.form,
      date: data.date,
      themes: data.themes,
      featured: data.featured,
      description: data.description,
      epigraph: data.epigraph,
      body: body ?? '',
      // Ink studies are abstract; they carry no information, so their alt text is empty.
      inkStudy: localImage(data.inkStudy, ''),
      placeholder: data.placeholder,
    }));
  },

  async about() {
    const [entry] = (await getCollection('pages')).filter((p) => p.id === 'about');
    if (!entry) throw new Error('Missing src/content/pages/about.md');
    const d = entry.data;
    return {
      title: d.title,
      description: d.description,
      lede: d.lede,
      glimpse: d.glimpse,
      pullQuote: d.pullQuote,
      image: localImage(d.image, d.imageAlt ?? ''),
      imageNote: d.imageNote,
      body: entry.body ?? '',
      placeholder: d.placeholder,
    };
  },
};
