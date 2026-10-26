# bitashaban.com

The website of the poet Bita Shaban: poems, prose poems, fragments and short essays,
each with a margin where readers can leave notes.

This is the front end only. There is no CMS, login or database yet: content lives in
files, and comments are stored in the reader's browser by a mock service that can be
swapped for a real API without touching the design. The concept and design decisions
are in [DESIGN.md](DESIGN.md).

> **Placeholder content.** Every poem, the bio, the seeded comments and the contact
> address were written for the build. They are marked `placeholder: true` (or
> `PLACEHOLDER`) in their files. See [Replacing the placeholder content](#replacing-the-placeholder-content).

## Setup

Requires Node 22.12 or newer.

```bash
npm install
```

| Command                    | What it does                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run dev`              | Local development server at http://localhost:4321                   |
| `npm run build`            | Static production build in `dist/` (pages, images, share images, sitemap, RSS) |
| `npm run preview`          | Serves the production build locally                                 |
| `npm run check`            | Type-checks Astro, TypeScript and Svelte files                      |
| `npm run images:optimize`  | Rebuilds the paper texture, ink-edge mask, icons and web manifest   |
| `node scripts/contact-sheet.mjs out.jpg 3 480 <pngs…>` | Tiles review screenshots into one image for a quick look |
| `npm run review`           | Screenshots every page at three widths in a real browser and reports console errors, failed requests and horizontal overflow (needs `npm run preview` running; `--browser webkit`, `--gpu`, `--reduced-motion`, `--scheme dark`: see the script header) |

`dist/` is a plain static site: deploy it to any static host (Netlify, Vercel, Cloudflare
Pages, GitHub Pages, S3). URLs use trailing slashes (`/writing/iron-gall/`); `404.html` is
the not-found page.

## Stack

Astro 7 (static output, client router for page transitions), Svelte 5 for the comments
island, GSAP (ScrollTrigger, SplitText) and Lenis for motion, a small custom WebGL2
engine for the ink, Satori + resvg for share images, self-hosted Fraunces and DM Mono.
Reasons are in [DESIGN.md](DESIGN.md#stack-and-why).

## Content structure

```
assets/
  source/                 raw generated images (inputs only, never shipped)
  image-prompts.md        the prompt behind every image
src/
  content/
    posts/*.md            one file per piece (poem, prose poem, essay, fragments)
    pages/about.md        the About page
  data/
    site.ts               name, tagline, navigation, opening poem, contact address
    comments.seed.json    sample notes shown under each piece (placeholder)
  assets/studies/         ink studies, one per piece (derived; see Images)
  assets/images/          other artwork (derived; see Images)
  content.config.ts       the schema every content file is checked against
  lib/
    content/              the content layer: the only code that reads content
    comments/             the comments layer: the only code that stores comments
```

### A piece

```markdown
---
title: Iron Gall
form: poem                 # poem | prose-poem | essay | fragments
date: 2026-10-02
themes: [language, time]   # free-form; each becomes a filter on the index
featured: false            # true = shown in "Selected writing" on the home page
inkStudy: ink-iron-gall    # file name in src/assets/studies (optional)
description: One sentence for search engines and share cards.   # optional
epigraph: For M.           # optional, shown under the title
placeholder: true          # remove when this is real work
---
The ink goes on the colour of a bruise
that hasn't happened yet: a pale
```

The file name is the URL: `iron-gall.md` becomes `/writing/iron-gall/`.

**Poems and fragments are never run through Markdown.** What you type is what readers see:

- every line break is kept; a blank line starts a new stanza, two blank lines leave a
  larger gap;
- leading spaces are kept as indentation (and stay proportional on small screens);
- runs of spaces inside a line are kept (a caesura stays a caesura);
- `*words*` are set in italic, `**words**` in bold;
- a line starting with `## ` is a section heading (see *Inventory of a Small House*);
- in `fragments`, each stanza is numbered automatically.

**Prose poems and essays** are paragraphs separated by blank lines. `*italic*` works, and
a line with only `* * *` is a section break.

Straight quotes and apostrophes are turned into typographic ones automatically.

### The home page

- **Hero line:** `heroLine` in `src/data/site.ts` (a phrase and the piece it links to).
- **A poem to begin:** `openingPoem` in `src/data/site.ts`.
- **Selected writing:** every piece with `featured: true`.
- **About glimpse:** the `glimpse` field of `src/content/pages/about.md`.

## Replacing the placeholder content

1. **Writing:** replace or delete the files in `src/content/posts/`. Remove
   `placeholder: true` from real pieces. Set `featured: true` on the pieces for the home
   page, and point `openingPoem` / `heroLine` in `src/data/site.ts` at real slugs.
2. **Bio:** edit `src/content/pages/about.md`: the front matter (lede, glimpse, pull quote,
   image) and the `## ` chapters below it. The pull quote is credited to the opening poem
   automatically when its words appear in that poem.
3. **Portrait:** put a photo in `src/assets/images/` (for example `portrait.jpg`) and set
   `image: portrait` and `imageAlt` in `about.md`. The current image is placeholder art.
   Photos are shown as they are; only ink studies are blended into the paper.
4. **Contact:** `email` in `src/data/site.ts` (set to `''` to hide it); add profiles to `social`.
5. **Comments:** empty `src/data/comments.seed.json` (keep the `{}`), or connect a real
   backend (below).
6. **Ink studies:** each piece can have one (`inkStudy:`, a file name in
   `src/assets/studies/`). Generate new ones with the prompts in `assets/image-prompts.md`
   (then `npm run images:optimize`), drop in any scan of ink on white paper, or leave the
   field out.

Search for leftovers with `grep -rn "placeholder: true\|PLACEHOLDER" src`.

## Comments (Marginalia)

The UI (`src/components/marginalia/`) only talks to the `CommentsService` interface in
`src/lib/comments/types.ts`:

```ts
interface CommentsService {
  list(postId: string): Promise<Comment[]>;     // oldest first, replies included
  create(input: NewComment): Promise<Comment>;  // throws CommentsError
}
```

- **Today:** `src/lib/comments/mock.ts` returns the seeded notes plus anything written in
  this browser (`localStorage`, key `bs:notes:v1:<slug>`), with realistic delays.
- **A real API:** set `PUBLIC_COMMENTS_API=https://api.example.com` (see `.env.example`)
  and rebuild. `src/lib/comments/http.ts` documents the two endpoints it expects. The
  UI does not change. Moderation, spam filtering and rate limiting belong on the server;
  the form already sends a honeypot field (`website`).
- **Validation** rules live in `src/lib/comments/validate.ts` and run in the form and in
  every service.

Try the states: no notes (*What the Sea Gives Back*), submitting, validation (submit an
empty form), success, and the error state (add `?notes=fail` to a piece's URL, or run
`localStorage.setItem('bs:notes-fail', '1')`).

## Images

Every image was generated with Codex CLI's `$imagegen` skill. The exact prompts are in
[assets/image-prompts.md](assets/image-prompts.md), and they double as the input of the
regeneration script:

```bash
node scripts/generate-images.mjs ink-insomnia      # one image
node scripts/generate-images.mjs --all             # everything (uses Codex credits)
npm run images:optimize                            # rebuild derived textures and icons
```

Raw generations live in `assets/source/` and are never shipped. `npm run images:optimize`
derives the site's files from them: ink studies in `src/assets/studies/` (paper levelled to
white, so they blend into the page), artwork in `src/assets/images/`, the paper texture,
ink-edge mask and icons in `public/`. Astro then serves responsive AVIF/WebP. Share images (`/og/<slug>.jpg`) are rendered at build time by
`src/lib/og.ts` from each piece's title and ink study.

## Accessibility and motion

- Poems are real text, one element per line; the ink canvas is decorative and hidden
  from assistive technology.
- Everything works with the keyboard; focus is always visible; the header steps aside
  while reading and returns on scroll-up or focus.
- With `prefers-reduced-motion`, nothing animates in, the ink is still, smooth scrolling
  is off and page changes are a short crossfade.
- Without WebGL (or on a slow GPU, or with Data Saver) the ink falls back to CSS. Without
  JavaScript every page and comment is readable; only leaving a note needs it.
