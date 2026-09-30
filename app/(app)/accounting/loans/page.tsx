import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { FREQUENCY_LABEL, periodsPerYear, type LoanFrequency } from '@/lib/loans/amortization';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; status?: string; q?: string; error?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const assoc = UUID.test(sp.assoc ?? '') ? sp.assoc! : '';
  const status = sp.status === 'paid_off' || sp.status === 'all' ? sp.status : 'active';
  const q = (sp.q ?? '').trim().toLowerCase();
  const db = (await createClient()) as any;

  let query = db
    .from('association_loans')
    .select('id, association_id, lender, loan_type, current_balance, interest_rate, payment_amount, payment_frequency, next_payment_date, maturity_date, status, gl_account_id, interest_gl_account_id, associations(name)')
    .is('archived_at', null)
    .order('next_payment_date', { ascending: true, nullsFirst: false });
  if (assoc) query = query.eq('association_id', assoc);
  if (status !== 'all') query = query.eq('status', status);
  const [{ data, error }, { data: associations }] = await Promise.all([
    query,
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  if (error) throw new Error(`Could not load loans: ${error.message}`);

  const loans = ((data ?? []) as any[]).filter((l) => !q || [l.lender, l.associations?.name, l.loan_type].some((v) => String(v ?? '').toLowerCase().includes(q)));
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const active = loans.filter((l) => l.status === 'active');
  const totalDebt = active.reduce((sum, l) => sum + Number(l.current_balance ?? 0), 0);
  const monthlyService = active.reduce((sum, l) => sum + (Number(l.payment_amount ?? 0) * periodsPerYear(l.payment_frequency)) / 12, 0);
  const dueSoon = active.filter((l) => l.next_payment_date && l.next_payment_date <= in30);
  const needsSetup = active.filter((l) => !l.gl_account_id || !l.interest_gl_account_id);

  return (
    <DataWorkspace
      title="Loans"
      description="Association loans and mortgages. Record each payment here — principal and interest post to the general ledger and the balance and next due date update."
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Something went wrong">{sp.error}</Alert>}
        <MetricStrip
          metrics={[
            { label: 'Outstanding debt', value: money(totalDebt), sublabel: `${active.length} active loan${active.length === 1 ? '' : 's'}` },
            { label: 'Debt service / month', value: money(monthlyService) },
            { label: 'Due in 30 days', value: String(dueSoon.length) },
            { label: 'Need GL setup', value: String(needsSetup.length) },
          ]}
        />

        <FilterBar action="/accounting/loans" searchDefault={sp.q ?? ''} searchPlaceholder="Search lender or association">
          <FilterSelect label="Association" name="assoc" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="active">Active</option>
            <option value="paid_off">Paid off</option>
            <option value="all">All</option>
          </FilterSelect>
        </FilterBar>

        {loans.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Landmark}
              title="No loans here"
              description="Add a loan or mortgage from the association's profile page, then set it up here."
            />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Lender</TH>
                <TH>Association</TH>
                <TH className="text-right">Balance</TH>
                <TH>Rate · payment</TH>
                <TH>Next due</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <tbody>
              {loans.map((l) => {
                const overdue = l.status === 'active' && l.next_payment_date && l.next_payment_date < today;
                return (
                  <TR key={l.id}>
                    <TD>
                      <Link href={`/accounting/loans/${l.id}`} className="font-medium text-gray-950 hover:underline">{l.lender}</Link>
                      <div className="text-xs capitalize text-gray-500">{String(l.loan_type ?? '').replace(/_/g, ' ')}</div>
                    </TD>
                    <TD className="text-sm text-gray-600">{l.associations?.name ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{money(l.current_balance ?? 0)}</TD>
                    <TD className="text-sm text-gray-600">
                      {l.interest_rate != null ? `${Number(l.interest_rate)}%` : '—'}
                      {l.payment_amount != null ? ` · ${money(l.payment_amount)} ${FREQUENCY_LABEL[(l.payment_frequency ?? 'monthly') as LoanFrequency]?.toLowerCase() ?? ''}` : ''}
                    </TD>
                    <TD className="whitespace-nowrap text-sm">
                      {l.next_payment_date ? date(l.next_payment_date) : '—'}
                      {overdue && <div><StatusChip tone="danger">Overdue</StatusChip></div>}
                    </TD>
                    <TD>
                      {l.status === 'paid_off'
                        ? <StatusChip tone="success">Paid off</StatusChip>
                        : l.status === 'refinanced'
                          ? <StatusChip tone="neutral">Refinanced</StatusChip>
                        : !l.gl_account_id || !l.interest_gl_account_id
                          ? <StatusChip tone="warning">Needs GL setup</StatusChip>
                          : <StatusChip tone="info">Active</StatusChip>}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
