import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../app/api/tenant/domain-check/route';
import { domainProof } from '../../lib/tenant/domain-proof';
import { apexDomain } from '../../lib/tenant/host';

const C = 'c'.repeat(64);
const req = (headers: Record<string, string>, challenge: string | null = C) =>
  new NextRequest(`https://portal.stellarpg.com/api/tenant/domain-check${challenge === null ? '' : `?challenge=${challenge}`}`, { headers });
const resolved = { 'x-tenant-state': 'resolved', 'x-tenant-host': 'portal.stellarpg.com', 'x-portfolio-id': 'p1' };

describe('domain-check endpoint', () => {
  beforeEach(() => vi.stubEnv('CRON_SECRET', 'k'.repeat(40)));
  afterEach(() => vi.unstubAllEnvs());

  it("answers with the proof for the company a custom domain resolved to", async () => {
    const res = GET(req({ 'x-tenant-state': 'resolved', 'x-tenant-host': 'portal.stellarpg.com', 'x-portfolio-id': 'p1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ proof: domainProof('p1', 'portal.stellarpg.com', C) });
  });

  it('requires a well-formed challenge', () => {
    expect(GET(req(resolved, null)).status).toBe(400);
    expect(GET(req(resolved, 'xyz')).status).toBe(400);
  });

  it('does not answer when the secret is not configured', () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(GET(req({ 'x-tenant-state': 'resolved', 'x-tenant-host': 'portal.stellarpg.com', 'x-portfolio-id': 'p1' })).status).toBe(503);
  });

  it('refuses unresolved requests and workspace subdomains', () => {
    expect(GET(req({})).status).toBe(404);
    expect(GET(req({ 'x-tenant-state': 'resolved', 'x-tenant-host': `stellar.${apexDomain()}`, 'x-portfolio-id': 'p1' })).status).toBe(404);
  });
});
