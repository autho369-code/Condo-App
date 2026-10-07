import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { companyUrl, sameHostTenantUrl } from './host';
import { domainProof, domainServesCompany } from './domain-proof';

const PROD = 'https://portier369.com';
const APEX = 'portier369.com';

describe('companyUrl', () => {
  const company = { slug: 'stellar', custom_domain: 'portal.stellarpg.com', custom_domain_verified_at: '2026-10-07T00:00:00Z' };

  it("uses the company's own domain once it is verified", () => {
    expect(companyUrl(company, '/portal/insurance', PROD, APEX)).toBe('https://portal.stellarpg.com/portal/insurance');
  });

  it('keeps the workspace address until the domain is verified, or with no domain', () => {
    expect(companyUrl({ ...company, custom_domain_verified_at: null }, '/x', PROD, APEX)).toBe('https://stellar.portier369.com/x');
    expect(companyUrl({ slug: 'stellar' }, '/x', PROD, APEX)).toBe('https://stellar.portier369.com/x');
    expect(companyUrl(null, '/x', PROD, APEX)).toBe('https://portier369.com/x');
  });

  it('never treats a platform address as a custom domain', () => {
    expect(companyUrl({ ...company, custom_domain: 'evil.portier369.com' }, '/x', PROD, APEX)).toBe('https://stellar.portier369.com/x');
  });

  it('stays on the current origin for previews and local runs', () => {
    expect(companyUrl(company, '/x', 'http://localhost:3000', APEX)).toBe('http://localhost:3000/x');
  });
});

describe('sameHostTenantUrl', () => {
  it('keeps the custom domain the request came in on', () => {
    expect(sameHostTenantUrl({ hostname: 'portal.stellarpg.com', slug: 'stellar' }, '/portal/pay?canceled=1', PROD, APEX))
      .toBe('https://portal.stellarpg.com/portal/pay?canceled=1');
  });

  it('keeps a workspace subdomain and falls back to the slug otherwise', () => {
    expect(sameHostTenantUrl({ hostname: 'stellar.portier369.com', slug: 'stellar' }, '/x', PROD, APEX)).toBe('https://stellar.portier369.com/x');
    expect(sameHostTenantUrl({ slug: 'stellar' }, '/x', PROD, APEX)).toBe('https://stellar.portier369.com/x');
  });
});

describe('domain check', () => {
  beforeEach(() => vi.stubEnv('CRON_SECRET', 'k'.repeat(40)));
  afterEach(() => vi.unstubAllEnvs());
  const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('is live only when the domain answers with the proof for that company', async () => {
    const proof = domainProof('p1', 'portal.stellarpg.com');
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({ proof }) })).toBe(true);
    expect(await domainServesCompany('portal.stellarpg.com', 'p2', { fetchImpl: ok({ proof }) })).toBe(false);
  });

  it('needs the server secret: without it nothing verifies, and the proof changes with the key', async () => {
    const proof = domainProof('p1', 'portal.stellarpg.com');
    vi.stubEnv('CRON_SECRET', 'other'.repeat(10));
    expect(domainProof('p1', 'portal.stellarpg.com')).not.toBe(proof);
    vi.stubEnv('CRON_SECRET', '');
    expect(domainProof('p1', 'portal.stellarpg.com')).toBeNull();
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({ proof }) })).toBe(false);
  });

  it('treats redirects, errors and unreachable domains as not live', async () => {
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({}, 307) })).toBe(false);
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({ error: 'x' }, 404) })).toBe(false);
    const down = vi.fn(async () => { throw new Error('ENOTFOUND'); }) as unknown as typeof fetch;
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: down })).toBe(false);
  });

  it('asks the domain itself over HTTPS without following redirects', async () => {
    const f = ok({});
    await domainServesCompany('Portal.StellarPG.com.', 'p1', { fetchImpl: f });
    expect((f as any).mock.calls[0][0]).toBe('https://portal.stellarpg.com/api/tenant/domain-check');
    expect((f as any).mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });
});
