import { beforeEach, describe, expect, it, vi } from 'vitest';

let env: any = null;
let vercel: any = null;
let answer = { cnames: [] as string[], ipv4: [] as string[] };

vi.mock('@/lib/tenant/custom-domain', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    vercelDomainsEnv: () => env,
    vercelDomainStatus: async () => vercel,
    lookupDomain: async () => answer,
  };
});

beforeEach(() => {
  env = null;
  vercel = null;
  answer = { cnames: [], ipv4: [] };
});

describe('customDomainStatus', () => {
  it('asks for the CNAME record while DNS does not point at Vercel', async () => {
    const { customDomainStatus } = await import('./domain-status');
    const s = await customDomainStatus('portal.stellar.com');
    expect(s.label).toBe('DNS not pointed yet');
    expect(s.pendingRecords).toEqual([{ type: 'CNAME', name: 'portal.stellar.com', value: 'cname.vercel-dns.com' }]);
    expect(s.vercelConfigured).toBe(false);
  });

  it('needs no records once the domain is attached, verified and configured', async () => {
    env = { token: 't', projectId: 'p' };
    vercel = { state: 'attached', verified: true, misconfigured: false, verification: [], recommended: { cname: null, ipv4: null } };
    answer = { cnames: ['cname.vercel-dns.com'], ipv4: [] };
    const { customDomainStatus } = await import('./domain-status');
    const s = await customDomainStatus('portal.stellar.com');
    expect(s).toMatchObject({ tone: 'success', label: 'Live', pendingRecords: [] });
  });

  it('adds the ownership record while Vercel has not verified the domain', async () => {
    env = { token: 't', projectId: 'p' };
    vercel = {
      state: 'attached', verified: false, misconfigured: false,
      verification: [{ type: 'TXT', domain: '_vercel.stellar.com', value: 'vc-domain-verify=abc' }],
      recommended: { cname: null, ipv4: null },
    };
    const { customDomainStatus } = await import('./domain-status');
    const s = await customDomainStatus('portal.stellar.com');
    expect(s.label).toBe('Waiting for Vercel verification');
    expect(s.pendingRecords).toContainEqual({ type: 'TXT', name: '_vercel.stellar.com', value: 'vc-domain-verify=abc' });
  });

  it('is not confirmed live when only DNS points at Vercel (no Vercel credentials)', async () => {
    answer = { cnames: ['cname.vercel-dns.com'], ipv4: [] };
    const { customDomainStatus, isConfirmedLive } = await import('./domain-status');
    const s = await customDomainStatus('portal.stellar.com');
    expect(s).toMatchObject({ tone: 'success', label: 'DNS points to Vercel', pendingRecords: [] });
    expect(isConfirmedLive(s)).toBe(false);
  });

  it('is confirmed live once attached and verified with no records missing', async () => {
    env = { token: 't', projectId: 'p' };
    vercel = { state: 'attached', verified: true, misconfigured: false, verification: [], recommended: { cname: null, ipv4: null } };
    const { customDomainStatus, isConfirmedLive } = await import('./domain-status');
    expect(isConfirmedLive(await customDomainStatus('portal.stellar.com'))).toBe(true);
  });
});
