import { afterEach, describe, expect, it, vi } from 'vitest';

import { roleHome, type MeResult } from '@/lib/auth/me';

function me(overrides: Partial<MeResult>): MeResult {
  return {
    auth_user_id: 'u1',
    email: 'user@example.com',
    profile: null,
    portfolio: null,
    role_name: null,
    is_platform_operator: false,
    is_company_admin: false,
    is_full_access_staff: false,
    is_finance_staff: false,
    is_staff: false,
    is_board: false,
    is_resident: false,
    owner_id: null,
    vendor_id: null,
    board_association_ids: [],
    resident_association_ids: [],
    resident_unit_ids: [],
    ...overrides,
  };
}

describe('roleHome precedence', () => {
  it('routes each role to its own surface', () => {
    expect(roleHome(me({ is_platform_operator: true }))).toBe('/platform-operator');
    expect(roleHome(me({ is_company_admin: true }))).toBe('/company-admin/overview');
    expect(roleHome(me({ is_staff: true }))).toBe('/dashboard');
    expect(roleHome(me({ is_board: true }))).toBe('/board');
    expect(roleHome(me({ vendor_id: 'v1' }))).toBe('/vendor');
    expect(roleHome(me({ owner_id: 'o1' }))).toBe('/portal');
  });

  it('higher-privilege roles win when a user has several', () => {
    // Operator beats everything.
    expect(roleHome(me({ is_platform_operator: true, is_company_admin: true, is_staff: true, owner_id: 'o1' }))).toBe('/platform-operator');
    // Company admin beats staff/board/owner.
    expect(roleHome(me({ is_company_admin: true, is_staff: true, is_board: true, owner_id: 'o1' }))).toBe('/company-admin/overview');
    // A board member who is also an owner lands on the board portal.
    expect(roleHome(me({ is_board: true, owner_id: 'o1' }))).toBe('/board');
  });

  it('falls back to /login when no role matches', () => {
    expect(roleHome(me({}))).toBe('/login');
  });
});

describe('LOCAL_PREVIEW_MODE production kill-switch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws at module load when preview mode is set in production', async () => {
    vi.stubEnv('LOCAL_PREVIEW_MODE', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    await expect(import('@/lib/auth/me')).rejects.toThrow(/LOCAL_PREVIEW_MODE/);
  });

  it('loads normally outside production', async () => {
    vi.stubEnv('LOCAL_PREVIEW_MODE', 'true');
    vi.stubEnv('NODE_ENV', 'test');
    vi.resetModules();
    await expect(import('@/lib/auth/me')).resolves.toBeTruthy();
  });
});
