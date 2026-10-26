// Small HTML builders for text whose whitespace must survive exactly.
// Astro templates add or collapse whitespace between tags, so verse lines are
// assembled as strings and inserted with set:html.

import type { Segment, VerseLine } from './content/types';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

export function segmentsHtml(segments: Segment[]): string {
  return segments
    .map((s) => {
      if (s.kind === 'space') return `<span class="sp" style="--w:${s.width}">${s.text}</span>`;
      const t = escapeHtml(s.text);
      if (s.strong) return `<strong>${t}</strong>`;
      if (s.em) return `<em>${t}</em>`;
      return t;
    })
    .join('');
}

export function verseLineHtml(line: VerseLine): string {
  const lead = line.lead ? `<span class="line__lead">${line.lead}</span>` : '';
  return `<span class="line" data-n="${line.n}" style="--i:${line.indent}">${lead}${segmentsHtml(line.segments)}</span>`;
}

export const formatDate = (d: Date, style: 'long' | 'short' = 'long') =>
  new Intl.DateTimeFormat('en-GB', {
    day: style === 'long' ? 'numeric' : undefined,
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
