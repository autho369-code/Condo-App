import { describe, expect, it } from 'vitest';

import { isActiveProfile } from '@/lib/security/portal-access';

describe('disabled profile access', () => {
  it('allows only an existing profile without a disabled timestamp', () => {
    expect(isActiveProfile({ disabled_at: null })).toBe(true);
    expect(isActiveProfile({})).toBe(true);
    expect(isActiveProfile({ disabled_at: '2026-07-28T00:00:00.000Z' })).toBe(false);
    expect(isActiveProfile(null)).toBe(false);
    expect(isActiveProfile(undefined)).toBe(false);
  });
});

