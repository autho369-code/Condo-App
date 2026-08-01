import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyTenantHost,
  normalizeHostname,
  platformLoginUrl,
  resolvedTenantUrl,
  tenantAccessDecision,
  tenantWorkspaceUrl,
} from './host';

afterEach(() => vi.unstubAllEnvs());

describe('tenant host routing', () => {
  it('separates platform, preview, tenant, and custom-domain hosts', () => {
    expect(classifyTenantHost('portier369.com').kind).toBe('platform');
    expect(classifyTenantHost('www.portier369.com').kind).toBe('www');
    expect(classifyTenantHost('condo-abc-aios2.vercel.app').kind).toBe('platform');
    expect(classifyTenantHost('localhost:3000').kind).toBe('platform');
    expect(classifyTenantHost('stellar.localhost:3000')).toEqual({
      kind: 'subdomain', hostname: 'stellar.localhost', slug: 'stellar',
    });
    expect(classifyTenantHost('stellar.portier369.com')).toEqual({
      kind: 'subdomain', hostname: 'stellar.portier369.com', slug: 'stellar',
    });
    expect(classifyTenantHost('portal.example-management.com')).toEqual({
      kind: 'custom-domain', hostname: 'portal.example-management.com', slug: null,
    });
  });

  it('normalizes ports, case, and trailing dots', () => {
    expect(normalizeHostname('STELLAR.Portier369.com.:443')).toBe('stellar.portier369.com');
    expect(normalizeHostname('[::1]:3000')).toBe('::1');
  });

  it('uses a tenant subdomain only from the production apex origin', () => {
    expect(tenantWorkspaceUrl('stellar', '/portal', 'https://portier369.com'))
      .toBe('https://stellar.portier369.com/portal');
    expect(tenantWorkspaceUrl('stellar', '/portal', 'https://condo-preview-aios2.vercel.app'))
      .toBe('https://condo-preview-aios2.vercel.app/portal');
    expect(tenantWorkspaceUrl('Not Valid', '/portal', 'https://portier369.com'))
      .toBe('https://portier369.com/portal');
  });

  it('uses the canonical tenant host for custom-domain auth callbacks', () => {
    expect(resolvedTenantUrl({ hostname: 'portal.example.com', slug: 'example' }, '/api/auth/callback'))
      .toBe('https://example.portier369.com/api/auth/callback');
    expect(resolvedTenantUrl({ hostname: 'example.portier369.com', slug: 'example' }, '/api/auth/callback'))
      .toBe('https://example.portier369.com/api/auth/callback');
  });

  it('keeps platform escape links local during tenant development', () => {
    expect(platformLoginUrl('unknown.localhost:3100')).toBe('http://localhost:3100/login');
    expect(platformLoginUrl('stellar.portier369.com', '/login?mode=admin'))
      .toBe('https://portier369.com/login?mode=admin');
  });
});

describe('tenant access decisions', () => {
  it('allows the matching company and legacy apex requests', () => {
    expect(tenantAccessDecision(null, { is_platform_operator: false, portfolio: null })).toEqual({ allowed: true });
    expect(tenantAccessDecision('p1', { is_platform_operator: false, portfolio: { id: 'p1' } })).toEqual({ allowed: true });
  });

  it('rejects cross-company identities and platform operators on tenant hosts', () => {
    expect(tenantAccessDecision('p1', null))
      .toEqual({ allowed: false, reason: 'portfolio_mismatch' });
    expect(tenantAccessDecision('p2', { is_platform_operator: false, portfolio: { id: 'p1' } }))
      .toEqual({ allowed: false, reason: 'portfolio_mismatch' });
    expect(tenantAccessDecision('p1', { is_platform_operator: true, portfolio: { id: 'p1' } }))
      .toEqual({ allowed: false, reason: 'platform_operator_on_tenant' });
  });
});
