import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = (name: string) => readFileSync(join(root, 'supabase', 'migrations', name), 'utf8');

describe('competitive workflow security boundaries', () => {
  it('withholds draft reserve studies and child assumptions from board RLS', () => {
    const sql = migration('20260801040000_capital_reserve_planning.sql');
    expect(sql).toContain("and status in ('board_review', 'approved')");
    expect(sql).toContain('where study.id = reserve_components.study_id');
    expect(sql).toContain('where study.id = reserve_funding_scenarios.study_id');
  });

  it('treats every transition out of closed as an audited reopening', () => {
    const sql = migration('20260801042000_accounting_period_management.sql');
    expect(sql).toContain("period_row.status = 'closed' and p_status <> 'closed'");
    expect(sql).toContain("reopened_at = case when period_row.status = 'closed' and p_status <> 'closed' then now()");
    expect(sql).toContain("reopened_by = case when period_row.status = 'closed' and p_status <> 'closed' then auth.uid()");
  });

  it('keeps arbitrary webhook dispatch and key verification service-only', () => {
    const sql = migration('20260801041000_secure_webhook_dispatch.sql');
    expect(sql).toMatch(/dispatch_webhook[\s\S]*from public, anon, authenticated/);
    expect(sql).toMatch(/verify_api_key[\s\S]*from public, anon, authenticated/);
  });
});
