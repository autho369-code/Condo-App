import { beforeEach, describe, expect, it, vi } from 'vitest';

let invitation: any = null;
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: invitation, error: null }) }) }) }),
  }),
  createClient: async () => ({ rpc: async () => ({ data: null, error: null }) }),
}));

beforeEach(() => { invitation = null; vi.resetModules(); });

describe('invitation page metadata', () => {
  it('carries the inviting company even on the platform address', async () => {
    invitation = { portfolios: { company_name: 'Stellar Property Group' } };
    const { generateMetadata } = await import('../app/invite/page');
    expect(await generateMetadata({ searchParams: Promise.resolve({ token: 't1' }) })).toMatchObject({
      applicationName: 'Stellar Property Group',
      title: { default: 'Stellar Property Group' },
      robots: { index: false, follow: false },
    });
  });

  it('is never indexed, even without a valid invitation', async () => {
    const { generateMetadata } = await import('../app/invite/page');
    expect(await generateMetadata({ searchParams: Promise.resolve({ token: 'nope' }) })).toEqual({
      robots: { index: false, follow: false },
    });
  });
});
