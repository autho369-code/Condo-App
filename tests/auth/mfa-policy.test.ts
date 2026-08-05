import { describe, expect, it } from 'vitest';
import { requiresMfa } from '@/lib/auth/mfa-policy';

function identity(overrides: Record<string, unknown> = {}) {
  return {
    is_platform_operator: false,
    is_company_admin: false,
    is_staff: false,
    profile: null,
    portfolio: null,
    ...overrides,
  } as any;
}

describe('effective MFA policy', () => {
  it('always protects cross-tenant platform operators', () => {
    expect(requiresMfa(identity({ is_platform_operator: true }))).toBe(true);
  });

  it('enforces the company-admin policy independently from the staff policy', () => {
    expect(requiresMfa(identity({
      is_company_admin: true,
      portfolio: { require_mfa_for_admins: true, require_mfa_for_staff: false },
    }))).toBe(true);
    expect(requiresMfa(identity({
      is_company_admin: true,
      portfolio: { require_mfa_for_admins: false, require_mfa_for_staff: true },
    }))).toBe(false);
  });

  it('enforces the staff policy for managers', () => {
    expect(requiresMfa(identity({
      is_staff: true,
      portfolio: { require_mfa_for_admins: false, require_mfa_for_staff: true },
    }))).toBe(true);
  });

  it('honors an explicit per-user requirement for any profiled role', () => {
    expect(requiresMfa(identity({ profile: { mfa_required: true } }))).toBe(true);
  });

  it('does not force MFA on portal identities without an applicable policy', () => {
    expect(requiresMfa(identity({
      profile: { mfa_required: false },
      portfolio: { require_mfa_for_admins: true, require_mfa_for_staff: true },
    }))).toBe(false);
  });
});
