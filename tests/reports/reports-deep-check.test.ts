import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, createServiceClient: vi.fn() }));
vi.mock('@/lib/auth/me', () => ({ requireStaff: mocks.requireStaff }));

import { GET as downloadRun } from '@/app/(app)/reports/runs/[id]/download/route';
import { fiscalYearStartDate } from '@/lib/reports/financial';
import { loadUnappliedCredits, outstandingReceivables } from '@/lib/reports/receivables';
import { reportRunDownloadPath, reportRunFileName, reportRunStoragePath } from '@/lib/reports/run-files';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const MIGRATION = read('supabase/migrations/20261016100000_reports_fixes.sql');
const fn = (name: string) => {
  const start = MIGRATION.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} is replaced`).toBeGreaterThanOrEqual(0);
  const end = MIGRATION.indexOf('$function$;', start);
  return MIGRATION.slice(start, end);
};

const RUN = '11111111-1111-4111-8111-111111111111';
const PF = '22222222-2222-4222-8222-222222222222';

describe('reports migration: access', () => {
  it('limits user and sign-in reports to company admins and full-access staff', () => {
    const body = fn('report_params_access_error');
    expect(body).toContain("v_slug in ('users', 'users_and_permissions', 'user_roles_permissions', 'login_audit')");
    expect(body).toContain('public.is_full_access_staff() or public.is_company_admin() or public.is_platform_operator()');
    // The existing rules stay: company access, finance-only, scoped managers.
    expect(body).toContain('public.can_access_portfolio(p_portfolio_id)');
    expect(body).toContain('public.can_manage_finance(p_portfolio_id)');
    expect(body).toContain('Choose one of your associations for this report.');
  });

  it('lists staff accounts only in the permission reports', () => {
    for (const name of ['report_data_users_and_permissions', 'report_data_user_roles_permissions']) {
      expect(fn(name)).toContain("p.hoa_role::text in ('manager', 'company_admin')");
    }
  });
});

describe('reports migration: scheduled report recipients', () => {
  it('allows only active staff of the company whose own access passes the report rule', () => {
    const body = fn('report_allowed_recipients');
    expect(body).toContain('p.portfolio_id = p_portfolio_id');
    expect(body).toContain('p.disabled_at is null');
    expect(body).toContain("p.hoa_role::text in ('manager', 'company_admin')");
    expect(body).toContain('public.report_access_error_as(v_profile_id, p_portfolio_id, p_slug, p_params)');
    expect(body).toContain('lower(btrim(t.value))');
  });

  it('checks recipients when a schedule is saved', () => {
    const guard = fn('guard_scheduled_report_change');
    expect(guard).toContain("new.delivery_channel::text = 'email'");
    expect(guard).toContain('new.delivery_targets, new.delivery_channel, new.output_format)');
    expect(guard).toContain('public.report_recipients_error(new.portfolio_id, v_slug');
    // Still a plain trigger function that skips trusted (definer) writers.
    expect(guard).not.toContain('security definer');
    expect(guard).toContain("if current_user not in ('authenticated', 'anon') then return new; end if;");
  });

  it('makes a saved or resumed schedule run as the person who saved it, after re-checking access', () => {
    const guard = fn('guard_scheduled_report_change');
    expect(guard).toContain('(old.active is not true and new.active is true)');
    expect(guard).toContain('new.local_hour, new.hour_utc, new.time_zone)');
    // "Run now" only moves next_run_at; it must not take the schedule over.
    expect(guard).not.toContain('new.next_run_at');
    expect(guard).toMatch(/if v_takeover then\s+new\.run_as := auth\.uid\(\);/);
    expect(guard).toMatch(/if v_takeover then\s+if new\.saved_report_id is not null/);
  });

  it('counts distinct recipients and does not say which access rule a recipient failed', () => {
    const check = fn('report_recipients_error');
    expect(check).toContain('volatile security definer');
    expect(check).toContain('count(distinct lower(btrim(t.value)))');
    expect(fn('report_allowed_recipients')).toContain("format('%s is not allowed to receive this report.', v_target)");
  });

  it('rewrites stored storage links to the sign-in download route', () => {
    expect(MIGRATION).toContain("set output_url = '/reports/runs/' || id || '/download'");
    expect(MIGRATION).toContain("where output_url like '%/object/sign/%'");
  });

  it('re-checks recipients for every delivery', () => {
    const body = fn('scheduled_report_delivery_recipients');
    expect(body).toContain("v.status <> 'succeeded'");
    expect(body).toContain('where a.error is null');
  });

  it('keeps the impersonating helpers service-only', () => {
    for (const sig of [
      'report_access_error_as(uuid, uuid, text, jsonb)',
      'report_allowed_recipients(uuid, text, jsonb, jsonb)',
      'scheduled_report_delivery_recipients(uuid)',
    ]) {
      expect(MIGRATION).toContain(`revoke all on function public.${sig} from public, anon, authenticated;`);
      expect(MIGRATION).toContain(`grant execute on function public.${sig} to service_role;`);
    }
    expect(MIGRATION).toContain('revoke all on function public.report_recipients_error(uuid, text, jsonb, jsonb) from public, anon;');
    expect(fn('report_recipients_error')).toContain("return 'You no longer have access to this company.'");
  });

  it('puts the caller claims back after evaluating as another user', () => {
    const body = fn('report_access_error_as');
    expect(body).toContain("perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);");
    expect(body).toContain("perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);");
  });

  it('pauses a schedule whose run-as user lost access, with one failed run', () => {
    const body = fn('enqueue_scheduled_reports');
    expect(body).toContain('public.report_access_error_as(v_run_as, row.portfolio_id, row.report_slug');
    expect(body).toContain("'failed', row.parameters, row.output_format, v_run_as, now(), now()");
    expect(body).toContain('set active = false');
  });
});

describe('reports migration: dates and fund statements', () => {
  it('defaults "today" to the association local date', () => {
    const body = fn('rpt_prm');
    expect(body).toContain('language plpgsql');
    expect(body).toContain('public.association_local_date(aid)');
    expect(body).toContain("date_trunc('year', dt)::date");
    expect(body).not.toContain('current_date');
    for (const name of ['report_data_insurance_expiration_dates', 'report_data_owner_insurance_audit', 'report_data_open_work_orders']) {
      expect(fn(name)).not.toContain('current_date');
      expect(fn(name)).toContain('public.association_local_date(a.id)');
    }
  });

  it('ties each fund out with the interfund balance and counts surplus as equity', () => {
    expect(fn('report_data_fund_balance_sheet')).toContain("'Interfund balance (due to / from other funds)'");
    const active = fn('report_data_fund_balance_sheet_active_funds');
    expect(active).toContain('as interfund_balance');
    expect(active).toContain("select coalesce(g.fund_account::text,'unassigned'), 'equity', sum(jl.credit_amount - jl.debit_amount)");
  });

  it('is additive', () => {
    expect(MIGRATION).not.toMatch(/\bdrop\s+(table|function|policy|trigger)\b/i);
    expect(MIGRATION).not.toMatch(/\bdelete\s+from\b/i);
  });
});

describe('fiscal year start', () => {
  it('starts the current year at the fiscal year start month', () => {
    expect(fiscalYearStartDate('2026-10-14', 1)).toBe('2026-01-01');
    expect(fiscalYearStartDate('2026-10-14', 7)).toBe('2026-07-01');
    expect(fiscalYearStartDate('2026-03-31', 7)).toBe('2025-07-01');
    expect(fiscalYearStartDate('2026-07-01', 7)).toBe('2026-07-01');
    expect(fiscalYearStartDate('2026-10-14', null)).toBe('2026-01-01');
    expect(fiscalYearStartDate('2026-10-14', 13)).toBe('2026-01-01');
  });
});

describe('report run files', () => {
  it('derives the storage path and a safe file name', () => {
    expect(reportRunDownloadPath(RUN)).toBe(`/reports/runs/${RUN}/download`);
    expect(reportRunStoragePath({ id: RUN, portfolio_id: PF, output_format: 'pdf' })).toBe(`${PF}/${RUN}.pdf`);
    expect(reportRunStoragePath({ id: RUN, portfolio_id: PF, output_format: 'exe' })).toBeNull();
    expect(reportRunFileName('Trial Balance / "Q3"', 'csv', '2026-10-01T12:00:00Z')).toBe('trial-balance-q3-2026-10-01.csv');
  });

  it('links every download to the authenticated route', () => {
    for (const page of ['app/(app)/reports/runs/page.tsx', 'app/(app)/reports/runs/[id]/page.tsx', 'app/(app)/reports/[slug]/page.tsx']) {
      const src = read(page);
      expect(src).toContain('reportRunDownloadPath(');
      expect(src).not.toMatch(/href=\{[a-zA-Z.]*output_url\}/);
    }
  });

  it('emails a sign-in link on the company address to checked recipients only', () => {
    const route = read('app/api/reports/run-scheduled/route.ts');
    expect(route).toContain("svc.rpc('scheduled_report_delivery_recipients', { p_run_id: run.id })");
    expect(route).toContain('companyUrl(run.portfolios, `/reports/runs/${run.id}`)');
    expect(route).not.toContain('${run.output_url}');
    expect(route).not.toContain('delivery_targets');
    expect(route).toContain("owner.portfolio_id !== run.portfolio_id");
  });
});

/** Chainable builder resolving to `result` on await. */
function query(result: { data: unknown; error: unknown }) {
  const q: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'is']) q[m] = vi.fn(() => q);
  q.range = vi.fn(async () => result);
  q.maybeSingle = vi.fn(async () => result);
  return q;
}

describe('download route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({ auth_user_id: 'u' });
  });

  it('streams the file through the signed-in client', async () => {
    const bytes = new TextEncoder().encode('a,b\n1,2\n');
    const download = vi.fn(async () => ({ data: { arrayBuffer: async () => bytes.buffer.slice(0) }, error: null }));
    const runQuery = query({ data: { id: RUN, portfolio_id: PF, status: 'succeeded', output_format: 'csv', finished_at: '2026-10-01T00:00:00Z', report_definitions: { name: 'Owner balance' } }, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => runQuery), storage: { from: vi.fn(() => ({ download })) } });

    const res = await downloadRun(new Request(`http://x/reports/runs/${RUN}/download`), { params: Promise.resolve({ id: RUN }) });
    expect(mocks.requireStaff).toHaveBeenCalled();
    expect(download).toHaveBeenCalledWith(`${PF}/${RUN}.csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('owner-balance-2026-10-01.csv');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.text()).toBe('a,b\n1,2\n');
  });

  it('refuses a run the user cannot see', async () => {
    const runQuery = query({ data: null, error: null });
    const download = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => runQuery), storage: { from: vi.fn(() => ({ download })) } });
    const res = await downloadRun(new Request(`http://x/reports/runs/${RUN}/download`), { params: Promise.resolve({ id: RUN }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(`/reports/runs/${RUN}?error=`);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects a malformed id', async () => {
    mocks.createClient.mockResolvedValue({ from: vi.fn() });
    const res = await downloadRun(new Request('http://x/reports/runs/x/download'), { params: Promise.resolve({ id: '../x' }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/reports?error=');
  });
});

