// Site-wide settings. Edit freely; nothing here is hard-coded in components.

export const site = {
  name: 'Bita Shaban',
  url: 'https://bitashaban.com',
  locale: 'en',
  /** Shown under the name on the home page and used as the default description. */
  tagline: 'Poems, prose poems and fragments.',
  description:
    'Poems, prose poems, fragments and short essays by Bita Shaban. Read slowly, and leave a note in the margin.',
  /** The poem set alone on the home page, by slug. */
  openingPoem: 'iron-gall',
  /** Short excerpt shown in the home hero, linking to its poem. */
  heroLine: { text: 'the colour of a leaf that kept its shape', slug: 'iron-gall' },
  nav: [
    { label: 'Writing', href: '/writing/' },
    { label: 'About', href: '/about/' },
  ],
  /**
   * PLACEHOLDER: replace with Bita's real address, or set to '' to hide the
   * "Write to Bita" line on the About page and in the footer.
   */
  email: 'hello@bitashaban.com',
  /** Optional profiles. Leave the list empty to hide them. */
  social: [] as { label: string; href: string }[],
} as const;

export type Site = typeof site;
