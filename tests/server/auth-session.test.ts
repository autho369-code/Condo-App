import { describe, expect, it } from 'vitest';
import { isStaleAuthSession, isSupabaseAuthCookie } from '@/lib/server/auth-session';

describe('stale auth session recovery', () => {
  it('recognizes revoked and rotated refresh-token failures', () => {
    expect(isStaleAuthSession({ code: 'refresh_token_not_found' })).toBe(true);
    expect(isStaleAuthSession({ code: 'refresh_token_already_used' })).toBe(true);
    expect(isStaleAuthSession({ code: 'session_not_found' })).toBe(true);
    expect(isStaleAuthSession({ code: 'session_expired' })).toBe(true);
    expect(isStaleAuthSession({ message: 'Invalid Refresh Token: Refresh Token Not Found' })).toBe(true);
    expect(isStaleAuthSession({ code: 'bad_jwt' })).toBe(false);
    expect(isStaleAuthSession(null)).toBe(false);
  });

  it('only expires Supabase auth-token cookies', () => {
    expect(isSupabaseAuthCookie('sb-termxngysvotnfbzbgrv-auth-token')).toBe(true);
    expect(isSupabaseAuthCookie('sb-termxngysvotnfbzbgrv-auth-token.0')).toBe(true);
    expect(isSupabaseAuthCookie('sb-termxngysvotnfbzbgrv-auth-token-code-verifier')).toBe(true);
    expect(isSupabaseAuthCookie('theme')).toBe(false);
    expect(isSupabaseAuthCookie('sb-unrelated')).toBe(false);
  });
});
