import { beforeEach, describe, expect, it, vi } from 'vitest';

let requestHeaders = new Headers();
let meResult: any = { data: null, error: null };

vi.mock('next/headers', () => ({ headers: async () => requestHeaders }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: async () => meResult }) }));

const tenantHeaders = (name: string) => new Headers({
  'x-portfolio-id': 'p1',
  'x-portfolio-name': encodeURIComponent(name),
});

beforeEach(() => {
  requestHeaders = new Headers();
  meResult = { data: null, error: null };
  vi.resetModules();
});

describe('brandedMetadata', () => {
  it("titles the pages with the company's name", async () => {
    const { brandedMetadata } = await import('./metadata');
    expect(brandedMetadata(' Stellar Property Group ')).toMatchObject({
      description: null,
      keywords: null,
      authors: null,
      creator: null,
      title: { template: '%s · Stellar Property Group', default: 'Stellar Property Group' },
      applicationName: 'Stellar Property Group',
      appleWebApp: { title: 'Stellar Property Group' },
    });
  });
});

describe('workspaceMetadata', () => {
  it("uses the company of the address the request came in on", async () => {
    requestHeaders = tenantHeaders('Café Management');
    meResult = { data: { portfolio: { company_name: 'Someone Else' } }, error: null };
    const { workspaceMetadata } = await import('./metadata');
    expect((await workspaceMetadata()).applicationName).toBe('Café Management');
  });

  it("falls back to the signed-in user's company on the platform address", async () => {
    meResult = { data: { portfolio: { company_name: 'Stellar Property Group' } }, error: null };
    const { workspaceMetadata } = await import('./metadata');
    expect((await workspaceMetadata()).applicationName).toBe('Stellar Property Group');
  });

  it('keeps the platform defaults with no company (platform operators)', async () => {
    meResult = { data: { portfolio: null }, error: null };
    const { workspaceMetadata } = await import('./metadata');
    expect(await workspaceMetadata()).toEqual({});
  });
});

describe('signInMetadata', () => {
  it("brands and de-indexes sign-in on a company's address", async () => {
    requestHeaders = tenantHeaders('Stellar Property Group');
    const { signInMetadata } = await import('./metadata');
    expect(await signInMetadata()).toMatchObject({
      applicationName: 'Stellar Property Group',
      robots: { index: false, follow: false },
    });
  });

  it('leaves the platform sign-in alone', async () => {
    meResult = { data: { portfolio: { company_name: 'Stellar Property Group' } }, error: null };
    const { signInMetadata } = await import('./metadata');
    expect(await signInMetadata()).toEqual({});
  });
});

describe('signedInStepMetadata', () => {
  it("uses the signed-in user's company on the platform address, noindexed", async () => {
    meResult = { data: { portfolio: { company_name: 'Stellar Property Group' } }, error: null };
    const { signedInStepMetadata } = await import('./metadata');
    expect(await signedInStepMetadata()).toMatchObject({
      applicationName: 'Stellar Property Group',
      robots: { index: false, follow: false },
    });
  });
});

describe('link-preview image', () => {
  it("points company pages at the company's own preview card", async () => {
    vi.stubEnv('NEXT_PUBLIC_APEX_DOMAIN', 'portier369.com');
    requestHeaders = new Headers({
      'x-portfolio-id': 'p1',
      'x-portfolio-name': encodeURIComponent('Stellar Property Group'),
      'x-portfolio-slug': 'stellar',
      'x-tenant-host': 'stellar.portier369.com',
    });
    const { workspaceMetadata } = await import('./metadata');
    const meta = await workspaceMetadata();
    expect(meta.openGraph).toMatchObject({
      images: [{ url: 'https://stellar.portier369.com/opengraph-image', width: 1200, height: 630, alt: 'HOA & condo management portal' }],
    });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', images: ['https://stellar.portier369.com/opengraph-image'] });
    vi.unstubAllEnvs();
  });

  it("keeps a company's custom domain in the preview image", async () => {
    vi.stubEnv('NEXT_PUBLIC_APEX_DOMAIN', 'portier369.com');
    requestHeaders = new Headers({
      'x-portfolio-id': 'p1',
      'x-portfolio-name': encodeURIComponent('Stellar Property Group'),
      'x-portfolio-slug': 'stellar',
      'x-tenant-host': 'portal.stellarpropertygroup.com',
    });
    const { signInMetadata } = await import('./metadata');
    const meta = await signInMetadata();
    expect(meta.twitter).toMatchObject({ images: ['https://portal.stellarpropertygroup.com/opengraph-image'] });
    vi.unstubAllEnvs();
  });

  it('sets no image for the signed-in fallback on the platform address', async () => {
    meResult = { data: { portfolio: { company_name: 'Stellar Property Group' } }, error: null };
    const { workspaceMetadata } = await import('./metadata');
    const meta = await workspaceMetadata();
    expect((meta.openGraph as any).images).toBeUndefined();
  });
});
