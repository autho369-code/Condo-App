import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LIVE_EXPORT_SLUGS, supportsLiveExport } from '@/lib/reports/live-export';

describe('audited live report exports', () => {
  it('advertises the core accounting exports implemented by the worker', () => {
    expect(LIVE_EXPORT_SLUGS).toEqual([
      'trial_balance',
      'balance_sheet',
      'income_statement',
      'general_ledger',
    ]);
    for (const slug of LIVE_EXPORT_SLUGS) expect(supportsLiveExport(slug)).toBe(true);
    expect(supportsLiveExport('cash_flow')).toBe(false);
  });

  it('keeps the report rail allowlist aligned with the worker', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(app)/reports/[slug]/page.tsx'),
      'utf8',
    );
    for (const slug of LIVE_EXPORT_SLUGS) {
      expect(page).toContain(`'${slug}'`);
    }
    expect(page).toContain('const exportEnabled = supportsLiveExport');
  });

  it('uses account types rather than account-number bands for the income statement', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(app)/reports/[slug]/page.tsx'),
      'utf8',
    );
    expect(page).toContain("financialSection(account) === 'income'");
    expect(page).toContain("financialSection(account) === 'expense'");
    expect(page).not.toContain('const classifyIS =');
  });

  it('limits balance-sheet current-year earnings to the report year', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(app)/reports/[slug]/page.tsx'),
      'utf8',
    );
    const exporter = readFileSync(
      resolve(process.cwd(), 'lib/reports/live-export.ts'),
      'utf8',
    );
    expect(page).toContain("const currentYearStart = \`\${period.to.slice(0, 4)}-01-01\`");
    expect(exporter).toContain("const currentYearStart = \`\${dateTo.slice(0, 4)}-01-01\`");
    expect(exporter).toContain('netIncome(accounts, currentYearTotals)');
  });
});
