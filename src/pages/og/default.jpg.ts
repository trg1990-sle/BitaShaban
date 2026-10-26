import { getPost } from '~/lib/content';
import { renderOg } from '~/lib/og';
import { site } from '~/data/site';

export async function GET() {
  const opening = await getPost(site.openingPoem);
  const jpg = await renderOg({
    variant: 'name',
    title: 'Bita Shaban.',
    kicker: site.tagline,
    line: 'Read slowly, and leave a note in the margin.',
    studyFile: opening?.inkStudy?.file,
  });
  return new Response(new Uint8Array(jpg), { headers: { 'Content-Type': 'image/jpeg' } });
}
