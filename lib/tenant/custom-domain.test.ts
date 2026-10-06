import { describe, expect, it } from 'vitest';
import { parseCustomDomain, pointsAtVercel, requiredDnsRecord } from './custom-domain';

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

describe('requiredDnsRecord', () => {
  it('uses a CNAME for a subdomain and an A record for a root domain', () => {
    expect(requiredDnsRecord('portal.acme.com')).toEqual({ type: 'CNAME', name: 'portal.acme.com', value: 'cname.vercel-dns.com' });
    expect(requiredDnsRecord('acme.com')).toEqual({ type: 'A', name: 'acme.com', value: '76.76.21.21' });
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
