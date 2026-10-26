import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, type Post } from '~/lib/content';
import { escapeHtml, segmentsHtml } from '~/lib/render';
import { site } from '~/data/site';

/** Feed readers get the full text. Verse keeps its lines (indents become non-breaking spaces). */
function contentHtml(post: Post): string {
  if (post.body.kind === 'verse') {
    return post.body.blocks
      .map((b) =>
        b.type === 'heading'
          ? `<h3>${escapeHtml(b.text)}</h3>`
          : `<p>${b.lines.map((l) => '&#160;'.repeat(l.indent) + segmentsHtml(l.segments).replace(/<span class="sp"[^>]*>( +)<\/span>/g, (_, s: string) => '&#160;'.repeat(s.length))).join('<br/>')}</p>`,
      )
      .join('');
  }
  return post.body.blocks
    .map((b) => (b.type === 'break' ? '<p>* * *</p>' : b.type === 'heading' ? `<h3>${escapeHtml(b.text)}</h3>` : `<p>${segmentsHtml(b.segments)}</p>`))
    .join('');
}

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `${site.name}: writing`,
    description: site.description,
    site: context.site ?? site.url,
    trailingSlash: true,
    items: posts.map((p) => ({
      title: p.title,
      link: p.url,
      pubDate: p.date,
      description: p.description,
      content: contentHtml(p),
      categories: [p.formLabel, ...p.themes],
    })),
    customData: '<language>en</language>',
  });
}
