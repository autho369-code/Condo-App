import { describe, expect, it } from 'vitest';
import { hasPortfolioAdminAccess } from '@/lib/auth/me';

describe('company administrator boundary', () => {
  it('does not treat a property manager as a company administrator', () => {
    expect(hasPortfolioAdminAccess({
      is_company_admin: false,
      is_platform_operator: false,
    })).toBe(false);
  });

  it('allows company administrators and platform operators', () => {
    expect(hasPortfolioAdminAccess({
      is_company_admin: true,
      is_platform_operator: false,
    })).toBe(true);
    expect(hasPortfolioAdminAccess({
      is_company_admin: false,
      is_platform_operator: true,
    })).toBe(true);
  });
});
