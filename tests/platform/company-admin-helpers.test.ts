import { describe, expect, it } from 'vitest';
import { validatePlatformRequest, PLATFORM_REQUEST_ADMIN_COLUMNS } from '@/lib/company-admin/platform-requests';
import { normalizeCompanySettingsInput, safeHttpUrl } from '@/lib/company-admin/settings';
import { effectiveManagerScope } from '@/lib/company-admin/manager-scope';
import { addDaysToDate, addMonthsToMonth } from '@/lib/time/zoned';

describe('validatePlatformRequest', () => {
  const ok = { request_type: 'more_doors', priority: 'high', subject: '  Need 50 doors ', description: 'Growing.' };

  it('accepts a known type and priority and trims text', () => {
    expect(validatePlatformRequest(ok)).toEqual({ request_type: 'more_doors', priority: 'high', title: 'Need 50 doors', description: 'Growing.' });
  });

  it('rejects missing fields, unknown types and priorities', () => {
    expect(validatePlatformRequest({ ...ok, subject: '   ' })).toEqual({ error: 'All fields are required.' });
    expect(validatePlatformRequest({ ...ok, request_type: 'grant_platform_operator' })).toHaveProperty('error');
    expect(validatePlatformRequest({ ...ok, priority: 'critical' })).toHaveProperty('error');
  });

  it('caps subject and description length', () => {
    expect(validatePlatformRequest({ ...ok, subject: 'x'.repeat(201) })).toHaveProperty('error');
    expect(validatePlatformRequest({ ...ok, description: 'x'.repeat(5001) })).toHaveProperty('error');
  });

  it('never exposes operator-only columns to company admins', () => {
    expect(PLATFORM_REQUEST_ADMIN_COLUMNS).not.toContain('internal_notes');
    expect(PLATFORM_REQUEST_ADMIN_COLUMNS).not.toContain('assigned_to');
    expect(PLATFORM_REQUEST_ADMIN_COLUMNS).not.toContain('*');
  });
});

describe('normalizeCompanySettingsInput', () => {
  it('accepts http(s) logo URLs and known manager defaults', () => {
    expect(normalizeCompanySettingsInput({ logo_url: 'https://cdn.example.com/logo.png', default_role: 'assistant_manager', default_permissions: 'elevated' }))
      .toEqual({ logoUrl: 'https://cdn.example.com/logo.png', managerDefaults: { role: 'assistant_manager', permissions: 'elevated' } });
  });

  it('defaults blanks', () => {
    expect(normalizeCompanySettingsInput({ logo_url: '', default_role: null, default_permissions: '' }))
      .toEqual({ logoUrl: null, managerDefaults: { role: 'manager', permissions: 'standard' } });
  });

  it('rejects script URLs and unknown role/permission values', () => {
    expect(normalizeCompanySettingsInput({ logo_url: 'javascript:alert(1)', default_role: 'manager', default_permissions: 'standard' })).toHaveProperty('error');
    expect(normalizeCompanySettingsInput({ logo_url: '', default_role: 'company_admin', default_permissions: 'standard' })).toHaveProperty('error');
    expect(normalizeCompanySettingsInput({ logo_url: '', default_role: 'manager', default_permissions: 'superuser' })).toHaveProperty('error');
    expect(safeHttpUrl('data:image/png;base64,AAAA')).toBeNull();
  });
});

describe('effectiveManagerScope', () => {
  const portfolio = ['a1', 'a2', 'a3'];

  it('treats no assignments as full portfolio access', () => {
    expect(effectiveManagerScope([], portfolio)).toEqual({ associationIds: portfolio, fullAccess: true });
  });

  it('keeps only assigned associations that are still in the portfolio', () => {
    expect(effectiveManagerScope(['a2', 'a2', 'archived'], portfolio)).toEqual({ associationIds: ['a2'], fullAccess: false });
  });

  it('stays scoped (not full access) when every assignment is archived', () => {
    expect(effectiveManagerScope(['archived'], portfolio)).toEqual({ associationIds: [], fullAccess: false });
  });
});

describe('calendar date math', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDate('2026-10-04', 60)).toBe('2026-12-03');
    expect(addDaysToDate('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('shifts months across years', () => {
    expect(addMonthsToMonth('2026-03', -5)).toBe('2025-10');
    expect(addMonthsToMonth('2026-12', 1)).toBe('2027-01');
  });

  it('rejects malformed input', () => {
    expect(() => addDaysToDate('10/04/2026', 1)).toThrow();
    expect(() => addMonthsToMonth('2026-3', 1)).toThrow();
  });
});
