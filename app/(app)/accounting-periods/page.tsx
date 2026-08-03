import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

import { changeAccountingPeriodStatus, initializeAccountingYear } from './actions';

export const dynamic = 'force-dynamic';

const monthName = (month: number) => new Intl.DateTimeFormat('en-US', { month: 'long' })
  .format(new Date(2024, month - 1, 1));

function periodBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const next = new Date(Date.UTC(year, month, 1));
  const nextStart = next.toISOString().slice(0, 10);
  const end = new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10);
  return { start, nextStart, end };
}

function statusTone(status: string) {
  if (status === 'closed') return 'success' as const;
  if (status === 'soft_closed') return 'warning' as const;
  return 'info' as const;
}

export default async function AccountingPeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; error?: string; initialized?: string; updated?: string }>;
}) {
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(sp.year ?? currentYear);
  const selectedYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
    ? requestedYear
    : currentYear;
  const me = await requireFinanceOrPortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) redirect('/dashboard?error=' + encodeURIComponent('Select a portfolio workspace to manage accounting periods.'));

  const supabase = await createClient();
  const yearStart = `${selectedYear}-01-01`;
  const nextYearStart = `${selectedYear + 1}-01-01`;
  const [periodsResult, journalResult, banksResult, diagnosticsResult] = await Promise.all([
    (supabase as any)
      .from('accounting_periods')
      .select('id, fiscal_year, period_month, status, closed_at, reopened_at, notes, updated_at')
      .eq('portfolio_id', portfolioId)
      .eq('fiscal_year', selectedYear)
      .order('period_month'),
    (supabase as any)
      .from('journal_entries')
      .select('id, entry_date, posted')
      .eq('portfolio_id', portfolioId)
      .gte('entry_date', yearStart)
      .lt('entry_date', nextYearStart),
    (supabase as any)
      .from('bank_accounts')
      .select('id, name, last_reconciliation_date')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null),
    (supabase as any)
      .from('data_diagnostics')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', portfolioId)
      .is('resolved_at', null),
  ]);

  const periods = periodsResult.data ?? [];
  const journals = journalResult.data ?? [];
  const banks = banksResult.data ?? [];
  const readError = periodsResult.error ?? journalResult.error ?? banksResult.error ?? diagnosticsResult.error;
  const closed = periods.filter((period: any) => period.status === 'closed').length;
  const softClosed = periods.filter((period: any) => period.status === 'soft_closed').length;
  const open = periods.filter((period: any) => period.status === 'open').length;

  return (
    <DataWorkspace
      title="Accounting periods"
      description="A guided, audited close process that blocks hard close until draft journal entries are posted and every active bank account is reconciled through period end."
      actions={(
        <Link href="/diagnostics"><Button variant="secondary">Run diagnostics</Button></Link>
      )}
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Period was not updated.">{sp.error}</Alert>}
        {sp.updated && <Alert tone="success" title="Accounting period updated.">The status change and actor were recorded in the audit log.</Alert>}
        {sp.initialized !== undefined && <Alert tone="success" title="Fiscal year ready.">{sp.initialized} missing periods were created.</Alert>}
        {readError && <Alert tone="danger" title="Close readiness could not be loaded.">{readError.message}</Alert>}

        <MetricStrip metrics={[
          { label: 'Open', value: open },
          { label: 'Soft closed', value: softClosed },
          { label: 'Closed', value: closed },
          { label: 'Unresolved diagnostics', value: diagnosticsResult.count ?? 0 },
        ]} />

        <Surface>
          <SectionTitle title="Fiscal year" description="Open an existing year or initialize any missing monthly periods." />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <form method="get" className="flex items-end gap-2">
              <div><Label htmlFor="year">View year</Label><Input id="year" name="year" type="number" min={2000} max={2100} defaultValue={selectedYear} className="w-32" /></div>
              <Button type="submit" variant="secondary">View</Button>
            </form>
            <form action={initializeAccountingYear} className="flex items-end gap-2 sm:ml-auto">
              <input type="hidden" name="fiscal_year" value={selectedYear} />
              <Button type="submit">Initialize {selectedYear}</Button>
            </form>
          </div>
        </Surface>

        <section>
          <SectionTitle
            title={`${selectedYear} close calendar`}
            description="Soft close signals review; hard close enforces the checklist. Reopening always requires an audited reason."
          />
          <Table>
            <THead><tr><TH>Period</TH><TH>Status</TH><TH>Draft entries</TH><TH>Bank reconciliation</TH><TH>Last change</TH><TH className="w-72">Manage</TH></tr></THead>
            <tbody>
              {periods.length === 0 ? (
                <TR><TD colSpan={6} className="py-10 text-center text-gray-500">Initialize {selectedYear} to create its 12 accounting periods.</TD></TR>
              ) : periods.map((period: any) => {
                const bounds = periodBounds(period.fiscal_year, period.period_month);
                const draftCount = journals.filter((entry: any) => !entry.posted && entry.entry_date >= bounds.start && entry.entry_date < bounds.nextStart).length;
                const unreconciled = banks.filter((bank: any) => !bank.last_reconciliation_date || bank.last_reconciliation_date < bounds.end);
                const ready = draftCount === 0 && unreconciled.length === 0;
                return (
                  <TR key={period.id}>
                    <TD><span className="font-medium text-gray-950">{monthName(period.period_month)}</span><span className="ml-1 text-gray-400">{period.fiscal_year}</span></TD>
                    <TD><StatusChip tone={statusTone(period.status)}>{period.status.replace('_', ' ')}</StatusChip></TD>
                    <TD><StatusChip tone={draftCount ? 'danger' : 'success'}>{draftCount ? `${draftCount} remaining` : 'ready'}</StatusChip></TD>
                    <TD><StatusChip tone={unreconciled.length ? 'danger' : 'success'}>{unreconciled.length ? `${unreconciled.length} behind` : `through ${date(bounds.end)}`}</StatusChip></TD>
                    <TD>{date(period.reopened_at ?? period.closed_at ?? period.updated_at)}</TD>
                    <TD>
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-950">Change status</summary>
                        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                          {period.status === 'open' && (
                            <form action={changeAccountingPeriodStatus.bind(null, period.id, 'soft_closed')}>
                              <Button type="submit" size="sm" variant="secondary" className="w-full">Soft close</Button>
                            </form>
                          )}
                          {period.status !== 'closed' && (
                            <form action={changeAccountingPeriodStatus.bind(null, period.id, 'closed')} className="space-y-2">
                              <Input name="note" aria-label="Close note" placeholder="Close note (optional)" />
                              <Button type="submit" size="sm" className="w-full" disabled={!ready}>Hard close</Button>
                              {!ready && <p className="text-xs text-red-600">Resolve the red checklist items first.</p>}
                            </form>
                          )}
                          {period.status !== 'open' && (
                            <form action={changeAccountingPeriodStatus.bind(null, period.id, 'open')} className="space-y-2">
                              <Input name="note" required minLength={10} aria-label="Reopening reason" placeholder="Reopening reason (required)" />
                              <Button type="submit" size="sm" variant="danger" className="w-full">Reopen period</Button>
                            </form>
                          )}
                        </div>
                      </details>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </section>
      </div>
    </DataWorkspace>
  );
}
