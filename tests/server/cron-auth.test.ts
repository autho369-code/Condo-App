import { afterEach, describe, expect, it, vi } from 'vitest';

import { requireCronSecret } from '@/lib/server/cron-auth';

// requireCronSecret only reads request.headers.get('authorization'), so a
// minimal stand-in keeps the test independent of Next's request internals.
function reqWithAuth(authorization?: string) {
  return { headers: new Headers(authorization ? { authorization } : {}) } as any;
}

describe('requireCronSecret (fail-closed cron guard)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('fails closed with 503 when no CRON_SECRET is configured', () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = requireCronSecret(reqWithAuth('Bearer anything'));
    expect(res?.status).toBe(503);
  });

  it('rejects a missing bearer token with 401', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const res = requireCronSecret(reqWithAuth(undefined));
    expect(res?.status).toBe(401);
  });

  it('rejects a wrong bearer token with 401', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect(requireCronSecret(reqWithAuth('Bearer wrong'))?.status).toBe(401);
    // Prefix/suffix variants must not pass either.
    expect(requireCronSecret(reqWithAuth('Bearer s3cret-extra'))?.status).toBe(401);
    expect(requireCronSecret(reqWithAuth('s3cret'))?.status).toBe(401);
  });

  it('passes (returns null) with the exact bearer token', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect(requireCronSecret(reqWithAuth('Bearer s3cret'))).toBeNull();
  });
});
