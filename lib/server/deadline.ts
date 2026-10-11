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

/**
 * Resolves like `work`, or rejects with DeadlineError after `ms`. Pass the
 * request's `cancel` controller (the one given to fetchWithTimeout) so the
 * work itself stops too: otherwise Auth's retries run on after the answer
 * has gone out and a token refresh could finish without its cookies reaching
 * the browser.
 */
export function withDeadline<T>(work: PromiseLike<T>, ms: number, label: string, cancel?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new DeadlineError(label, ms);
      cancel?.abort(error);
      reject(error);
    }, ms);
  });
  return Promise.race([Promise.resolve(work), deadline]).finally(() => clearTimeout(timer));
}

/**
 * fetch that gives up after `ms`, keeps any abort signal the caller passed,
 * and stops at once (now and for every later call) when `cancel` aborts.
 */
export function fetchWithTimeout(ms: number, cancel?: AbortSignal): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DeadlineError('fetch', ms)), ms);
    for (const outer of [init?.signal, cancel]) {
      if (!outer) continue;
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
