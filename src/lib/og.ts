// Share images (1200×630), rendered at build time with Satori + resvg:
// the title set in Fraunces on the blotter, with the piece's ink study beside it.

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const W = 1200;
const H = 630;
const C = { paper: '#e4e2e8', ink: '#1c1a24', faded: '#5c586a', wet: '#4e49b0' };

const fontFile = (pkg: string, file: string) => readFile(path.join(process.cwd(), 'node_modules', pkg, 'files', file));

let fonts: Promise<Parameters<typeof satori>[1]['fonts']> | undefined;
function loadFonts() {
  fonts ??= Promise.all([
    fontFile('@fontsource/fraunces', 'fraunces-latin-300-normal.woff'),
    fontFile('@fontsource/fraunces', 'fraunces-latin-300-italic.woff'),
    fontFile('@fontsource/dm-mono', 'dm-mono-latin-400-normal.woff'),
  ]).then(([serif, serifItalic, mono]) => [
    { name: 'Fraunces', data: serif, weight: 300 as const, style: 'normal' as const },
    { name: 'Fraunces', data: serifItalic, weight: 300 as const, style: 'italic' as const },
    { name: 'DM Mono', data: mono, weight: 400 as const, style: 'normal' as const },
  ]);
  return fonts;
}

async function studyDataUrl(file?: string) {
  if (!file) return undefined;
  // Studies have white paper; multiplied onto the card colour, only the ink remains.
  const S = 640;
  const study = await sharp(file).resize(S, S).removeAlpha().png().toBuffer();
  const buf = await sharp({ create: { width: S, height: S, channels: 3, background: C.paper } })
    .composite([{ input: study, blend: 'multiply' }])
    .jpeg({ quality: 86 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

export interface OgInput {
  title: string;
  kicker: string;
  line?: string;
  studyFile?: string;
  /** The home/default card sets the name huge instead of a title. */
  variant?: 'piece' | 'name';
}

export async function renderOg({ title, kicker, line, studyFile, variant = 'piece' }: OgInput): Promise<Buffer> {
  const study = await studyDataUrl(studyFile);
  const size = variant === 'name' ? 150 : title.length <= 16 ? 112 : title.length <= 30 ? 88 : 70;

  const tree = el(
    'div',
    { width: W, height: H, display: 'flex', position: 'relative', background: C.paper, fontFamily: 'Fraunces', color: C.ink },
    [
      study &&
        el('img', { position: 'absolute', right: -40, top: -5, width: 640, height: 640 }, undefined, {
          src: study,
          width: 640,
          height: 640,
        }),
      el(
        'div',
        {
          position: 'absolute',
          left: 72,
          top: 64,
          bottom: 60,
          width: variant === 'name' ? 900 : 700,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
        [
          el('div', { display: 'flex', flexDirection: 'column' }, [
            el('div', { fontFamily: 'DM Mono', fontSize: 20, letterSpacing: 2.4, color: C.faded, textTransform: 'uppercase' }, kicker),
            el(
              'div',
              { marginTop: 34, fontSize: size, lineHeight: 0.98, letterSpacing: -size * 0.025, fontWeight: 300 },
              title,
            ),
            line
              ? el('div', { marginTop: 30, fontSize: 30, fontStyle: 'italic', color: C.faded, lineHeight: 1.3 }, line)
              : null,
          ]),
          el('div', { display: 'flex', alignItems: 'baseline', gap: 22 }, [
            variant === 'piece' ? el('div', { fontSize: 34, fontStyle: 'italic' }, 'Bita Shaban') : null,
            el('div', { fontFamily: 'DM Mono', fontSize: 19, letterSpacing: 2, color: C.faded }, 'BITASHABAN.COM'),
          ]),
        ],
      ),
    ],
  );

  const svg = await satori(tree as never, { width: W, height: H, fonts: await loadFonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}
