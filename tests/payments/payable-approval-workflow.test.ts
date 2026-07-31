import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve('supabase/migrations/20260730000000_secure_payable_bill_approval_workflow.sql'), 'utf8');
const submissionMigration = readFileSync(resolve('supabase/migrations/20260730001000_require_payable_bill_submission.sql'), 'utf8');
const actions = readFileSync(resolve('lib/rpcs/bills.ts'), 'utf8');
const form = readFileSync(resolve('app/(app)/bills/new/new-bill-form.tsx'), 'utf8');
const detail = readFileSync(resolve('app/(app)/bills/[id]/page.tsx'), 'utf8');

describe('payable bill approval workflow', () => {
  it('makes bill creation and state changes finance-only RPC operations', () => {
    expect(migration).toContain('create or replace function public.create_payable_bill');
    expect(migration).toContain('revoke insert, update, delete on public.payable_bills from authenticated');
    expect(migration).toContain('create trigger trg_validate_payable_bill_integrity');
    expect(migration).toContain("raise exception 'Vendor is outside the bill portfolio or archived'");
    expect(actions).toContain('await requireFinanceStaff()');
    expect(actions).toContain(".rpc('create_payable_bill'");
    expect(form).not.toContain('<option value="approved">');
  });

  it('routes required bills to board voting and blocks premature posting', () => {
    expect(migration).toContain('create or replace function public.request_payable_bill_approval');
    expect(migration).toContain("request_type, title, description");
    expect(migration).toContain("raise exception 'Board approval is not complete'");
    expect(submissionMigration).toContain("raise exception 'Only submitted, unpaid bills can be approved'");
    expect(migration).toContain("raise exception 'No active board approvers are configured'");
    expect(migration).toContain('revoke insert, update, delete on public.approval_decisions from authenticated');
    expect(migration).toContain("raise exception 'Not an eligible voter for this approval request'");
    expect(migration).toContain("raise exception 'This approval request is already finalized'");
    expect(actions).toContain(".rpc('request_payable_bill_approval'");
    expect(detail).toContain('Board approval');
    expect(detail).toContain("approvalRequest?.status === 'approved'");
  });
});
