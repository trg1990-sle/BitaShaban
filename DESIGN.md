# Wet Ink — design notes for bitashaban.com

## The idea

Everything on this site has only just been written.

The page is blotting paper: it drinks ink. Poems arrive wet and dry as you read them.
Your pointer (or finger) leaves ink that blooms into the paper and fades. When you
turn a page, ink floods the sheet and drains away to show the next one. Readers leave
notes in the margin of each poem in fresh ink that dries as it is saved.

The idea comes from iron-gall ink, the ink of most handwritten poetry for a thousand
years. It goes onto the page a pale blue-violet and darkens to near-black as it
oxidises. That change, wet to dry, is the site's one big gesture. It sets the palette
(the life of that ink on a blotter), the typography (a variable serif whose softness
axis is animated from "wet" to "dry"), the motion (bloom, settle, dry) and the
comments (fresh violet notes that darken).

Everything else stays quiet. The poems are the reason the site exists, so the reading
column never moves once a poem has arrived, and every effect works in the margins,
the gaps between sections, and the moments between pages.

## Art direction

- **Material:** cotton blotting paper (a generated, tiled texture) under live WebGL ink.
- **Not cream, not black-and-acid:** the ground is a cool lilac-grey blotter; the
  dark sections are the inside of an inkwell, a violet-black.
- **One structural device:** the notebook margin. A single vertical rule separates
  the margin (metadata, marginalia, ink studies) from the reading column. It is
  where readers' notes live, so it means something.
- **Imagery:** "ink studies", one generated ink-wash bloom per piece, like a blot
  the poet left beside it. They appear as previews in the index, beside the title on
  each piece, and on its share image. No stock photos, no fake portrait of the poet.
- **Restraint:** no card grids, no hairline-ruled broadsheet columns, no gradients.
  Numbering appears only where order is real (the alphabet in the index of first
  lines, line numbers in long poems).

## Colour

| Name           | Light (Paper) | Night     | Use                                      |
| -------------- | ------------- | --------- | ---------------------------------------- |
| Blotter        | `#E4E2E8`     | `#121019` | page ground                              |
| Blotter shade  | `#D6D3DD`     | `#1D1A27` | fields, quiet surfaces, the margin rule  |
| Gall black     | `#1C1A24`     | `#E4E2E8` | text: dried ink                          |
| Faded gall     | `#5C586A`     | `#A29FB3` | secondary text (5.2:1 / 7.1:1)           |
| Wet gall       | `#4E49B0`     | `#9C97F0` | fresh ink: focus, links, readers' notes (5.6:1 / 7.2:1) |
| Inkwell        | `#15121D`     | `#1E1A3A` | the flooded "night" sections             |
| Red pen        | `#A1283B`     | `#F07A8A` | form errors only                         |

The theme toggle is called **Paper / Night**. Night follows `prefers-color-scheme`
until the reader chooses.

## Typography

- **Fraunces** (variable: `opsz` 9–144, `wght`, `SOFT` 0–100, `WONK`) for display and
  for the poems themselves. Its `SOFT` axis rounds every terminal as if the ink has
  spread. Text is set at `SOFT 0`; it arrives at `SOFT 100`, heavier and blurred, and
  dries. Optical sizing gives one family a true display cut (opsz 144, light) and a
  sturdy text cut (opsz ~20), so the page reads as one voice.
- **DM Mono** for the utility layer: labels, metadata, form labels, buttons. Small,
  uppercase, tracked. It is the typewritten label on the archive box, never the voice.

Scale (fluid):

| Role          | Size                                 | Notes                        |
| ------------- | ------------------------------------ | ---------------------------- |
| Name (hero)   | `clamp(4.5rem, 17vw, 16rem)`         | opsz 144, wght 300           |
| Page title    | `clamp(3rem, 10vw, 9rem)`            | opsz 144, wght 320           |
| Piece title   | `clamp(2.4rem, 6.4vw, 5.75rem)`      | opsz 144, wght 340           |
| List title    | `clamp(1.9rem, 4.6vw, 4rem)`         |                              |
| Poem / prose  | `clamp(1.125rem, 0.95rem + 0.55vw, 1.375rem)` | lh 1.62 / 1.72      |
| Label         | `0.72rem` DM Mono, +0.09em, caps     |                              |

