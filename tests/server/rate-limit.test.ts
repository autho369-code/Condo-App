import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  consumePublicRateLimit,
  consumeScopedRateLimit,
  rateLimitHeaders,
} from '@/lib/server/rate-limit';

const POLICY = { scope: 'public:test:ip', windowSeconds: 60, maxRequests: 3 };

function allowedRow(overrides: Record<string, unknown> = {}) {
  return {
    data: [{
      allowed: true,
      remaining: 2,
      reset_at: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    }],
    error: null,
  };
}

describe('durable rate-limit helper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('fails closed without a sufficiently long HMAC secret', async () => {
    vi.stubEnv('RATE_LIMIT_SECRET', 'short');
    vi.stubEnv('CRON_SECRET', '');
    const rpc = vi.fn();

    const result = await consumePublicRateLimit(
      { rpc },
      new Headers({ 'x-forwarded-for': '203.0.113.1' }),
      POLICY,
    );

    expect(result).toMatchObject({ allowed: false, unavailable: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('prefers Vercel client IP and sends only its HMAC to Supabase', async () => {
    const secret = 'test-rate-limit-secret-with-32-bytes';
    vi.stubEnv('RATE_LIMIT_SECRET', secret);
    const rpc = vi.fn().mockResolvedValue(allowedRow());

    const result = await consumePublicRateLimit(
      { rpc },
      new Headers({
        'x-vercel-forwarded-for': '198.51.100.9',
        'x-forwarded-for': '203.0.113.1',
      }),
      POLICY,
    );

    const expectedHash = createHmac('sha256', secret)
      .update(`${POLICY.scope}${String.fromCharCode(0)}198.51.100.9`, 'utf8')
      .digest('hex');
    expect(rpc).toHaveBeenCalledWith('consume_api_rate_limit', {
      p_scope: POLICY.scope,
      p_key_hash: expectedHash,
      p_window_seconds: 60,
      p_max_requests: 3,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('198.51.100.9');
    expect(result).toMatchObject({ allowed: true, remaining: 2 });
  });

  it('normalizes scoped identities before hashing', async () => {
    const secret = 'test-rate-limit-secret-with-32-bytes';
    vi.stubEnv('RATE_LIMIT_SECRET', secret);
    const rpc = vi.fn().mockResolvedValue(allowedRow({ allowed: false, remaining: 0 }));

    const result = await consumeScopedRateLimit(
      { rpc },
      '  PERSON@EXAMPLE.COM ',
      { ...POLICY, scope: 'public:test:email' },
    );

    const expectedHash = createHmac('sha256', secret)
      .update(`public:test:email${String.fromCharCode(0)}person@example.com`, 'utf8')
      .digest('hex');
    expect(rpc.mock.calls[0][1].p_key_hash).toBe(expectedHash);
    expect(result).toMatchObject({ allowed: false, remaining: 0 });
    expect(result.unavailable).not.toBe(true);
    expect(rateLimitHeaders(result)).toMatchObject({
      'Cache-Control': 'no-store',
      'X-RateLimit-Remaining': '0',
    });
  });

  it('fails closed when the RPC rejects or returns malformed data', async () => {
    vi.stubEnv('RATE_LIMIT_SECRET', 'test-rate-limit-secret-with-32-bytes');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const rejected = await consumePublicRateLimit(
      { rpc: vi.fn().mockRejectedValue(new Error('offline')) },
      new Headers(),
      POLICY,
    );
    const malformed = await consumePublicRateLimit(
      { rpc: vi.fn().mockResolvedValue(allowedRow({ reset_at: 'not-a-date' })) },
      new Headers(),
      POLICY,
    );

    expect(rejected).toMatchObject({ allowed: false, unavailable: true });
    expect(malformed).toMatchObject({ allowed: false, unavailable: true });
  });
});
