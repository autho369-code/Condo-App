import { describe, expect, it } from 'vitest';

import { tenantUrl } from '@/lib/tenant/resolve';

describe('tenantUrl', () => {
  it('uses the apex tenant route for sign-in links so they do not depend on wildcard DNS', () => {
    expect(tenantUrl('stellar-property-group', '/login')).toBe(
      'https://portier369.com/t/stellar-property-group/login',
    );
  });

  it('keeps tenant paths normalized', () => {
    expect(tenantUrl('stellar-property-group', 'login')).toBe(
      'https://portier369.com/t/stellar-property-group/login',
    );
  });
});
