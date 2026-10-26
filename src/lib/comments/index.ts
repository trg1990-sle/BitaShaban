// Entry point for comments. The UI only ever calls getCommentsService().
//
// Today: a mock that persists to this browser. Set PUBLIC_COMMENTS_API (see .env.example)
// to switch to the HTTP adapter; the UI does not change.

import type { CommentsService } from './types';

export type { Comment, NewComment, CommentsService } from './types';
export { CommentsError } from './types';
export { validateComment, hasErrors, LIMITS, type FieldErrors } from './validate';

let service: Promise<CommentsService> | undefined;

export function getCommentsService(): Promise<CommentsService> {
  const api = import.meta.env.PUBLIC_COMMENTS_API as string | undefined;
  service ??= api
    ? import('./http').then((m) => m.createHttpCommentsService(api))
    : import('./mock').then((m) => m.createMockCommentsService());
  return service;
}
