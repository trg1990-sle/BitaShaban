// A browser-only stand-in for a comments API.
//
// Reads the seeded notes, adds anything this browser has written (localStorage),
// and waits a little so loading and saving states are real.
//
// To see the error state: add ?notes=fail to the URL, or run
// localStorage.setItem('bs:notes-fail', '1') in the console.

import { seedComments } from './seed';
import { CommentsError, type Comment, type CommentsService, type NewComment } from './types';
import { hasErrors, validateComment } from './validate';

const KEY = (postId: string) => `bs:notes:v1:${postId}`;
const wait = (min: number, max: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, min + Math.random() * (max - min));
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

function readLocal(postId: string): Comment[] {
  try {
    const raw = localStorage.getItem(KEY(postId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shouldFail(): boolean {
  try {
    return new URLSearchParams(location.search).get('notes') === 'fail' || localStorage.getItem('bs:notes-fail') === '1';
  } catch {
    return false;
  }
}

export function createMockCommentsService(): CommentsService {
  return {
    async list(postId, { signal } = {}) {
      await wait(250, 550, signal);
      return [...seedComments(postId), ...readLocal(postId)].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async create(input: NewComment) {
      const fieldErrors = validateComment(input);
      if (hasErrors(fieldErrors)) throw new CommentsError('validation', 'Some fields need attention.', fieldErrors);

      await wait(700, 1200);

      if (typeof navigator !== 'undefined' && navigator.onLine === false)
        throw new CommentsError('network', 'You seem to be offline. Reconnect and leave your note again.');
      if (shouldFail())
        throw new CommentsError('network', 'The note could not reach the margin. Check your connection and try again.');

      const comment: Comment = {
        id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        postId: input.postId,
        parentId: input.parentId,
        author: input.author.trim(),
        body: input.body.trim(),
        quote: input.quote?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      // A filled honeypot gets a convincing success and is never stored.
      if (input.website) return comment;

      try {
        localStorage.setItem(KEY(input.postId), JSON.stringify([...readLocal(input.postId), comment]));
      } catch {
        throw new CommentsError(
          'storage',
          'This browser is not letting the site save anything (private browsing can do this). Your note is still in the box.',
        );
      }
      return comment;
    },
  };
}
