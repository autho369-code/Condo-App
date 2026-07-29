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
});
