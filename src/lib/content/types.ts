// The shapes every page and component works with. A CMS adapter only has to
// produce these; nothing in src/components or src/pages knows where they came from.

import type { ImageMetadata } from 'astro';

export type PostForm = 'poem' | 'prose-poem' | 'essay' | 'fragments';

/** A run of inline text. `space` marks a run of 2+ spaces inside a line (a caesura). */
export type Segment =
  | { kind: 'text'; text: string; em?: boolean; strong?: boolean }
  | { kind: 'space'; width: number; text: string };

export interface VerseLine {
  /** Number of leading spaces in the source (tabs count as 4). */
  indent: number;
  /** The leading whitespace exactly as written, kept so copying returns the original. */
  lead: string;
  segments: Segment[];
  /** 1-based line number across the whole poem (headings are not counted). */
  n: number;
  text: string;
}

export type VerseBlock =
  | { type: 'stanza'; lines: VerseLine[]; /** blank lines before this stanza in the source */ gap: number }
  | { type: 'heading'; text: string };

export type ProseBlock =
  | { type: 'paragraph'; segments: Segment[] }
  | { type: 'heading'; text: string }
  | { type: 'break' };

export type PostBody =
  | { kind: 'verse'; blocks: VerseBlock[]; lineCount: number; maxIndent: number }
  | { kind: 'prose'; blocks: ProseBlock[] };

/** A local (build-processed) image or a remote one with known dimensions. */
export interface ImageAsset {
  src: ImageMetadata | string;
  width: number;
  height: number;
  alt: string;
  /** Absolute path of a local source file, when there is one (used for share images). */
  file?: string;
}

export interface Post {
  slug: string;
  url: string;
  title: string;
  form: PostForm;
  formLabel: string;
  date: Date;
  themes: string[];
  featured: boolean;
  description: string;
  epigraph?: string;
  /** First line as plain text, for the index of first lines. */
  firstLine: string;
  /** Up to two opening lines (verse) or an opening sentence (prose), plain text. */
  excerpt: string[];
  body: PostBody;
  words: number;
  /** "14 lines" for verse, "3 min read" for prose. */
  measure: string;
  inkStudy?: ImageAsset;
  placeholder: boolean;
}

export interface AboutChapter {
  heading: string;
  paragraphs: Segment[][];
}

export interface AboutPage {
  title: string;
  description: string;
  lede: string;
  glimpse: string;
  pullQuote?: string;
  image?: ImageAsset;
  imageNote?: string;
  chapters: AboutChapter[];
  placeholder: boolean;
}

export interface Facet {
  value: string;
  label: string;
  count: number;
}
