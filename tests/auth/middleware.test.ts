import { describe, expect, it } from 'vitest';
import { isPublicPath } from '@/lib/supabase/middleware';

describe('middleware public paths', () => {
  it('keeps the marketing root public without making every route public', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/dashboard')).toBe(false);
    expect(isPublicPath('/associations')).toBe(false);
  });

  it('allows auth callback and auth pages', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/signup')).toBe(true);
    expect(isPublicPath('/api/auth/callback')).toBe(true);
  });
});
