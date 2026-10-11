// Time limits for the database calls middleware makes on every request.
//
// Vercel stops middleware that has not answered within 25 s. When Supabase is
// slow or down, an un-limited call (or Auth's own refresh retries, which keep
// going for up to 30 s) used it all up: the visitor waited 25 s for an error
// page. With these limits a slow database gets a quick "try again" answer.

export class DeadlineError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not answer within ${ms} ms`);
    this.name = 'DeadlineError';
  }
}

/** Resolves like `work`, or rejects with DeadlineError after `ms`. */
export function withDeadline<T>(work: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(label, ms)), ms);
  });
  return Promise.race([Promise.resolve(work), deadline]).finally(() => clearTimeout(timer));
}

/** fetch that gives up after `ms` (keeps any abort signal the caller passed). */
export function fetchWithTimeout(ms: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DeadlineError('fetch', ms)), ms);
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort(outer.reason);
      else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

/** True when an error means "the service did not answer", not "the answer was no". */
export function isUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; status?: unknown; code?: unknown; message?: unknown };
  if (e.name === 'DeadlineError' || e.name === 'AbortError' || e.name === 'AuthRetryableFetchError') return true;
  if (typeof e.status === 'number' && (e.status === 0 || e.status >= 500)) return true;
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return message.includes('fetch failed') || message.includes('aborterror') || message.includes('did not answer within');
}
