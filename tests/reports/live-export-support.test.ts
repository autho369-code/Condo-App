import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { agingBucket, LIVE_EXPORT_SLUGS, supportsLiveExport } from '@/lib/reports/live-export';

describe('audited live report exports', () => {
  it('advertises the core accounting exports implemented by the worker', () => {
    expect(LIVE_EXPORT_SLUGS).toEqual([
      'trial_balance',
      'balance_sheet',
      'income_statement',
      'general_ledger',
      'ar_aging',
      'ap_aging',
      'aged_payables',
      'aged_payables_summary',
      'budget_vs_actual',
      'budget_vs_actuals',
      'annual_budget_comparative',
      'bank_reconciliation',
      'bank_account_reconciliation',
      'bank_reconciliation_detail',
    ]);
    for (const slug of LIVE_EXPORT_SLUGS) expect(supportsLiveExport(slug)).toBe(true);
    expect(supportsLiveExport('cash_flow')).toBe(false);
  });

  it('assigns payable balances to conventional aging buckets', () => {
    expect(agingBucket(null, '2026-07-28')).toBe('Current');
    expect(agingBucket('2026-07-28', '2026-07-28')).toBe('Current');
    expect(agingBucket('2026-07-27', '2026-07-28')).toBe('1-30');
    expect(agingBucket('2026-06-27', '2026-07-28')).toBe('31-60');
    expect(agingBucket('2026-05-27', '2026-07-28')).toBe('61-90');
    expect(agingBucket('2026-04-01', '2026-07-28')).toBe('90+');
  });

  it('keeps the report rail allowlist aligned with the worker', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(app)/reports/[slug]/page.tsx'),
      'utf8',
    );
    const inlineExportSlugs = [
      'trial_balance',
      'balance_sheet',
      'income_statement',
      'general_ledger',
      'ar_aging',
    ];
    for (const slug of inlineExportSlugs) {
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

  it('uses current schema fields and a worker-safe ledger path for exports', () => {
    const exporter = readFileSync(
      resolve(process.cwd(), 'lib/reports/live-export.ts'),
      'utf8',
    );
    expect(exporter).toContain('reconciliation.ending_book_balance');
    expect(exporter).not.toContain('reconciliation.book_balance');
    expect(exporter).not.toContain("db.rpc('get_budget_vs_actuals'");
    expect(exporter).toContain(".from('budget_lines')");
  });

  it('carries opening balances into chronological general-ledger running balances', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(app)/reports/[slug]/page.tsx'),
      'utf8',
    );
    const exporter = readFileSync(
      resolve(process.cwd(), 'lib/reports/live-export.ts'),
      'utf8',
    );
    expect(page).toContain("lt('journal_entries.entry_date', period.from)");
    expect(page).toContain('Running Balance');
    expect(exporter).toContain("'Opening balance': opening");
    expect(exporter).toContain("'Running balance': running");
  });
});
