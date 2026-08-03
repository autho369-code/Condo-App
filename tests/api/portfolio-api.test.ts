import { describe, expect, it } from 'vitest';

import { pagination, rawApiKey, scopeAllows } from '@/lib/api/portfolio-api';
import { PUBLIC_PATHS } from '@/lib/server/public-paths';

describe('portfolio API authentication helpers', () => {
  it('reads a bearer key without accepting an unrelated authorization scheme', () => {
    expect(rawApiKey(new Request('https://example.test', { headers: { authorization: 'Bearer cak_secret' } }))).toBe('cak_secret');
    expect(rawApiKey(new Request('https://example.test', { headers: { authorization: 'Basic abc' } }))).toBe('');
  });

  it('accepts x-api-key when bearer authorization is absent', () => {
    expect(rawApiKey(new Request('https://example.test', { headers: { 'x-api-key': 'cak_header' } }))).toBe('cak_header');
  });

  it('enforces explicit resource scopes and documented wildcard behavior', () => {
    expect(scopeAllows(['read:work_orders'], 'read:work_orders')).toBe(true);
    expect(scopeAllows(['read:work_orders'], 'read:vendors')).toBe(false);
    expect(scopeAllows(['read:*'], 'read:vendors')).toBe(true);
    expect(scopeAllows([], 'read:reserves')).toBe(false);
  });

  it('bounds pagination and strips PostgREST filter syntax from search text', () => {
    expect(pagination(new Request('https://example.test?q=roof%29%2Cor%28portfolio_id.neq.safe&page=-2&limit=900'))).toEqual({
      page: 1,
      limit: 100,
      offset: 0,
      query: 'rooforportfolio_id.neq.safe',
    });
  });

  it('keeps API-key routes reachable without a browser session', () => {
    expect(PUBLIC_PATHS).toContain('/api/v1');
  });
});
