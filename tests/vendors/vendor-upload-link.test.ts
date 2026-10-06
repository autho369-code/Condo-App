import { afterEach, describe, expect, it, vi } from 'vitest';

const queued: any[] = [];
vi.mock('@/lib/email/queue', () => ({
  queueEmails: async (_db: unknown, emails: any[]) => { queued.push(...emails); return { error: null, count: emails.length }; },
}));

afterEach(() => { queued.length = 0; vi.unstubAllEnvs(); });

const svcWith = (slug: string | null) => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: slug ? { slug } : null, error: null }) }) }) }),
});

const request = {
  to: 'vendor@example.com', vendorName: 'Ace Plumbing', companyName: 'Stellar Property Group', docType: 'w9',
  token: 'tok123', portfolioId: 'p1', requestId: 'r1', attempt: 'initial',
};

describe('vendor document request email', () => {
  it("links to the upload page on the company's own address", async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://portier369.com');
    const { emailVendorRequest } = await import('../../lib/vendors/document-requests');
    await emailVendorRequest(svcWith('stellar'), request);
    expect(queued[0].text).toContain('https://stellar.portier369.com/vendor-upload/tok123');
  });

  it('falls back to the platform address when the company address is unknown', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://portier369.com');
    const { emailVendorRequest } = await import('../../lib/vendors/document-requests');
    await emailVendorRequest(svcWith(null), request);
    expect(queued[0].text).toContain('https://portier369.com/vendor-upload/tok123');
  });
});
