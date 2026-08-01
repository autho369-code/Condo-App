import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteUrl } from '@/lib/url/site-url';

afterEach(() => vi.unstubAllEnvs());

describe('siteUrl', () => {
  it('keeps preview authentication flows on the current Vercel deployment', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'condo-preview-aios2.vercel.app');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://portier369.com');
    expect(siteUrl()).toBe('https://condo-preview-aios2.vercel.app');
  });

  it('uses the configured canonical origin outside previews', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.portier369.com/some/path');
    expect(siteUrl()).toBe('https://www.portier369.com');
  });

  it('falls back safely when configured values are missing or invalid', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'javascript:alert(1)');
    vi.stubEnv('NEXT_PUBLIC_PORTAL_URL', '');
    expect(siteUrl()).toBe('https://portier369.com');
  });
});
