// The contract between the comment UI and wherever comments are stored.
// Implementations: ./mock.ts (today) and ./http.ts (a real API, later).

export interface Comment {
  id: string;
  postId: string;
  /** Set on replies. Replies are one level deep. */
  parentId?: string;
  author: string;
  body: string;
  /** A line of the piece this note responds to. */
  quote?: string;
  /** ISO 8601. */
  createdAt: string;
  /** Bita's own replies. Never settable from the public form. */
  byPoet?: boolean;
}

export interface NewComment {
  postId: string;
  parentId?: string;
  author: string;
  body: string;
  quote?: string;
  /** Honeypot. Real readers never see or fill it. */
  website?: string;
}

export type CommentsErrorCode = 'network' | 'storage' | 'validation' | 'unknown';

export class CommentsError extends Error {
  constructor(
    public code: CommentsErrorCode,
    message: string,
    public fieldErrors: Partial<Record<keyof NewComment, string>> = {},
  ) {
    super(message);
    this.name = 'CommentsError';
  }
}

export interface CommentsService {
  /** All comments for a piece, oldest first, replies included (flat, linked by parentId). */
  list(postId: string, options?: { signal?: AbortSignal }): Promise<Comment[]>;
  /** Saves a new comment and returns it as stored. Throws CommentsError. */
  create(input: NewComment): Promise<Comment>;
}
