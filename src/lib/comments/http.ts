// The adapter for a real comments API. Not used until PUBLIC_COMMENTS_API is set.
//
// Expected endpoints (JSON, relative to PUBLIC_COMMENTS_API):
//   GET  /posts/:postId/comments   -> Comment[]            (oldest first)
//   POST /posts/:postId/comments   body: NewComment        -> Comment (201)
//                                  422 -> { fieldErrors: { author?: string, body?: string } }
//
// Moderation, spam filtering and rate limiting belong on the server.

import { CommentsError, type Comment, type CommentsService, type NewComment } from './types';
import { hasErrors, validateComment } from './validate';

export function createHttpCommentsService(baseUrl: string): CommentsService {
  const base = baseUrl.replace(/\/$/, '');
  const url = (postId: string) => `${base}/posts/${encodeURIComponent(postId)}/comments`;

  return {
    async list(postId, { signal } = {}) {
      let res: Response;
      try {
        res = await fetch(url(postId), { signal, headers: { accept: 'application/json' } });
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        throw new CommentsError('network', 'The notes could not be loaded. Check your connection and try again.');
      }
      if (!res.ok) throw new CommentsError('unknown', `The notes could not be loaded (error ${res.status}).`);
      return (await res.json()) as Comment[];
    },

    async create(input: NewComment) {
      const fieldErrors = validateComment(input);
      if (hasErrors(fieldErrors)) throw new CommentsError('validation', 'Some fields need attention.', fieldErrors);
      let res: Response;
      try {
        res = await fetch(url(input.postId), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(input),
        });
      } catch {
        throw new CommentsError('network', 'The note could not reach the margin. Check your connection and try again.');
      }
      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        throw new CommentsError('validation', 'Some fields need attention.', data.fieldErrors ?? {});
      }
      if (!res.ok) throw new CommentsError('unknown', `The note was not saved (error ${res.status}). Try again in a moment.`);
      return (await res.json()) as Comment;
    },
  };
}
