// Turns a raw post body into structured blocks.
//
// Verse is never run through Markdown: every line, blank line and leading space
// is kept. The only markup is *italic* and **bold**, and `## ` for a section heading.
// Prose: paragraphs separated by blank lines, `* * *` for a section break.

import type { ProseBlock, Segment, VerseBlock, VerseLine } from './types';

const TAB = '    ';

function normalise(raw: string): string[] {
  return raw.replace(/\r\n?/g, '\n').replace(/\t/g, TAB).split('\n');
}

/** Straight quotes to typographic ones: ’ for apostrophes, ‘ ’ and “ ” around quotations. */
export function smartQuotes(text: string): string {
  return text
    .replace(/(^|[\s(\[{—–-])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/(^|[\s(\[{—–-])"/g, '$1“')
    .replace(/"/g, '”');
}

/** Inline parser: **bold**, *italic*, and (in verse) runs of 2+ spaces. */
export function parseInline(input: string, keepSpaces = false): Segment[] {
  const out: Segment[] = [];
  const re = keepSpaces ? /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*| {2,})/g : /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  for (const m of input.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: 'text', text: smartQuotes(input.slice(last, i)) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ kind: 'text', text: smartQuotes(tok.slice(2, -2)), strong: true });
    else if (tok.startsWith('*')) out.push({ kind: 'text', text: smartQuotes(tok.slice(1, -1)), em: true });
    else out.push({ kind: 'space', width: tok.length, text: tok });
    last = i + tok.length;
  }
  if (last < input.length) out.push({ kind: 'text', text: smartQuotes(input.slice(last)) });
  return out;
}

export function segmentsToText(segments: Segment[]): string {
  return segments.map((s) => s.text).join('');
}

export function parseVerse(raw: string): { blocks: VerseBlock[]; lineCount: number; maxIndent: number } {
  const blocks: VerseBlock[] = [];
  let stanza: VerseLine[] | null = null;
  let blanks = 0;
  let n = 0;
  let maxIndent = 0;

  for (const rawLine of normalise(raw)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line) {
      stanza = null;
      blanks++;
      continue;
    }
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] });
      stanza = null;
      blanks = 0;
      continue;
    }
    if (!stanza) {
      // The gap before a stanza is the number of blank lines the poet left (at least one),
      // except at the very top or directly under a section heading.
      const prev = blocks[blocks.length - 1];
      stanza = [];
      blocks.push({ type: 'stanza', lines: stanza, gap: prev?.type === 'stanza' ? Math.max(blanks, 1) : 0 });
    }
    blanks = 0;
    const lead = line.match(/^ */)?.[0] ?? '';
    const segments = parseInline(line.slice(lead.length), true);
    maxIndent = Math.max(maxIndent, lead.length);
    stanza.push({ indent: lead.length, lead, segments, n: ++n, text: segmentsToText(segments) });
  }
  return { blocks, lineCount: n, maxIndent };
}

export function parseProse(raw: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  const paragraphs = raw.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
  for (const p of paragraphs) {
    const text = p.trim();
    if (/^(\* ?){3,}$|^-{3,}$/.test(text)) {
      blocks.push({ type: 'break' });
      continue;
    }
    const heading = text.match(/^##\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] });
      continue;
    }
    blocks.push({ type: 'paragraph', segments: parseInline(text.replace(/\s*\n\s*/g, ' ')) });
  }
  return blocks;
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}’']+/gu) ?? []).length;
}

/** First sentence of a prose text, shortened to a readable length. */
export function openingSentence(text: string, max = 150): string {
  const plain = text.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  const sentence = plain.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? plain;
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
