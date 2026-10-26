// Tiles review screenshots into one image for quick inspection (dev helper).
//   node scripts/contact-sheet.mjs <out.jpg> <cols> <tileWidth> <files...>
import sharp from 'sharp';
const [out, cols, tw, ...files] = process.argv.slice(2);
const C = Number(cols), W = Number(tw);
const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
const H = Math.round((metas[0].height / metas[0].width) * W);
const comps = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(W, H).toBuffer(), left: (i % C) * W, top: Math.floor(i / C) * H })));
await sharp({ create: { width: W * C, height: H * Math.ceil(files.length / C), channels: 3, background: '#fff' } }).composite(comps).jpeg({ quality: 80 }).toFile(out);