### Verse rules

Line breaks, indentation and spacing are content, not style:

- Every line is its own element; stanzas are separated by real gaps.
- Leading spaces become a measured indent (0.5em per space) so an indented line is
  clearly indented in a proportional face; the spaces stay in the DOM, so copying a
  poem gives back the original text.
- Runs of spaces inside a line keep their width (a caesura stays a caesura).
- A line too long for a phone wraps with a hanging indent, the convention in printed
  poetry, so a wrapped turnover is never mistaken for a new line.
- Prose poems are set as justified blocks with hyphenation; essays are ragged-right.

## Layout

```
HOME
┌──────────────────────────────────────────────────────────┐
│ Bita Shaban                  Writing   About   Paper/Night│
│                                                          │
│   Bita                                 ·  (a drop falls) │
│          Shaban                      ( ink blooms )      │
│                                                          │
│   Poems, prose poems and fragments.   "first line…" →    │
├──────────────────────────────────────────────────────────┤
│            one short poem, alone on the page             │
│            its lines dry as they arrive                  │
├~~~~~~~~~~~~~~~~ ink floods the page (night) ~~~~~~~~~~~~~┤
│   Selected writing                                       │
│   Title of a piece ....................  Poem · 14 lines │
│      its first line, in italic           (ink study ↗)   │
│   …                                                      │
├~~~~~~~~~~~~~~~~ ink drains (morning) ~~~~~~~~~~~~~~~~~~~~┤
│   [still life]   A few lines of her story…               │
│                  Read her story →                        │
├──────────────────────────────────────────────────────────┤
│   Notes from readers, closing line, nav, RSS             │
└──────────────────────────────────────────────────────────┘

A PIECE                       WRITING (index)
┌────────┬────────────────┐   ┌─────────────────────────────┐
│ margin │ reading column │   │ Writing        10 pieces    │
│ ← All  │ Title (dries)  │   │ [Contents | First lines]    │
│ Poem   │                │   │ All Poems Prose Fragments…  │
│ 14 ln  │ line           │   │ Title ........ Poem · 14 ln │
│ themes │     indented   │   │ Title ........ Essay · 6 min│
│ [ink]  │ line           │   │   (ink study follows cursor)│
│ size ± │       ✦        │   │ A  After the rain we…       │
│        │ Next piece →   │   │ I  In the house of…         │
│ notes ─┤ Marginalia     │   └─────────────────────────────┘
└────────┴────────────────┘
```

On phones the margin folds above the reading column (meta) and below it (notes);
the reading column takes the full width with a generous gutter.

## Motion principles

1. **Ink is slow, paper is still.** Ink moves on long ease-outs (`expo.out`,
   1.2–1.6 s). Interface feedback is immediate (under 200 ms). Nothing bounces.
2. **Wet to dry.** Type arrives soft, heavier and slightly blurred, and dries crisp.
   This is the only entrance animation on the site, used everywhere, so it reads as
   a language rather than a collection of effects.
3. **Never make anyone wait for a poem.** Lines dry in sequence but a whole stanza is
   readable within about a second of reaching the screen. Nothing reveals on scrub
   inside the reading column, and nothing moves there once it has arrived.
4. **Respond to touch, not only hover.** Ink follows a finger as well as a pointer;
   hover previews have tap equivalents.
5. **Reduced motion is designed, not removed.** With `prefers-reduced-motion`, ink
   is still present as a static stain, sections are already flooded, type is already
   dry, page changes are a short crossfade, and smooth scrolling is off.

## Key interactions

- **The drop.** On first load the name arrives pale and blurred, as iron-gall ink
  does, and dries letter by letter. A drop falls and lands as the full stop after it,
  throws off a few satellites, blooms and darkens.
- **Blotter.** The pointer leaves ink that spreads along the paper's fibres (a small
  advection–diffusion simulation) and evaporates. On dark sections it leaves water,
  which lightens the ink.
