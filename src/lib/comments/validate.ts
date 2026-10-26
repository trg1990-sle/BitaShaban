import type { NewComment } from './types';

export const LIMITS = { author: 60, body: 1200, quote: 300 } as const;

export type FieldErrors = Partial<Record<'author' | 'body' | 'quote', string>>;

/** Shared by the form (instant feedback) and every service (never trust the client). */
export function validateComment(input: Pick<NewComment, 'author' | 'body' | 'quote'>): FieldErrors {
  const errors: FieldErrors = {};
  const author = input.author.trim();
  const body = input.body.trim();

  if (!author) errors.author = 'Add your name, or the name you would like to sign with.';
  else if (author.length > LIMITS.author) errors.author = `Keep your name under ${LIMITS.author} characters.`;

  if (!body) errors.body = 'Write your note before leaving it.';
  else if (body.length > LIMITS.body)
    errors.body = `Notes can be up to ${LIMITS.body.toLocaleString('en')} characters. This one is ${body.length.toLocaleString('en')}.`;

  if (input.quote && input.quote.length > LIMITS.quote) errors.quote = 'Quote a single line or two, not a whole stanza.';

  return errors;
}

export const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;
