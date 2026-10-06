import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRootDomain, parseCustomDomain, pointsAtVercel, requiredDnsRecord, vercelDomainStatus } from './custom-domain';

describe('parseCustomDomain', () => {
  it('normalizes a typed domain', () => {
    expect(parseCustomDomain('  Portal.StellarPropertyGroup.com. ', 'portier369.com'))
      .toEqual({ ok: true, domain: 'portal.stellarpropertygroup.com' });
  });

  it('treats an empty value as clearing the domain', () => {
    expect(parseCustomDomain('   ', 'portier369.com')).toEqual({ ok: true, domain: null });
    expect(parseCustomDomain(null, 'portier369.com')).toEqual({ ok: true, domain: null });
  });

  it('rejects URLs, paths and malformed names', () => {
    for (const bad of ['https://portal.acme.com', 'portal.acme.com/login', 'acme', '-acme.com', 'acme-.com', 'ac_me.com', 'acme.c', `${'a'.repeat(64)}.com`]) {
      expect(parseCustomDomain(bad, 'portier369.com').ok, bad).toBe(false);
    }
  });

  it('rejects platform addresses', () => {
    for (const bad of ['portier369.com', 'stellar.portier369.com', 'condo-app.vercel.app', 'acme.localhost', 'x.example.org']) {
      expect(parseCustomDomain(bad, 'example.org').ok, bad).toBe(false);
    }
    expect(parseCustomDomain('portal.acme.com', 'example.org').ok).toBe(true);
  });
});

describe('isRootDomain', () => {
  it('finds the registrable domain under multi-label public suffixes', () => {
    expect(isRootDomain('acme.com')).toBe(true);
    expect(isRootDomain('acme.co.uk')).toBe(true);
    expect(isRootDomain('acme.com.au')).toBe(true);
    expect(isRootDomain('portal.acme.com')).toBe(false);
    expect(isRootDomain('portal.acme.co.uk')).toBe(false);
  });
});

describe('requiredDnsRecord', () => {
  it('uses a CNAME for a subdomain and an A record for a root domain', () => {
    expect(requiredDnsRecord('portal.acme.com')).toEqual({ type: 'CNAME', name: 'portal.acme.com', value: 'cname.vercel-dns.com' });
    expect(requiredDnsRecord('acme.com')).toEqual({ type: 'A', name: 'acme.com', value: '76.76.21.21' });
    expect(requiredDnsRecord('acme.co.uk').type).toBe('A');
    expect(requiredDnsRecord('portal.acme.co.uk').type).toBe('CNAME');
  });

  it("prefers Vercel's recommended values", () => {
    expect(requiredDnsRecord('portal.acme.com', { cname: 'abc.vercel-dns-017.com.' }).value).toBe('abc.vercel-dns-017.com');
    expect(requiredDnsRecord('acme.com', { ipv4: '216.198.79.1' }).value).toBe('216.198.79.1');
  });
});

describe('pointsAtVercel', () => {
  const cname = requiredDnsRecord('portal.acme.com');
  it('accepts Vercel CNAMEs and the A record', () => {
    expect(pointsAtVercel({ cnames: ['cname.vercel-dns.com.'], ipv4: [] }, cname)).toBe(true);
    expect(pointsAtVercel({ cnames: ['abc.vercel-dns-017.com'], ipv4: [] }, cname)).toBe(true);
    expect(pointsAtVercel({ cnames: [], ipv4: ['76.76.21.21'] }, requiredDnsRecord('acme.com'))).toBe(true);
  });
  it('rejects other targets', () => {
    expect(pointsAtVercel({ cnames: ['stellarpropertygrp.appfolio.com'], ipv4: [] }, cname)).toBe(false);
    expect(pointsAtVercel({ cnames: ['evilvercel-dns.com'], ipv4: [] }, cname)).toBe(false);
    expect(pointsAtVercel({ cnames: [], ipv4: [] }, cname)).toBe(false);
  });
});

describe('vercelDomainStatus', () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = { token: 't', projectId: 'prj_1', teamId: null };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it('asks Vercel to re-check an unverified domain and uses the result', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url.pathname}`);
      if (url.pathname.endsWith('/verify')) return json(200, { name: 'portal.acme.com', verified: true });
      if (url.pathname.startsWith('/v6/')) return json(200, { misconfigured: false });
      return json(200, { name: 'portal.acme.com', verified: false, verification: [{ type: 'TXT', domain: '_vercel.acme.com', value: 'vc-1' }] });
    }));
    const status = await vercelDomainStatus(env, 'portal.acme.com');
    expect(calls).toContain('POST /v9/projects/prj_1/domains/portal.acme.com/verify');
    expect(status).toMatchObject({ state: 'attached', verified: true, misconfigured: false, verification: [] });
  });

  it('keeps the TXT challenge when verification still fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
      if (url.pathname.endsWith('/verify')) return json(400, { error: { message: 'TXT not found' } });
      if (url.pathname.startsWith('/v6/')) return json(200, { misconfigured: true });
      return json(200, { verified: false, verification: [{ type: 'TXT', domain: '_vercel.acme.com', value: 'vc-1' }] });
    }));
    const status = await vercelDomainStatus(env, 'portal.acme.com');
    expect(status).toMatchObject({ state: 'attached', verified: false, verification: [{ type: 'TXT', value: 'vc-1' }] });
  });

  it('does not call verify for a verified domain', async () => {
    const fetch = vi.fn(async (url: URL) => json(200, url.pathname.startsWith('/v6/') ? { misconfigured: false } : { verified: true }));
    vi.stubGlobal('fetch', fetch);
    await vercelDomainStatus(env, 'portal.acme.com');
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/verify'))).toBe(false);
  });
});