describe('A/R aging credit on file', () => {
  it('lists unapplied credit for the chosen associations and nets it from outstanding', async () => {
    const units = query({ data: [
      { id: 'u1', unit_number: '2', buildings: { association_id: 'a1', associations: { name: 'Elm' } } },
      { id: 'u2', unit_number: '10', buildings: { association_id: 'a1', associations: { name: 'Elm' } } },
    ], error: null });
    const credits = query({ data: [
      { payment_id: 'p1', unit_id: 'u2', payment_date: '2026-09-01', unapplied_amount: 40 },
      { payment_id: 'p2', unit_id: 'u1', payment_date: '2026-09-02', unapplied_amount: '10.5' },
    ], error: null });
    const db = { from: vi.fn((table: string) => (table === 'units' ? units : credits)) };

    const rows = await loadUnappliedCredits(db, ['a1']);
    expect(units.in).toHaveBeenCalledWith('buildings.association_id', ['a1']);
    expect(credits.in).toHaveBeenCalledWith('unit_id', ['u1', 'u2']);
    expect(rows.map((r) => [r.unitNumber, r.unapplied])).toEqual([['2', 10.5], ['10', 40]]);
    expect(outstandingReceivables([100, 25], rows)).toBeCloseTo(74.5);
  });

  it('returns nothing for no associations', async () => {
    const db = { from: vi.fn() };
    expect(await loadUnappliedCredits(db, [])).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
  });
});
