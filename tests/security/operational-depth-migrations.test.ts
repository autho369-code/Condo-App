import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const workflows = readFileSync(join(root, 'supabase/migrations/20260801043000_operational_workflows.sql'), 'utf8').toLowerCase();
const delivery = readFileSync(join(root, 'supabase/migrations/20260801044000_delivery_fulfillment.sql'), 'utf8').toLowerCase();

describe('operational depth migrations', () => {
  it('gives capital projects durable scope and governance gates', () => {
    expect(workflows).toContain('create table if not exists public.capital_projects');
    expect(workflows).toContain('enforce_capital_project_work_order_scope');
    expect(workflows).toContain('guard_capital_project_governance');
    expect(workflows).toContain('old.board_approval_required');
    expect(workflows).toContain('capital_project_financials');
    expect(workflows).toMatch(/board_approval_required[\s\S]*board_approved_at is not null/);
    expect(workflows).toContain('alter table public.capital_projects enable row level security');
  });

  it('records an append-only inspection finding lifecycle', () => {
    expect(workflows).toContain('create table if not exists public.inspection_finding_events');
    expect(workflows).toContain('audit_inspection_finding_lifecycle');
    expect(workflows).toContain("'remediation_linked'");
    expect(workflows).toContain('idx_inspection_items_client_mutation');
  });

  it('enforces full GL permission on authenticated posting writes', () => {
    expect(workflows).toContain('create or replace function public.can_use_gl');
    expect(workflows).toContain('create or replace function public.enforce_gl_use_permission');
    expect(workflows).toContain("grp.permission = 'full'");
    expect(workflows).toContain('trg_journal_lines_gl_permission');
    expect(workflows).toContain('permission_audit_log');
  });

  it('cannot cross the delinquency legal gate without a human admin', () => {
    expect(workflows).toContain('review_delinquency_legal_gate');
    expect(workflows).toContain('only a human portfolio administrator may review legal escalation');
    expect(workflows).toContain("status = case when p_approved then 'approved_for_counsel' else 'on_hold' end");
    expect(workflows).toMatch(/revoke insert, update, delete on public\.delinquency_cases[^;]*from authenticated/);
    expect(delivery).toContain('guard_delinquency_legal_transition');
    expect(delivery).toContain("mail.status = 'delivered'");
    expect(workflows).not.toMatch(/(file_lien|file_lawsuit|submit_legal_action)/);
  });

  it('keeps provider claims service-only and retryable', () => {
    for (const fn of ['claim_sms_messages', 'claim_webhook_deliveries', 'claim_physical_mail']) {
      expect(delivery).toContain(`revoke all on function public.${fn}`);
      expect(delivery).toContain(`grant execute on function public.${fn}`);
    }
    expect(delivery).toContain('for update skip locked');
    expect(delivery).toContain('idempotency_key text not null unique');
    expect(delivery).toMatch(/join public\.sms_opt_ins consent[\s\S]*and consent\.opted_in/);
    expect(delivery).toContain('guard_sms_consent');
    expect(delivery).toContain('create table if not exists public.sms_consent_events');
    expect(delivery).toContain("new.entity_type not in ('owner', 'vendor')");
    expect(delivery).toContain('quarantine_sms_delivery');
    expect(delivery).toContain('apply_twilio_sms_status');
    expect(delivery).toContain("next_attempt_at = 'infinity'::timestamptz");
    expect(delivery).toContain('enforce_physical_mail_scope');
    expect(delivery).toMatch(/physical_mail_staff_insert[\s\S]*and status = 'queued'[\s\S]*and delivered_at is null/);
  });
});
