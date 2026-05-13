import { describe, expect, it } from 'vitest';
import { canonicalReportSlug, reportHrefFromSlugParam, withReportError } from '@/lib/reports/routing';

describe('report routing helpers', () => {
  it('normalizes legacy hyphen report slugs to database slugs', () => {
    expect(canonicalReportSlug('bank-reconciliation')).toBe('bank_reconciliation');
    expect(canonicalReportSlug(' ar-aging ')).toBe('ar_aging');
    expect(canonicalReportSlug('homeowner-directory')).toBe('homeowner_directory');
  });

  it('builds canonical report detail URLs from slug query params', () => {
    expect(reportHrefFromSlugParam('annual-budget-comparison')).toBe('/reports/annual_budget_comparative');
    expect(reportHrefFromSlugParam('')).toBeNull();
  });

  it('adds an error message to an existing return URL', () => {
    expect(withReportError('/reports/balance_sheet?preset=ytd', 'Report scope is required')).toBe(
      '/reports/balance_sheet?preset=ytd&error=Report+scope+is+required',
    );
  });
});
