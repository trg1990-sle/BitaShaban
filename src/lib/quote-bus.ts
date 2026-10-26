// Hands a quoted line from the page to the comment form. The form hydrates only when it
// scrolls into view, so a quote sent before then waits here until someone listens.

type Listener = (text: string) => void;
let pending: string | null = null;
const listeners = new Set<Listener>();

export function sendQuote(text: string) {
  if (listeners.size) listeners.forEach((l) => l(text));
  else pending = text;
}

export function onQuote(listener: Listener): () => void {
  listeners.add(listener);
  if (pending !== null) {
    listener(pending);
    pending = null;
  }
  return () => listeners.delete(listener);
}
