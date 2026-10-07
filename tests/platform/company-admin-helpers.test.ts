import { describe, expect, it } from 'vitest';
import { validatePlatformRequest, PLATFORM_REQUEST_ADMIN_COLUMNS } from '@/lib/company-admin/platform-requests';
import { hasVisibleText, isHexColor, normalizeCompanyLogoUrl, normalizeSupportEmail, normalizeWebsiteUrl, safeHttpUrl } from '@/lib/company-admin/settings';
import { effectiveManagerScope } from '@/lib/company-admin/manager-scope';
import { addDaysToDate, addMonthsToMonth } from '@/lib/time/zoned';
import { vendorComplianceStatus } from '@/lib/company-admin/vendor-compliance';
import { associationHealthScore, computeAssociationHealth, healthStatus } from '@/lib/company-admin/health';
import { collectLoadErrors } from '@/lib/company-admin/load-errors';

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

describe('normalizeCompanyLogoUrl', () => {
  it('accepts http(s) logo URLs', () => {
    expect(normalizeCompanyLogoUrl(' https://cdn.example.com/logo.png ')).toEqual({ logoUrl: 'https://cdn.example.com/logo.png' });
  });

  it('treats blank as clearing the logo', () => {
    expect(normalizeCompanyLogoUrl('')).toEqual({ logoUrl: null });
    expect(normalizeCompanyLogoUrl(null)).toEqual({ logoUrl: null });
  });

  it('rejects script and data URLs', () => {
    expect(normalizeCompanyLogoUrl('javascript:alert(1)')).toHaveProperty('error');
    expect(normalizeCompanyLogoUrl('not a url')).toHaveProperty('error');
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

describe('vendorComplianceStatus', () => {
  const today = '2026-10-04';

  it('is valid through the expiration date itself', () => {
    expect(vendorComplianceStatus({ general_liability_expiration: '2026-10-04' }, today)).toBe('expiring');
    expect(vendorComplianceStatus({ general_liability_expiration: '2026-10-03' }, today)).toBe('expired');
  });

  it('flags documents expiring within the window', () => {
    expect(vendorComplianceStatus({ contract_expiration: '2026-11-03' }, today)).toBe('expiring');
    expect(vendorComplianceStatus({ contract_expiration: '2026-11-04' }, today)).toBe('compliant');
  });

  it('reports vendors with no dates and lets the worst document win', () => {
    expect(vendorComplianceStatus({ name: 'Acme' }, today)).toBe('none');
    expect(vendorComplianceStatus({ contract_expiration: '2027-01-01', workers_comp_expiration: '2026-01-01' }, today)).toBe('expired');
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

describe('association health (shared formula)', () => {
  it('starts at 100 and deducts per open item, clamped to 0', () => {
    expect(associationHealthScore({ open: 0, overdue: 0, emergency: 0, violations: 0 })).toBe(100);
    expect(associationHealthScore({ open: 2, overdue: 1, emergency: 0, violations: 1 })).toBe(100 - 8 - 12 - 6);
    expect(associationHealthScore({ open: 30, overdue: 10, emergency: 5, violations: 10 })).toBe(0);
  });

  it('bands scores into healthy / warning / critical', () => {
    expect(healthStatus(80)).toBe('healthy');
    expect(healthStatus(79)).toBe('warning');
    expect(healthStatus(50)).toBe('warning');
    expect(healthStatus(49)).toBe('critical');
  });

  it('aggregates rows per association and ignores other associations', () => {
    const health = computeAssociationHealth(
      ['a1', 'a2'],
      [
        { association_id: 'a1', scheduled_date: '2026-10-01', priority: 'emergency' },
        { association_id: 'a1', scheduled_date: '2026-10-09', priority: 'normal' },
        { association_id: 'other', scheduled_date: null, priority: 'emergency' },
      ],
      [{ association_id: 'a2' }, { association_id: null }],
      '2026-10-05',
    );
    expect(health.get('a1')).toMatchObject({ open: 2, overdue: 1, emergency: 1, violations: 0 });
    expect(health.get('a2')).toMatchObject({ open: 0, violations: 1, score: 94, status: 'healthy' });
    expect(health.has('other')).toBe(false);
  });
});

describe('collectLoadErrors', () => {
  it('reports Supabase and fetchAllRows errors with their labels', () => {
    expect(collectLoadErrors({
      Owners: { error: { message: 'permission denied' } },
      Units: { error: 'timeout' },
      Fine: { error: null },
      Missing: null,
    })).toEqual(['Owners: permission denied', 'Units: timeout']);
  });
});

describe('branding field checks', () => {
  it('accepts only #RRGGBB brand colors (sent as a request header)', () => {
    expect(isHexColor('#10B981')).toBe(true);
    expect(isHexColor('#abcdef')).toBe(true);
    for (const bad of ['10B981', '#fff', '#10B9811', 'red', '#10B981\r\nX-Evil: 1', '#10B98é']) {
      expect(isHexColor(bad)).toBe(false);
    }
  });

  it('normalizes the public website to an http(s) URL or nothing', () => {
    expect(normalizeWebsiteUrl('  ')).toEqual({ website: null });
    expect(normalizeWebsiteUrl(null)).toEqual({ website: null });
    expect(normalizeWebsiteUrl(' https://acme.example ')).toEqual({ website: 'https://acme.example/' });
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'acme.example']) {
      expect(normalizeWebsiteUrl(bad)).toHaveProperty('error');
    }
  });

  it('accepts a plain support email or nothing', () => {
    expect(normalizeSupportEmail(' ')).toEqual({ email: null });
    expect(normalizeSupportEmail(' help@acme.example ')).toEqual({ email: 'help@acme.example' });
    for (const bad of ['help', 'a@b', 'x@y.z\nBcc: z@q.r', '"Bad" <a@b.c>', 'a b@c.d']) {
      expect(normalizeSupportEmail(bad)).toHaveProperty('error');
    }
  });
});

describe('hasVisibleText', () => {
  it('accepts names with any visible character', () => {
    for (const ok of ['Acme', ' Caf\u00E9 ', '\u00DC', '\u200BAcme\u200B', '1', '\u2764\uFE0F']) expect(hasVisibleText(ok)).toBe(true);
  });
  it('refuses blank, whitespace-only and invisible-only names', () => {
    for (const bad of [null, undefined, '', '   ', '\u00A0\u00A0', '\u200B\u200C\u200D', '\uFEFF', '\u00AD', '\u2060 \u200E', '\uFE0F', '\u034F', '\u{E0100}', '\u3164']) {
      expect(hasVisibleText(bad)).toBe(false);
    }
  });
});
