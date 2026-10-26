import seed from '~/data/comments.seed.json';
import type { Comment } from './types';

type SeedFile = Record<string, Omit<Comment, 'postId'>[] | string>;

/** Seeded (placeholder) comments for one piece. Used for server rendering and by the mock service. */
export function seedComments(postId: string): Comment[] {
  const list = (seed as SeedFile)[postId];
  return Array.isArray(list) ? list.map((c) => ({ ...c, postId })) : [];
}