- **Night.** The selected writing sits in a flooded section. As you arrive, ink pours
  down the page at about half a screen a second (never trailing far behind a fast
  scroller); the writing appears as the ink reaches it, paper-coloured text on night.
  CSS paints the inside of the section, clipped to the flood front; WebGL draws only
  what grows outward from it: the ragged, slowly bleeding fringe and the wet halo. So
  the night can never go missing or lag behind native scrolling on a phone, and only
  the decorative edge depends on the GPU.
- **Page turns.** Clicking a link blooms ink from the point you clicked; the next page
  appears as the ink drains down the sheet.
- **Index of first lines.** The index can be read as a table of contents or, as in a
  printed collection of poems, alphabetically by first line. Filters by form and theme.
  On hover, each piece's ink study follows the pointer.
- **Marginalia.** Comments are notes in the margin. Select any line of a poem and
  choose "Note this line" to quote it in your note. New notes are written in wet gall
  and darken as they save.
- **Reading controls.** Text size and Paper/Night, remembered per reader.

## Imagery pipeline

Ink studies are generated as scans of ink on blotting paper. A build-prep step levels
each scan so its paper becomes pure white; on the page the study is multiplied onto
the blotter (and inverted and screened at night), so only the ink remains, in either
theme, whatever the tone of the original scan. Nothing between the canvas and the
content creates a stacking context, so these blends see the real page beneath.

## Fallbacks

- **No WebGL / low power / context lost:** the canvas is removed; flooded sections
  get their edges from a generated ink-edge mask instead; page turns use a CSS wipe.
  Detection: WebGL2 availability, software rasterisers (SwiftShader, llvmpipe),
  `saveData`, device memory, and a three-second frame-time probe that first drops the
  simulation and resolution, then the canvas, if the GPU cannot keep up. Throttled
  background frames are ignored so a hidden tab is never mistaken for a slow GPU.
- **No JavaScript:** every page, poem, comment (seeded) and link works; only the
  comment form explains that it needs JavaScript.

## Stack, and why

| Choice | Why |
| ------ | --- |
| **Astro 7**, static output | Content-first, ships zero JS by default, clean file-based URLs, content collections with schema validation, the image pipeline (AVIF/WebP, responsive sizes), and a client router that lets the ink canvas persist across pages and drive custom transitions. |
| **Svelte 5** for the comments island | The one genuinely stateful component (loading, empty, validating, submitting, success, error, replies). Server-rendered with the seeded notes, hydrated when it scrolls into view; tiny runtime. |
| **GSAP 3** (core, ScrollTrigger, SplitText) | Timeline-precise wet-to-dry entrances and scroll moments. English-only content, so splitting titles into characters is safe for shaping. |
| **Lenis** | Smooth wheel scrolling on fine pointers only, synced to ScrollTrigger and the canvas. Off for touch and reduced motion. |
| **Custom WebGL2**, no Three.js | The ink is 2D: a fullscreen composite plus a small ping-pong simulation. Three.js would add ~150 KB for nothing we use. |
| **Satori + resvg** | Per-piece Open Graph images rendered at build from the title and its ink study. |
| **Fontsource** | Self-hosted, subset fonts; no third-party requests. |
| **Codex `$imagegen`** | Paper texture, ink studies, ink-edge mask, still life. Prompts in `assets/image-prompts.md`. |

## Architecture boundaries

- Content lives in `src/content/` (Markdown with frontmatter) and `src/data/`
  (site settings, seeded comments). Every placeholder is flagged `placeholder: true`.
- Pages and components never touch collections directly; they call
  `src/lib/content/` (`getPosts`, `getPost`, `getFeaturedPosts`, `getAbout`, …), which
  returns plain typed objects. Swapping to a CMS means rewriting that folder only.
- Comments go through the `CommentsService` interface in `src/lib/comments/`. Today
  it is a mock (seed + `localStorage`, simulated latency); an HTTP adapter with the
  same interface is stubbed and selected by `PUBLIC_COMMENTS_API`.
