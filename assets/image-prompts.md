# Image prompts

Every generated image on the site, with the exact prompt used. Images are generated with
Codex CLI's built-in `$imagegen` skill and saved, untouched, to `assets/source/`. The site
never uses those files directly: `npm run images:optimize` derives what it needs (the tiled
paper texture, the ink-edge mask, the ink studies with their paper levelled to white, the
artwork as WebP), and Astro turns those into responsive AVIF/WebP at build time.

Regenerate one or more images:

```bash
node scripts/generate-images.mjs ink-iron-gall ink-insomnia
```

Regenerate all of them (uses Codex usage, roughly one generation per image):

```bash
node scripts/generate-images.mjs --all
```

The script reads this file. Each image is a `##` heading with the file name and size,
followed by one fenced `prompt` block. `{{INK_STUDY}}` expands to the shared ink-study
style block below, so the set stays consistent. After regenerating, run
`npm run images:optimize` to rebuild the derived files.

The Codex model defaults to `gpt-6-astra`; override it with `CODEX_MODEL=...`.

## Shared style: INK_STUDY

```style
Top-down flatbed scan of a single ink-wash study on pale lilac-grey cotton blotting paper (close to #E4E2E8), the paper filling the whole frame. The ink is iron-gall ink: its darkest pools are a deep violet-black (close to #1C1A24), thinning at the wet edges into translucent blue-violet (close to #4E49B0), with feathered capillary bleeding along the paper fibres, darker tide-lines where the ink dried at its edges, and faint pigment granulation. Generous empty paper around the mark. No text, no letters, no signature, no objects, no frame, no border, no shadows, no vignette, even lighting. Abstract, quiet, museum-quality.
```

## paper-raw.png (1024x1024)

```prompt
Generate a perfectly flat, evenly lit, top-down macro scan of a sheet of soft cotton blotting paper in a pale, cool lilac-grey colour (close to #E4E2E8). Only the paper fills the frame: visible soft felted cotton fibres, very subtle mottling, gentle tooth, no objects, no ink, no text, no shadows, no folds, no vignette, no lighting gradient, uniform texture edge to edge so it can be tiled.
```

## ink-edge-raw.png (1536x1024)

```prompt
Generate a high-contrast scan of pure black ink that has soaked into the lower half of a sheet of pure white blotting paper. The ink fills the bottom half completely and solidly. Its top edge runs across the full width of the image as a soft, slowly undulating line with broad rounded bays and gentle swells, softly feathered where the ink wicked into the fibres, like a tide-line of ink on blotting paper. Not spiky, not fractal, not tree-like, no splashes, no splatter, no drops. Pure black on pure white, no grey paper texture, no colour, no shadows, no text, no vignette. The edge sits roughly in the vertical middle of the image.
```

## ink-iron-gall.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: a single long brushstroke laid diagonally from lower left to upper right, its upper end still wet and pale blue-violet, its lower end fully darkened to violet-black, as if the ink were drying along its length.
```

## ink-what-the-sea-gives-back.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: a low horizontal wash across the lower third, like the line a wave leaves on sand, with small pale salt blooms (crystalline, star-shaped bursts where salt lifted the ink) scattered through it.
```

## ink-inventory-of-a-small-house.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: five small separate ink pools of different sizes arranged loosely in a vertical column down the centre, like rooms seen from above, joined by thin capillary threads of ink.
```

## ink-the-night-bus.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: a long horizontal band of dark ink across the middle, with a row of small soft round pale spots inside it where drops of water lifted the ink, like lit windows passing in the dark.
```

## ink-on-leaving-a-word-out.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: a short, confident horizontal brushstroke across the centre with one clean gap in the middle where the brush lifted off the paper, leaving a white space between the two halves.
```

## ink-fragments-from-a-winter-notebook.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: nine small scattered ink drops of very different sizes spread loosely across the sheet, some barely touching the paper, some with small tide-line rings, like flakes of snow or footnotes.
```

## ink-rain-descending.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: a cascade of ink drips running diagonally down from the upper left to the lower right, each drop a little smaller than the last, trailing thin wet lines between them, like rain stepping down a window.
```

## ink-instructions-for-keeping-a-lamp.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: one round, soft-edged bloom in the centre with a pale glowing core where water lifted the ink, so it reads like the halo of a lamp seen through mist.
```

## ink-things-i-have-mistaken-for-birds.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: a loose splash from a single central point that only suggests, never depicts, something taking flight: two wing-like sprays of ink flung outward, with a few flying droplets. It must not be a literal drawing of a bird.
```

## ink-insomnia.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: a single very small, very dark ink dot in the upper third of the sheet, surrounded by a faint, wide ring of pale tide-line where water spread and dried. Mostly empty paper.
```

## ink-letter-to-the-woman-who-lived-here-before.png (1024x1024)

```prompt
Generate an ink study. {{INK_STUDY}} The mark: a pale, faded blot offset, as if a handwritten letter had been pressed onto the blotter: five or six short horizontal rows of soft, mirrored, blurred loops and dashes, impossible to read as words, fading towards the bottom.
```

## still-window.png (1024x1536)

```prompt
Generate a figurative ink-wash painting, portrait format, in iron-gall ink on pale lilac-grey cotton blotting paper (close to #E4E2E8). Subject: an open window seen from inside a quiet room at dawn, a thin curtain lifting in the draught, a small glass inkwell and a closed notebook on the sill. Painted with very few brushstrokes and a lot of untouched paper: deep violet-black (close to #1C1A24) in the darkest strokes, translucent blue-violet (close to #4E49B0) washes, feathered edges bleeding into the fibres, dried tide-lines. No people, no text, no signature, no border, no frame, even lighting, no vignette.
```
