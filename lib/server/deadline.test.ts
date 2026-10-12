import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeadlineError, fetchWithTimeout, isUnavailableError, withDeadline } from './deadline';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('withDeadline', () => {
  it('passes the answer through when it comes in time', async () => {
    await expect(withDeadline(Promise.resolve(42), 1000, 'x')).resolves.toBe(42);
  });

  it('gives up after the time limit', async () => {
    vi.useFakeTimers();
    const pending = withDeadline(new Promise(() => {}), 6000, 'tenant_branding');
    const check = expect(pending).rejects.toBeInstanceOf(DeadlineError);
    await vi.advanceTimersByTimeAsync(6000);
    await check;
  });

  it('keeps the original error', async () => {
    await expect(withDeadline(Promise.reject(new Error('boom')), 1000, 'x')).rejects.toThrow('boom');
  });
});

describe('fetchWithTimeout', () => {
  it('aborts a request that hangs', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', (_: unknown, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));
    const pending = fetchWithTimeout(6000)('https://example.test');
    const check = expect(pending).rejects.toBeInstanceOf(DeadlineError);
    await vi.advanceTimersByTimeAsync(6000);
    await check;
  });

  it("still honours the caller's own abort signal", async () => {
    vi.stubGlobal('fetch', (_: unknown, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('caller aborted')));
    }));
    const caller = new AbortController();
    const pending = fetchWithTimeout(6000)('https://example.test', { signal: caller.signal });
    caller.abort();
    await expect(pending).rejects.toThrow('caller aborted');
  });
});

describe('cancelling when the time limit is hit', () => {
  it('stops the work behind the deadline and every later request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', (input: unknown, init: RequestInit) => {
      return new Promise((_, reject) => {
        if (init.signal?.aborted) return reject(init.signal.reason);
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    });
    const cancel = new AbortController();
    const limited = fetchWithTimeout(6000, cancel.signal);
    // Like Auth's refresh: a request, and a retry after a pause.
    const work = limited('https://example.test/refresh').catch(() =>
      new Promise((resolve) => setTimeout(resolve, 1000)).then(() => limited('https://example.test/refresh-retry')));
    const answer = withDeadline(work, 500, 'auth.getUser', cancel);
    const check = expect(answer).rejects.toBeInstanceOf(DeadlineError);
    await vi.advanceTimersByTimeAsync(500);
    await check;
    expect(cancel.signal.aborted).toBe(true);
    // The retry that follows fails at once instead of reaching the server.
    await vi.advanceTimersByTimeAsync(1000);
    await expect(work).rejects.toBeInstanceOf(DeadlineError);
  });
});

describe('isUnavailableError', () => {
  it('treats timeouts, network failures and 5xx as "did not answer"', () => {
    expect(isUnavailableError(new DeadlineError('auth.getUser', 9000))).toBe(true);
    expect(isUnavailableError({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' })).toBe(true);
    expect(isUnavailableError({ name: 'AuthApiError', status: 503, message: 'upstream' })).toBe(true);
    expect(isUnavailableError({ message: 'TypeError: fetch failed' })).toBe(true);
  });

  it('does not treat a real "no" as an outage', () => {
    expect(isUnavailableError(null)).toBe(false);
    expect(isUnavailableError({ name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' })).toBe(false);
    expect(isUnavailableError({ name: 'AuthApiError', status: 400, code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' })).toBe(false);
  });
});

describe('middleware uses the time limits', () => {
  const source = readFileSync('middleware.ts', 'utf8');

  it('limits every database call and the sign-in check', () => {
    expect(source).toContain('global: { fetch: fetchWithTimeout(CALL_TIMEOUT_MS, cancel.signal) }');
    expect(source).toContain("CALL_TIMEOUT_MS, 'tenant_branding', cancel)");
    expect(source).toContain("withDeadline(supabase.auth.getUser(), AUTH_DEADLINE_MS, 'auth.getUser', cancel)");
    expect(source).toContain("CALL_TIMEOUT_MS, 'me', cancel)");
  });

  it('answers "try again" instead of a wrong page when the database is slow', () => {
    expect(source).toContain('if (branding.error) return serviceUnavailable(pathname, response)');
    expect(source).toContain('isUnavailableError(authError)');
    expect(source).toContain('if (user && !isPublic && requestIdentityError) return serviceUnavailable(pathname, response)');
  });
});
