import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireStaff: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, createServiceClient: vi.fn() }));
vi.mock('@/lib/auth/me', () => ({ requireStaff: mocks.requireStaff }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { updateManagementAgreement } from '@/lib/rpcs/management-agreements';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const SQL = read('supabase/migrations/20261016200000_gl_close_fixes.sql');

/** The body of one `create or replace function public.<name>(` in the migration. */
function fn(name: string) {
  const start = SQL.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} is in the migration`).toBeGreaterThanOrEqual(0);
  const end = SQL.indexOf('$function$;', start);
  return SQL.slice(start, end);
}

describe('gl close fixes migration', () => {
  it('only database functions write lockbox, recurring templates and the management-fee ledger', () => {
    for (const table of ['lockbox_batches', 'lockbox_items', 'recurring_journal_entries', 'management_fees']) {
      expect(SQL).toContain(`revoke insert, update, delete on public.${table} from anon, authenticated;`);
    }
  });

  it('posts a lockbox check only to a unit of the batch association and records the current owner', () => {
    const body = fn('post_lockbox_batch');
    expect(body).toMatch(/bl\.association_id = b\.association_id and u\.archived_at is null/);
    // Access is checked before the batch is locked.
    expect(body.indexOf('can_manage_association(b.association_id)')).toBeLessThan(body.indexOf('where id = p_batch for update'));
    expect(body).toMatch(/occ\.status = 'current' and occ\.occupancy_type = 'owner'/);
    expect(body).toMatch(/set payment_id = v_payment, owner_id = v_owner/);
    // The batch stays locked and a posted check (payment_id set) is never posted again.
    expect(body).toMatch(/from public\.lockbox_batches where id = p_batch for update/);
    expect(body).toMatch(/payment_id is null and unit_id is not null and check_amount_cents > 0/);
    // The middle dot in the receipt note is written with chr() (no non-ASCII in SQL).
    expect(body).toContain("chr(183)");
  });

  it('posts a recurring journal entry once per template and date', () => {
    const body = fn('generate_recurring_journal_entries_through');
    expect(body).toMatch(/if not exists \(select 1 from public\.journal_entries je\s+where je\.source_type = 'recurring_je' and je\.source_id = t\.id and je\.portfolio_id = t\.portfolio_id\s+and je\.entry_date = v_date and je\.posted and je\.reversed_by_entry_id is null\)/);
    // The date still advances when a date is skipped.
    expect(body.indexOf('v_date := public.recurring_next_date')).toBeGreaterThan(body.indexOf('end if;'));
  });

  it('dates a default reversal and a loan-payment void by the association calendar', () => {
    const reverse = fn('reverse_journal_entry');
    expect(reverse).toMatch(/coalesce\(p_reversal_date, case when v_assoc is not null then public\.association_local_date\(v_assoc, now\(\)\) end, current_date\)/);
    // A reversed entry still can't be reversed again.
    expect(reverse).toContain("if e.reversed_by_entry_id is not null then raise exception 'This entry is already reversed'");
    const voidLoan = fn('void_loan_payment');
    expect(voidLoan).toMatch(/coalesce\(public\.association_local_date\(p\.association_id, now\(\)\), current_date\)/);
    expect(voidLoan).not.toMatch(/values \(p\.portfolio_id, current_date,/);
  });

  it('keeps used GL accounts from changing type, association or company, or being deleted', () => {
    const helper = fn('app_gl_account_referenced');
    expect(helper).toContain("c.confrelid = 'public.gl_accounts'::regclass");
    expect(helper).toContain("'public.gl_account_role_permissions'::regclass");
    expect(SQL).toContain('revoke all on function public.app_gl_account_referenced(uuid) from public, anon, authenticated;');

    const guard = fn('guard_gl_account_change');
    expect(guard).toMatch(/and not public\.app_is_repair_session\(\)\s+and public\.app_gl_account_referenced\(old\.id\)/);
    expect(guard).toMatch(/new\.portfolio_id is distinct from old\.portfolio_id\)\s+and exists \(select 1 from public\.journal_lines/);

    const del = fn('guard_gl_account_delete');
    expect(del).toContain('if public.app_is_repair_session() then');
    expect(del).toContain('public.app_gl_account_referenced(old.id)');
    expect(SQL).toMatch(/create or replace trigger trg_guard_gl_account_delete\s+before delete on public\.gl_accounts/);
  });

  it('keeps company-wide GL and management-fee defaults with company-wide finance staff', () => {
    expect(fn('set_gl_account_map')).toMatch(/if public\.manager_is_scoped\(\) is true and not public\.is_company_admin\(\) and not public\.is_platform_operator\(\) then\s+raise exception 'GL account defaults apply to the whole company/);
    const run = fn('run_management_fees');
    expect(run).toMatch(/if not \(public\.manager_is_scoped\(\) is true and not public\.is_company_admin\(\)\) then\s+update public\.portfolios set management_fee_vendor_id/);
    // Management fees still go only through the shared billing function (management-company vendor check).
    expect(run).toContain("public.app_bill_management_fees(v_pid, p_month, v_ids, p_vendor_id, p_gl_account_id, p_bill_date, auth.uid(), 'manual')");
  });

  it('freezes a finalized year-end package except for superseding it', () => {
    const guard = fn('guard_year_end_package');
    for (const col of ['notes', 'association_id', 'portfolio_id', 'fiscal_year', 'generated_by', 'finalized_by']) {
      expect(guard).toContain(`new.${col} is distinct from old.${col}`);
    }
    expect(guard).toMatch(/old\.status = 'finalized' and new\.status not in \('finalized', 'superseded'\)/);
    expect(guard).toContain('new.supersede_reason is distinct from old.supersede_reason');
    // A signature request can still be attached after finalizing.
    expect(guard).not.toContain('signature_request_id');
  });

  it('stops owners reading management agreements by email match', () => {
    expect(SQL).toMatch(/alter policy "Owners read own agreements" on public\.management_agreements\s+to authenticated\s+using \(false\);/);
  });

  it('is ASCII only and has no bare DELETE or DROP', () => {
    expect(/[^\x00-\x7F]/.test(SQL)).toBe(false);
    expect(SQL).not.toMatch(/^\s*drop\s/im);
    expect(SQL).not.toMatch(/delete from [a-z_.]+\s*;/i);
  });
});

describe('updateManagementAgreement', () => {
  const AGREEMENT = '11111111-1111-4111-8111-111111111111';
  const ASSOC = '22222222-2222-4222-8222-222222222222';
  let rpc: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;

  function chain(row: unknown) {
    const q: any = {};
    for (const m of ['select', 'eq', 'is']) q[m] = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => ({ data: row, error: null }));
    return q;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({ portfolio: { id: 'pf' }, auth_user_id: 'u1' });
    rpc = vi.fn(async () => ({ data: false, error: null }));
    update = vi.fn();
    mocks.createClient.mockResolvedValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === 'management_agreements') {
          const q = chain({ id: AGREEMENT, terms: {} });
          q.update = update;
          return q;
        }
        return chain({ id: ASSOC });
      }),
    });
  });

  function form(extra: Record<string, string> = {}) {
    const fd = new FormData();
    const values: Record<string, string> = { id: AGREEMENT, name: 'Agreement', status: 'active', start_date: '2026-01-01', association_id: ASSOC, ...extra };
    for (const [k, v] of Object.entries(values)) fd.set(k, v);
    return fd;
  }

  it('refuses an association in the company that the caller does not manage', async () => {
    await expect(updateManagementAgreement(form())).rejects.toThrow(/REDIRECT:.*error=Association%20is%20outside%20your%20access/);
    expect(rpc).toHaveBeenCalledWith('can_manage_association', { p_association_id: ASSOC });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses an association that the agreement owner does not belong to', async () => {
    const OWNER = '33333333-3333-4333-8333-333333333333';
    rpc.mockResolvedValue({ data: true, error: null });
    mocks.createClient.mockResolvedValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === 'management_agreements') {
          const q = chain({ id: AGREEMENT, terms: {}, owner_id: OWNER });
          q.update = update;
          return q;
        }
        if (table === 'owners') return chain({ id: OWNER, association_id: 'another-association' });
        return chain({ id: ASSOC });
      }),
    });
    await expect(updateManagementAgreement(form())).rejects.toThrow(/REDIRECT:.*not%20in%20this%20association/);
    expect(update).not.toHaveBeenCalled();
  });
});
