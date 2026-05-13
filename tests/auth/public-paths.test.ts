import { describe, expect, it } from 'vitest';

import { isPublicPath } from '@/lib/auth/public-paths';

describe('public auth paths', () => {
  it('treats only the exact homepage as public', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/dashboard')).toBe(false);
    expect(isPublicPath('/portal')).toBe(false);
    expect(isPublicPath('/platform/users')).toBe(false);
  });

  it('allows auth pages and callback paths', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/login/help')).toBe(true);
    expect(isPublicPath('/api/auth/callback')).toBe(true);
    expect(isPublicPath('/api/auth/callback/provider')).toBe(true);
  });
});
