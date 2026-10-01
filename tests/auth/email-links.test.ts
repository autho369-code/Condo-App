import { describe, expect, it } from 'vitest';
import { verifiedAuthLink } from '@/lib/auth/email-links';

describe('verifiedAuthLink', () => {
  it('points at /confirm on the redirect host and carries next', () => {
    const link = verifiedAuthLink(
      { properties: { action_link: 'https://x.supabase.co/auth/v1/verify?token=abc', hashed_token: 'h123', verification_type: 'recovery' } },
      'https://acme.portier369.com/api/auth/callback?next=/reset-password',
      'recovery',
    );
    const url = new URL(link);
    expect(url.origin).toBe('https://acme.portier369.com');
    expect(url.pathname).toBe('/confirm');
    expect(url.searchParams.get('token_hash')).toBe('h123');
    expect(url.searchParams.get('type')).toBe('recovery');
    expect(url.searchParams.get('next')).toBe('/reset-password');
  });

  it('uses the fallback type and omits next when absent', () => {
    const url = new URL(verifiedAuthLink({ properties: { hashed_token: 'h1' } }, 'https://portier369.com/api/auth/callback', 'signup'));
    expect(url.searchParams.get('type')).toBe('signup');
    expect(url.searchParams.has('next')).toBe(false);
  });

  it('falls back to the provider link without a hashed token', () => {
    expect(verifiedAuthLink({ properties: { action_link: 'https://p/verify' } }, 'https://portier369.com/x', 'recovery')).toBe('https://p/verify');
  });
});
