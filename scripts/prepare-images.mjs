#!/usr/bin/env node
// Builds the derived textures from the generated source images.
//
//   src/assets/images/paper-raw.png    -> public/textures/paper.webp     (seamless, grey-centred grain)
//   src/assets/images/ink-edge-raw.png -> public/textures/ink-edge.png   (alpha mask, tiles horizontally)
//
//   src/assets/images/ink-*.png        -> src/assets/studies/ink-*.png  (paper levelled to white)
//
// Run after regenerating any source image: npm run images:optimize

import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => path.join(root, 'assets/source', f);
const out = (f) => path.join(root, 'public/textures', f);
await mkdir(path.join(root, 'public/textures'), { recursive: true });

// Paper: keep only the fibre detail (high-pass), centred on mid-grey so it can be
// blended with `overlay` over any background colour, then made seamless by
// cross-fading the image with a copy of itself offset by half a tile.
{
  const size = 640;
  const base = sharp(src('paper-raw.png')).resize(size, size).greyscale();
  const a = await base.clone().raw().toBuffer();
  const blur = await base.clone().blur(24).raw().toBuffer();
  const detail = new Float32Array(size * size);
  for (let i = 0; i < detail.length; i++) detail[i] = a[i] - blur[i];

  const tile = Buffer.alloc(size * size);
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const j = ((y + h) % size) * size + ((x + h) % size);
      // weight 1 at the centre (original), 0 at the edges (offset copy, which is continuous there)
      const w = Math.sin((Math.PI * x) / size) * Math.sin((Math.PI * y) / size);
      const v = detail[i] * w + detail[j] * (1 - w);
      // Blending two images lowers contrast in the middle band; compensate a little.
      const gain = 2.2 / Math.sqrt(w * w + (1 - w) * (1 - w));
      tile[i] = Math.max(0, Math.min(255, Math.round(128 + v * gain)));
    }
  }
  await sharp(tile, { raw: { width: size, height: size, channels: 1 } })
    .webp({ quality: 82 })
    .toFile(out('paper.webp'));
  console.log('public/textures/paper.webp');
}

// Ink edge: black ink -> opaque, paper -> transparent. Cropped to the band around the
// edge and mirrored so it repeats horizontally without a seam.
{
  const img = sharp(src('ink-edge-raw.png')).greyscale();
  const { width, height } = await img.metadata();
  const band = { left: 0, top: Math.round(height * 0.12), width, height: Math.round(height * 0.5) };
  const W = 1200;
  const H = Math.round((band.height / band.width) * W);
  const grey = await img.extract(band).resize(W, H).raw().toBuffer();
  // levels: everything darker than ~35% is solid ink
  const alpha = Buffer.alloc(W * H);
  for (let i = 0; i < grey.length; i++) alpha[i] = Math.max(0, Math.min(255, Math.round(((235 - grey[i]) / 150) * 255)));
  const mirrored = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
    .flop()
    .extractChannel(0)
    .raw()
    .toBuffer();
  const strip = Buffer.alloc(W * 2 * H * 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W * 2 + x) * 2;
      strip[o + 1] = alpha[y * W + x];
      const o2 = (y * W * 2 + W + x) * 2;
      strip[o2 + 1] = mirrored[y * W + x];
    }
  }
  await sharp(strip, { raw: { width: W * 2, height: H, channels: 2 } })
    .resize(W, Math.round(H / 2))
    .png({ compressionLevel: 9, palette: false })
    .toFile(out('ink-edge.png'));
  console.log('public/textures/ink-edge.png');
}

// Ink studies: level each scan so its paper becomes pure white. On the site they are
// multiplied onto the blotter (and screened, inverted, at night), so white paper vanishes
// and only the ink remains, whatever the tone of the original scan.
{
  await mkdir(path.join(root, 'src/assets/studies'), { recursive: true });
  const files = (await readdir(path.join(root, 'assets/source'))).filter((f) => /^ink-(?!edge).*\.png$/.test(f));
  for (const f of files) {
    const img = sharp(src(f)).removeAlpha();
    const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
    // paper colour: a high percentile of each channel
    const level = [0, 1, 2].map((c) => {
      const hist = new Uint32Array(256);
      for (let i = c; i < data.length; i += 3) hist[data[i]]++;
      let acc = 0;
      const target = (data.length / 3) * 0.8;
      for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= target) return v;
      return 255;
    });
    const out = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      const v = Math.min(1, data[i] / (level[i % 3] - 4));
      out[i] = Math.round(255 * Math.pow(v, 1.15));
    }
    await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
      .webp({ quality: 90 })
      .toFile(path.join(root, 'src/assets/studies', f.replace(/\.png$/, '.webp')));
  }
  console.log(`src/assets/studies/ (${files.length} studies levelled)`);
}

// Figurative artwork: a high-quality WebP master for Astro to resize.
{
  await mkdir(path.join(root, 'src/assets/images'), { recursive: true });
  await sharp(src('still-window.png')).webp({ quality: 90 }).toFile(path.join(root, 'src/assets/images/still-window.webp'));
  console.log('src/assets/images/still-window.webp');
}

// Icons: an ink blot on the blotter. favicon.svg follows the colour scheme.
{
  const { writeFile } = await import('node:fs/promises');
  const blot =
    'M33.4 9.6c11.2.9 21.6 9.4 21.9 21.5.3 13-9.6 24.5-22.4 24.6C20.6 55.9 9.9 46.6 10 33.6 10.1 19.9 21.3 8.6 33.4 9.6z';
  const dots = '<circle cx="53" cy="12" r="2.6"/><circle cx="8.5" cy="52" r="2"/><circle cx="57" cy="47" r="1.6"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>path,circle{fill:#1c1a24}@media (prefers-color-scheme:dark){path,circle{fill:#e4e2e8}}</style><path d="${blot}"/>${dots}</svg>\n`;
  await writeFile(path.join(root, 'public/favicon.svg'), svg);

  const tile = (size, pad) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e4e2e8"/><g transform="translate(${pad} ${pad}) scale(${(64 - 2 * pad) / 64})" fill="#1c1a24"><path d="${blot}"/>${dots}</g></svg>`,
    );
  await sharp(tile(180, 8)).png().toFile(path.join(root, 'public/apple-touch-icon.png'));
  await sharp(tile(192, 10)).png().toFile(path.join(root, 'public/icon-192.png'));
  await sharp(tile(512, 10)).png().toFile(path.join(root, 'public/icon-512.png'));

  // favicon.ico holding a single 32×32 PNG
  const png = await sharp(tile(32, 4)).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(32, 6);
  header.writeUInt8(32, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile(path.join(root, 'public/favicon.ico'), Buffer.concat([header, png]));

  const manifest = {
    name: 'Bita Shaban',
    short_name: 'Bita Shaban',
    description: 'Poems, prose poems and fragments.',
    start_url: '/',
    display: 'minimal-ui',
    background_color: '#e4e2e8',
    theme_color: '#e4e2e8',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  await writeFile(path.join(root, 'public/site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('public/favicon.svg, favicon.ico, apple-touch-icon.png, icon-192/512.png, site.webmanifest');
}
