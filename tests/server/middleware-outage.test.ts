// When Supabase does not answer, middleware must reply "try again" well
// inside Vercel's 25 s limit - not hang, not send a signed-in visitor to the
// sign-in page, and not call a real company's address "workspace not found".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const REF = 'outagetest';

function sessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '00000000-0000-0000-0000-000000000001', exp: now + 3600, role: 'authenticated' })}.sig`;
  const session = {
    access_token: accessToken,
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated' },
  };
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

let calls: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `https://${REF}.supabase.co`);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('NEXT_PUBLIC_APEX_DOMAIN', 'portier369.com');
  calls = [];
  // A database that never answers (until the request is aborted).
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    return new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function run(url: string, cookie?: string) {
  const { middleware } = await import('../../middleware');
  const request = new NextRequest(url, { headers: cookie ? { cookie, host: new URL(url).host } : { host: new URL(url).host } });
  const pending = middleware(request);
  let settled = false;
  pending.finally(() => { settled = true; });
  // Advance time in small steps and record how long the answer took.
  let waited = 0;
  while (!settled && waited < 25_000) {
    await vi.advanceTimersByTimeAsync(250);
    waited += 250;
  }
  expect(settled).toBe(true);
  return { response: await pending, waited };
}

describe('middleware during a database outage', () => {
  it('a signed-in visitor gets "try again", not the sign-in page, in time', async () => {
    const { response, waited } = await run('https://portier369.com/dashboard', sessionCookie());
    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('retry-after')).toBe('30');
    expect(waited).toBeLessThan(20_000);
    // Cookies are kept: nothing was expired.
    expect(response.headers.get('set-cookie') ?? '').not.toContain('Max-Age=0');
  });

  it("a company's own address is not called \"workspace not found\"", async () => {
    const { response, waited } = await run('https://acme.portier369.com/dashboard', sessionCookie());
    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    expect(calls.some((c) => c.includes('/rpc/tenant_branding'))).toBe(true);
    expect(waited).toBeLessThan(20_000);
  });

  it('a slow identity lookup refuses even a page view on the platform address', async () => {
    // Auth answers, the identity lookup (rpc/me) never does. Before, a read
    // would have gone past the MFA check once the lookup failed.
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/auth/v1/user')) {
        return Promise.resolve(new Response(JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated' }), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
      });
    });
    const { response, waited } = await run('https://portier369.com/platform-operator', sessionCookie());
    expect(calls.some((c) => c.includes('/rpc/me'))).toBe(true);
    expect(response.status).toBe(503);
    expect(waited).toBeLessThan(20_000);
  });

  it('API callers get a JSON 503', async () => {
    const { response } = await run('https://portier369.com/api/reports/run', sessionCookie());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'service_unavailable' });
  });
});
