import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('property groups and management agreements', () => {
  it('property group actions require portfolio admin and scope every write to the portfolio', () => {
    const actions = src('lib/rpcs/property-groups.ts');
    expect(actions.match(/await requirePortfolioAdmin\(\)/g)?.length).toBe(3);
    expect(actions.match(/\.eq\('portfolio_id', portfolioId\)|\.eq\('portfolio_id', me\.portfolio\?\.id\)/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('agreement updates re-check staff access and keep associations inside the portfolio', () => {
    const actions = src('lib/rpcs/management-agreements.ts');
    expect(actions.match(/await requireStaff\(\)/g)?.length).toBe(2);
    expect(actions).toContain(".eq('portfolio_id', portfolioId)");
  });

  it('only renders https agreement document links', () => {
    const page = src('app/(app)/owners/management-agreements/[id]/page.tsx');
    expect(page).toContain('/^https:');
    expect(page).toContain('.test(a.document_url)');
  });
});
