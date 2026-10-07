import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { companyUrl, sameHostTenantUrl } from './host';
import { domainProof, domainServesCompany } from './domain-proof';

const PROD = 'https://portier369.com';
const NOW = Date.parse('2026-10-07T01:00:00Z');
const APEX = 'portier369.com';

describe('companyUrl', () => {
  const company = { slug: 'stellar', custom_domain: 'portal.stellarpg.com', custom_domain_verified_at: '2026-10-07T00:00:00Z' };

  it("uses the company's own domain once it is verified", () => {
    expect(companyUrl(company, '/portal/insurance', PROD, APEX, NOW)).toBe('https://portal.stellarpg.com/portal/insurance');
  });

  it('keeps the workspace address until the domain is verified, or with no domain', () => {
    expect(companyUrl({ ...company, custom_domain_verified_at: null }, '/x', PROD, APEX, NOW)).toBe('https://stellar.portier369.com/x');
    expect(companyUrl({ slug: 'stellar' }, '/x', PROD, APEX)).toBe('https://stellar.portier369.com/x');
    expect(companyUrl(null, '/x', PROD, APEX)).toBe('https://portier369.com/x');
  });

  it('stops trusting a check that has not been repeated recently', () => {
    const fourHoursLater = NOW + 4 * 60 * 60 * 1000;
    expect(companyUrl(company, '/x', PROD, APEX, fourHoursLater)).toBe('https://stellar.portier369.com/x');
    expect(companyUrl({ ...company, custom_domain_verified_at: 'not a date' }, '/x', PROD, APEX, NOW)).toBe('https://stellar.portier369.com/x');
  });

  it('never treats a platform address as a custom domain', () => {
    expect(companyUrl({ ...company, custom_domain: 'evil.portier369.com' }, '/x', PROD, APEX, NOW)).toBe('https://stellar.portier369.com/x');
  });

  it('stays on the current origin for previews and local runs', () => {
    expect(companyUrl(company, '/x', 'http://localhost:3000', APEX, NOW)).toBe('http://localhost:3000/x');
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
  const vercelDns = async () => ({ cnames: ['cname.vercel-dns.com'], ipv4: [] });
  const elsewhereDns = async () => ({ cnames: [], ipv4: ['203.0.113.7'] });
  const C1 = 'a'.repeat(64);
  const C2 = 'b'.repeat(64);

  it('is live only when the domain answers with the proof for that company and this challenge', async () => {
    const proof = domainProof('p1', 'portal.stellarpg.com', C1);
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({ proof }), challenge: C1, dnsLookup: vercelDns })).toBe(true);
    expect(await domainServesCompany('portal.stellarpg.com', 'p2', { fetchImpl: ok({ proof }), challenge: C1, dnsLookup: vercelDns })).toBe(false);
  });

  it('fails when public DNS does not point at the hosting, even with a valid proof (a relaying server)', async () => {
    const proof = domainProof('p1', 'portal.stellarpg.com', C1);
    const f = ok({ proof });
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: f, challenge: C1, dnsLookup: elsewhereDns })).toBe(false);
    expect((f as any).mock.calls).toHaveLength(0);
  });

  it('rejects a replayed answer recorded for an earlier challenge', async () => {
    const recorded = domainProof('p1', 'portal.stellarpg.com', C1);
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({ proof: recorded }), challenge: C2, dnsLookup: vercelDns })).toBe(false);
  });

  it('needs the server secret and a well-formed challenge', async () => {
    const proof = domainProof('p1', 'portal.stellarpg.com', C1);
    expect(domainProof('p1', 'portal.stellarpg.com', 'not-hex')).toBeNull();
    vi.stubEnv('CRON_SECRET', 'other'.repeat(10));
    expect(domainProof('p1', 'portal.stellarpg.com', C1)).not.toBe(proof);
    vi.stubEnv('CRON_SECRET', '');
    expect(domainProof('p1', 'portal.stellarpg.com', C1)).toBeNull();
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({ proof }), challenge: C1, dnsLookup: vercelDns })).toBe(false);
  });

  it('treats redirects, errors and unreachable domains as not live', async () => {
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({}, 307), dnsLookup: vercelDns })).toBe(false);
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: ok({ error: 'x' }, 404), dnsLookup: vercelDns })).toBe(false);
    const down = vi.fn(async () => { throw new Error('ENOTFOUND'); }) as unknown as typeof fetch;
    expect(await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: down, dnsLookup: vercelDns })).toBe(false);
  });

  it('asks the domain itself over HTTPS with a fresh challenge, without following redirects', async () => {
    const f = ok({});
    await domainServesCompany('Portal.StellarPG.com.', 'p1', { fetchImpl: f, dnsLookup: vercelDns });
    await domainServesCompany('portal.stellarpg.com', 'p1', { fetchImpl: f, dnsLookup: vercelDns });
    const [first, second] = (f as any).mock.calls.map((c: any[]) => new URL(c[0]));
    expect(first.origin + first.pathname).toBe('https://portal.stellarpg.com/api/tenant/domain-check');
    expect(first.searchParams.get('challenge')).toMatch(/^[0-9a-f]{64}$/);
    expect(first.searchParams.get('challenge')).not.toBe(second.searchParams.get('challenge'));
    expect((f as any).mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });
});
