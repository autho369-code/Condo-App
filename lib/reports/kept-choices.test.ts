import { describe, expect, it } from 'vitest';
import { keptReportChoices } from '@/lib/reports/kept-choices';

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};
const A = '62344573-04f3-4a39-82d3-a70cbc2f045c';

describe('keptReportChoices', () => {
  it('keeps every valid choice', () => {
    const kept = keptReportChoices(form({
      param_scope: 'association', param_association_id: A, param_unit_id: A,
      param_date_from: '2026-01-01', param_date_to: '2026-03-31', preset: 'ytd',
      account: A, output_format: 'xlsx',
    }));
    expect(Object.fromEntries(kept)).toEqual({
      scope: 'association', association: A, unit: A,
      preset: 'custom', from: '2026-01-01', to: '2026-03-31', account: A, format: 'xlsx',
    });
  });

  it('keeps the preset when no dates were submitted', () => {
    expect(Object.fromEntries(keptReportChoices(form({ preset: 'last_month' })))).toEqual({ preset: 'last_month' });
  });

  it('drops malformed values', () => {
    const kept = keptReportChoices(form({
      param_scope: 'everything', param_association_id: 'x', param_unit_id: '1; drop',
      param_date_from: '2026-1-1', param_date_to: '2026-03-31', preset: 'YTD!',
      account: 'acct', output_format: 'html',
    }));
    expect(kept.toString()).toBe('');
  });
});
