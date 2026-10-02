import { billingCollectionTotals, glDebitBalances, incomeExpenseTotals } from '@/lib/finance/totals';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN_WORK_ORDER = '("done","completed","billed","closed","cancelled")';
const MONTH_CHOICES = [6, 12];

type Month = { key: string; label: string; from: string; to: string };

/** The last `n` calendar months in `zone`, newest first; the current month ends today. */
function lastMonths(n: number, zone: string): Month[] {
  const today = todayInZone(zone);
  const [y, m] = today.split('-').map(Number);
  const out: Month[] = [];
  for (let i = 0; i < n; i++) {
    const first = new Date(Date.UTC(y, m - 1 - i, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const from = first.toISOString().slice(0, 10);
    const end = last.toISOString().slice(0, 10);
    out.push({
      key: from.slice(0, 7),
      label: first.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      from,
      to: end < today ? end : today,
    });
  }
  return out;
}

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.min(100, (part / whole) * 100) : null;
}

/** Change from last month, shown under a tile. `inverse` = a rise is bad (balances owed, open items). */
function Change({ now, before, format, inverse }: { now: number | null; before: number | null; format: 'money' | 'pct' | 'count'; inverse?: boolean }) {
  if (now == null || before == null) return <span className="text-xs text-gray-400">Last month: —</span>;
  const diff = now - before;
  const shown = format === 'money' ? money(before) : format === 'pct' ? `${before.toFixed(1)}%` : before.toLocaleString();
  if (Math.abs(diff) < 0.005) return <span className="text-xs text-gray-500">Last month: {shown} (no change)</span>;
  const bad = inverse ? diff > 0 : diff < 0;
  return (
    <span className="text-xs text-gray-500">
      Last month: {shown}{' '}
      <span className={bad ? 'font-medium text-red-600' : 'font-medium text-emerald-700'}>{diff > 0 ? '▲' : '▼'}</span>
    </span>
  );
}

function Tile({ label, value, sub, href }: { label: string; value: string; sub?: ReactNode; href?: string }) {
  const body = (
    <div className="h-full rounded-2xl border border-gray-200/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; months?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const serviceDb = createServiceClient() as any;
  const portfolioId = me.portfolio?.id ?? null;
  const zone = displayTimeZone();

  const { rows: associations, error: assocError } = await fetchAllRows<any>(() => db
    .from('associations').select('id, name').is('archived_at', null).order('name').order('id'));
  // Only an association this staffer can see (RLS) is used as a filter.
  const association = UUID.test(sp.association ?? '') && associations.some((a) => a.id === sp.association) ? sp.association! : '';
  const assocIds = association ? [association] : null;
  const monthCount = MONTH_CHOICES.includes(Number(sp.months)) ? Number(sp.months) : 12;
  const months = lastMonths(monthCount, zone);
  const [thisMonth, lastMonth] = months;
  const today = todayInZone(zone);
  const startOf = (day: string) => (zonedWallTimeToUtc(day, '00:00', zone) ?? new Date(`${day}T00:00:00Z`)).toISOString();

  const withAssoc = (q: any) => (association ? q.eq('association_id', association) : q);
  const count = async (q: any) => {
    const { count: n, error } = await q;
    if (error) throw new Error(error.message);
    return n ?? 0;
  };

  // ── Month-by-month figures (one set of database totals per month) ──
  let loadError: string | null = assocError;
  const trend = await Promise.all(months.map(async (mo) => {
    try {
      const [billing, ar, ie, woOpened, woCompleted, violationsOpened] = await Promise.all([
        billingCollectionTotals(db, mo.from, mo.to, assocIds),
        // Balances as they stood at the end of the month: later charges and
        // payments do not change an earlier month.
        db.rpc('receivable_summary_as_of', { p_association_ids: assocIds, p_as_of: mo.to, p_cutoff: startOf(addDays(mo.to, 1)) })
          .then(({ data, error }: any) => {
            if (error) throw new Error(error.message);
            const r = Array.isArray(data) ? data[0] : data;
            return { arTotal: Number(r?.ar_total ?? 0), overdueTotal: Number(r?.overdue_total ?? 0), delinquentUnits: Number(r?.delinquent_units ?? 0) };
          }),
        incomeExpenseTotals(db, { portfolioId, associationIds: assocIds, from: mo.from, to: mo.to }),
        count(withAssoc(db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null)
          .gte('created_at', startOf(mo.from)).lt('created_at', startOf(addDays(mo.to, 1))))),
        count(withAssoc(db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null)
          .gte('completed_date', mo.from).lte('completed_date', mo.to))),
        count(withAssoc(db.from('violations').select('id', { count: 'exact', head: true }).is('archived_at', null)
          .gte('created_at', startOf(mo.from)).lt('created_at', startOf(addDays(mo.to, 1))))),
      ]);
      return {
        ...mo,
        charged: billing.charges,
        collected: billing.payments,
        collectionRate: pct(billing.payments, billing.charges),
        arBalance: ar.arTotal,
        overdue: ar.overdueTotal,
        delinquentUnits: ar.delinquentUnits,
        income: ie.income,
        expense: ie.expense,
        woOpened,
        woCompleted,
        violationsOpened,
      };
    } catch (e) {
      loadError = loadError ?? (e instanceof Error ? e.message : String(e));
      return null;
    }
  }));
  const now = trend[0];
  const prev = trend[1] ?? null;

  // ── Current snapshot ── (a failed figure shows "—" and is reported above)
  const noteFailure = (e: unknown) => {
    loadError = loadError ?? (e instanceof Error ? e.message : String(e));
    return null;
  };
  const [openWorkOrders, overdueWorkOrders, openViolations, pendingApprovals, unitRows, occupiedRows, bankRows, billRows] = await Promise.all([
    count(withAssoc(db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null).not('status', 'in', OPEN_WORK_ORDER))).catch(noteFailure),
    count(withAssoc(db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null)
      .lt('scheduled_date', today).not('status', 'in', OPEN_WORK_ORDER))).catch(noteFailure),
    count(withAssoc(db.from('violations').select('id', { count: 'exact', head: true }).is('archived_at', null).not('status', 'in', '("closed","cured")'))).catch(noteFailure),
    count(withAssoc(db.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('archived_at', null))).catch(noteFailure),
    count(association
      ? db.from('units').select('id, buildings!inner(association_id)', { count: 'exact', head: true }).is('archived_at', null).eq('buildings.association_id', association)
      : db.from('units').select('id', { count: 'exact', head: true }).is('archived_at', null)).catch(noteFailure),
    // A unit is occupied when it has a current occupancy.
    count(association
      ? db.from('units').select('id, buildings!inner(association_id), occupancies!inner(status)', { count: 'exact', head: true }).is('archived_at', null).eq('buildings.association_id', association).eq('occupancies.status', 'current')
      : db.from('units').select('id, occupancies!inner(status)', { count: 'exact', head: true }).is('archived_at', null).eq('occupancies.status', 'current')).catch(noteFailure),
    fetchAllRows<any>(() => withAssoc(db.from('bank_accounts').select('id, gl_account_id').is('archived_at', null)).order('id')),
    fetchAllRows<any>(() => withAssoc(db.from('payable_bills').select('id, amount, credit_applied').is('archived_at', null).eq('status', 'approved')).order('id')),
  ]);
  if (bankRows.error) noteFailure(bankRows.error);
  if (billRows.error) noteFailure(billRows.error);
  if (billRows.truncated) noteFailure('There are more approved bills than this page can load.');
  const bankGlIds = bankRows.rows.map((b) => b.gl_account_id).filter(Boolean);
  // A bank account can use a company-wide GL account shared by several
  // associations, so the ledger total is limited to the selected association.
  const cashByGl = await glDebitBalances(db, { glAccountIds: bankGlIds, associationIds: assocIds ?? undefined });
  const cashPosition = bankRows.error ? null : [...cashByGl.values()].reduce((s, v) => s + v, 0);
  const billsAwaiting = billRows.error || billRows.truncated
    ? null
    : billRows.rows.reduce((s, r) => s + Number(r.amount ?? 0) - Number(r.credit_applied ?? 0), 0);

  // Owners are linked to associations through their units, so portal adoption
  // is shown for the whole company only.
  const [ownerTotal, ownerActivated] = association
    ? [null, null]
    : await Promise.all([
        count(db.from('owners').select('id', { count: 'exact', head: true }).is('archived_at', null)).catch(noteFailure),
        count(db.from('owners').select('id', { count: 'exact', head: true }).is('archived_at', null).eq('portal_activated', true)).catch(noteFailure),
      ]);

  // Delinquency by days past due (report data runs with elevated privileges;
  // the portfolio comes from the session, the association from a visible row).
  const { data: delinqRows, error: delinqError } = portfolioId
    ? await serviceDb.rpc('report_data_delinquency', { p_portfolio_id: portfolioId, p_params: association ? { association_id: association } : {} })
    : { data: [] };
  if (delinqError) noteFailure(delinqError.message);
  const delinq = (Array.isArray(delinqRows) ? delinqRows : []) as any[];
  const days = (r: any) => Number(r.days_past_due ?? 0);

  const fmtMoney = (v: number | null | undefined) => (v == null ? '—' : money(v));
  const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)}%`);
  const fmtCount = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString());
  const scopeQuery = association ? `?association=${association}` : '';

  return (
    <DataWorkspace
      title="Metrics"
      description="Collections, delinquency, finances and maintenance by month, for the company or one association."
      actions={<Link href="/reports"><Button variant="secondary">View all reports</Button></Link>}
    >
      <div className="space-y-6">
        {loadError && <Alert tone="danger" title="Some figures could not be loaded">{loadError}</Alert>}

        <FilterBar action="/metrics" search={false}>
          <FilterSelect label="Association" name="association" defaultValue={association}>
            <option value="">All associations</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Months" name="months" defaultValue={String(monthCount)}>
            {MONTH_CHOICES.map((n) => <option key={n} value={n}>Last {n} months</option>)}
          </FilterSelect>
        </FilterBar>

        <Section title="Collections and delinquency" subtitle={`${thisMonth.label} to date, compared with ${lastMonth?.label ?? 'last month'}.`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Collection rate" value={fmtPct(now?.collectionRate)} sub={<Change now={now?.collectionRate ?? null} before={prev?.collectionRate ?? null} format="pct" />} href={`/reports/delinquency${scopeQuery}`} />
            <Tile label="Collected" value={fmtMoney(now?.collected)} sub={<Change now={now?.collected ?? null} before={prev?.collected ?? null} format="money" />} />
            <Tile label="Owed (A/R balance)" value={fmtMoney(now?.arBalance)} sub={<Change now={now?.arBalance ?? null} before={prev?.arBalance ?? null} format="money" inverse />} href={`/reports/ar_aging${scopeQuery}`} />
            <Tile label="Past due" value={fmtMoney(now?.overdue)} sub={<Change now={now?.overdue ?? null} before={prev?.overdue ?? null} format="money" inverse />} href={`/reports/delinquency${scopeQuery}`} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Delinquent units" value={fmtCount(now?.delinquentUnits)} sub={<Change now={now?.delinquentUnits ?? null} before={prev?.delinquentUnits ?? null} format="count" inverse />} />
            <Tile label="1–30 days past due" value={delinqError ? '—' : fmtCount(delinq.filter((r) => days(r) <= 30).length)} />
            <Tile label="31–60 days past due" value={delinqError ? '—' : fmtCount(delinq.filter((r) => days(r) > 30 && days(r) <= 60).length)} />
            <Tile label="61+ days past due" value={delinqError ? '—' : fmtCount(delinq.filter((r) => days(r) > 60).length)} />
          </div>
        </Section>

        <Section title="Finances" subtitle="Posted income and expenses this month, cash in bank accounts, and approved bills not yet paid.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Tile label="Income" value={fmtMoney(now?.income)} sub={<Change now={now?.income ?? null} before={prev?.income ?? null} format="money" />} href={`/reports/income_statement${scopeQuery}`} />
            <Tile label="Expenses" value={fmtMoney(now?.expense)} sub={<Change now={now?.expense ?? null} before={prev?.expense ?? null} format="money" inverse />} href={`/reports/income_statement${scopeQuery}`} />
            <Tile label="Net income" value={now ? money(now.income - now.expense) : '—'} sub={<Change now={now ? now.income - now.expense : null} before={prev ? prev.income - prev.expense : null} format="money" />} />
            <Tile label="Cash in bank" value={fmtMoney(cashPosition)} href="/bank-accounts" />
            <Tile label="Bills awaiting payment" value={fmtMoney(billsAwaiting)} href="/bills?status=approved" />
          </div>
        </Section>

        <Section title="Maintenance and compliance" subtitle="Open now, and opened or completed this month.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Open work orders" value={fmtCount(openWorkOrders)} href="/work-orders" />
            <Tile label="Past scheduled date" value={fmtCount(overdueWorkOrders)} href="/work-orders?status=overdue" />
            <Tile label="Work orders completed" value={fmtCount(now?.woCompleted)} sub={<Change now={now?.woCompleted ?? null} before={prev?.woCompleted ?? null} format="count" />} />
            <Tile label="Pending approvals" value={fmtCount(pendingApprovals)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Open violations" value={fmtCount(openViolations)} href="/violations" />
            <Tile label="Violations opened" value={fmtCount(now?.violationsOpened)} sub={<Change now={now?.violationsOpened ?? null} before={prev?.violationsOpened ?? null} format="count" inverse />} />
            <Tile label="Units occupied" value={unitRows == null || occupiedRows == null ? '—' : `${occupiedRows.toLocaleString()} of ${unitRows.toLocaleString()}`} />
            {!association && (
              <Tile
                label="Owner portal activated"
                value={ownerTotal == null || ownerActivated == null ? '—' : fmtPct(pct(ownerActivated, ownerTotal) ?? 0)}
                sub={ownerTotal != null && ownerActivated != null ? <span className="text-xs text-gray-500">{(ownerTotal - ownerActivated).toLocaleString()} not activated</span> : undefined}
                href="/owners/activations"
              />
            )}
          </div>
        </Section>

        <Section title="Month by month" subtitle="Each month's totals; the current month runs to today. Balances are as of the month's last day.">
          <Table>
            <THead>
              <TR>
                <TH>Month</TH>
                <TH className="text-right">Charged</TH>
                <TH className="text-right">Collected</TH>
                <TH className="text-right">Collection rate</TH>
                <TH className="text-right">Owed at month end</TH>
                <TH className="text-right">Past due</TH>
                <TH className="text-right">Delinquent units</TH>
                <TH className="text-right">Income</TH>
                <TH className="text-right">Expenses</TH>
                <TH className="text-right">Net</TH>
                <TH className="text-right">Work orders opened</TH>
                <TH className="text-right">Completed</TH>
                <TH className="text-right">Violations opened</TH>
              </TR>
            </THead>
            <tbody>
              {months.map((mo, i) => {
                const r = trend[i];
                return (
                  <TR key={mo.key}>
                    <TD className="whitespace-nowrap font-medium text-gray-900">{mo.label}{i === 0 ? ' (to date)' : ''}</TD>
                    <TD className="text-right tabular-nums">{fmtMoney(r?.charged)}</TD>
                    <TD className="text-right tabular-nums">{fmtMoney(r?.collected)}</TD>
                    <TD className="text-right tabular-nums">{fmtPct(r?.collectionRate)}</TD>
                    <TD className="text-right tabular-nums">{fmtMoney(r?.arBalance)}</TD>
                    <TD className="text-right tabular-nums">{fmtMoney(r?.overdue)}</TD>
                    <TD className="text-right tabular-nums">{fmtCount(r?.delinquentUnits)}</TD>
                    <TD className="text-right tabular-nums">{fmtMoney(r?.income)}</TD>
                    <TD className="text-right tabular-nums">{fmtMoney(r?.expense)}</TD>
                    <TD className="text-right tabular-nums">{r ? money(r.income - r.expense) : '—'}</TD>
                    <TD className="text-right tabular-nums">{fmtCount(r?.woOpened)}</TD>
                    <TD className="text-right tabular-nums">{fmtCount(r?.woCompleted)}</TD>
                    <TD className="text-right tabular-nums">{fmtCount(r?.violationsOpened)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </Section>
      </div>
    </DataWorkspace>
  );
}
