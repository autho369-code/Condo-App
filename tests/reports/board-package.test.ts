import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BOARD_REPORT_SECTIONS, boardPackagePath, isBoardSection, orderSections, previousMonth } from '@/lib/reports/board-package';

describe('board package helpers', () => {
  it('orders chosen sections canonically and drops unknown ones', () => {
    expect(orderSections(['bank_reconciliation', 'balance_sheet', 'payroll'])).toEqual(['balance_sheet', 'bank_reconciliation']);
    expect(isBoardSection('ar_aging')).toBe(true);
    expect(isBoardSection('general_ledger')).toBe(false);
  });

  it('computes the previous calendar month', () => {
    expect(previousMonth(new Date(Date.UTC(2026, 8, 29)))).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(previousMonth(new Date(Date.UTC(2026, 0, 10)))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(previousMonth(new Date(Date.UTC(2028, 2, 1)))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('stores packages under the association prefix, one per period end', () => {
    expect(boardPackagePath('b1', '2026-08-31')).toBe('associations/b1/board-reports/2026-08-31.pdf');
  });
});

describe('board report migration', () => {
  const sql = readFileSync('supabase/migrations/20260929200000_board_report_packages.sql', 'utf8');

  it('allows exactly the sections the UI offers', () => {
    for (const [key] of BOARD_REPORT_SECTIONS) expect(sql).toContain(`'${key}'`);
    expect(sql).toContain("'board_report'");
  });

  it('authorizes settings writes inside the RPC and exposes no direct DML', () => {
    expect(sql).toContain('if not public.can_manage_association(p_association_id)');
    expect(sql).toContain('grant select on public.association_board_report_settings to authenticated;');
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*association_board_report_settings/);
  });

  it('keeps packages off the owner portal unless shared with owners', () => {
    expect(sql).toContain("share_scope text not null default 'board' check (share_scope in ('board', 'owners'))");
  });
});

describe('board report cron', () => {
  it('is cron-secret protected, registered, and skips already published periods', () => {
    const route = readFileSync('app/api/reports/publish-board-packages/route.ts', 'utf8');
    expect(route).toContain('requireCronSecret(request)');
    expect(route).toMatch(/if \(existing\) continue;/);
    expect(readFileSync('vercel.json', 'utf8')).toContain('/api/reports/publish-board-packages');
    expect(readFileSync('lib/server/public-paths.ts', 'utf8')).toContain("'/api/reports/publish-board-packages'");
  });
});
