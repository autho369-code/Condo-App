import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'app/(app)/reports/[slug]/page.tsx'), 'utf8');

describe('financial report drill-down', () => {
  it('links trial balance, balance sheet, income statement and cash flow amounts to the ledger', () => {
    expect(page.match(/<DrillLink href=\{glDrillHref\(/g)?.length).toBe(4);
  });

  it('balance sheet drills from inception to the as-of date', () => {
    expect(page).toContain('glDrillHref(a.id, { period, selectedAssociation }, true)');
    expect(page).toContain("from: sinceInception ? '1900-01-01' : ctx.period.from");
  });

  it('general ledger filters by a validated account id', () => {
    expect(page).toContain("selectedAccount: /^[0-9a-f-]{36}$/i.test(sp.account ?? '')");
    expect(page).toContain("lineQuery = lineQuery.eq('gl_account_id', selectedAccount)");
    const gl = page.slice(page.indexOf('async function GeneralLedgerView'));
    expect(gl).toContain("glAccountQuery = glAccountQuery.eq('id', selectedAccount)");
  });
});
