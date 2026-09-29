import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929120000_violation_rules_and_escalation.sql'),
  'utf8',
).toLowerCase();

function body(fn: string) {
  const start = migration.indexOf(`create or replace function public.${fn}(`);
  expect(start, fn).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf('\n$$;', start));
}

describe('violation rules and escalation migration', () => {
  it('scopes every write RPC to staff who can manage the association', () => {
    for (const fn of [
      'save_house_rule', 'archive_house_rule', 'install_starter_house_rules', 'copy_house_rules',
      'save_violation_schedule', 'save_violation_settings', 'open_violation', 'advance_violation',
      'record_violation_hearing', 'resolve_violation',
    ]) {
      const b = body(fn);
      expect(b).toContain('security definer');
      expect(b).toContain('set search_path = pg_catalog, public');
      expect(b).toContain('public.can_manage_violations(');
    }
  });

  it('enforces due process before posting a fine', () => {
    const b = body('advance_violation');
    expect(b).toContain('hearing_required_before_fine');
    expect(b).toContain('hearing_requested_at is not null');
    expect(b).toContain('notice_sent_at is null');
    expect(b).toContain("board_decision = 'dismissed'");
  });

  it('posts fines idempotently to the unit ledger', () => {
    expect(migration).toContain('unique (violation_id, step_order)');
    expect(migration).toContain('charge_id uuid not null unique references public.charges(id)');
    expect(body('advance_violation')).toContain("insert into public.charges");
  });

  it('keeps rule copying inside one portfolio', () => {
    expect(body('copy_house_rules')).toContain('rules can only be copied within one portfolio');
  });

  it('locks direct writes and keeps internal helpers private', () => {
    expect(migration).toContain('revoke insert, update, delete on public.house_rules from authenticated');
    expect(migration).toContain('revoke insert, update, delete on public.violation_followup_steps from authenticated');
    expect(migration).toContain('revoke all on function public.log_violation_event(uuid, text, public.violation_status, boolean) from authenticated');
    expect(migration).toContain('revoke all on function public.violation_schedule(uuid, uuid) from authenticated');
  });
});
