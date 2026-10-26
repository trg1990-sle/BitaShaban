import type { APIContext } from 'astro';
import { getPosts, type Post } from '~/lib/content';
import { renderOg } from '~/lib/og';

export async function getStaticPaths() {
  const posts = await getPosts();
  return posts.map((post) => ({ params: { slug: post.slug }, props: { post } }));
}

export async function GET({ props }: APIContext) {
  const post = (props as { post: Post }).post;
  const jpg = await renderOg({
    title: post.title,
    kicker: `${post.formLabel} · ${post.measure}`,
    line: post.body.kind === 'verse' ? post.excerpt[0] : undefined,
    studyFile: post.inkStudy?.file,
  });
  return new Response(new Uint8Array(jpg), { headers: { 'Content-Type': 'image/jpeg' } });
}
