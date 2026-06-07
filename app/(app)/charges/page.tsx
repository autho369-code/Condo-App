import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Tab = 'receipts' | 'charges' | 'bank-deposits' | 'owner-delinquency' | 'chargeback-insights';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'receipts', label: 'Receipts' },
  { key: 'charges', label: 'Charges' },
  { key: 'bank-deposits', label: 'Bank Deposits' },
  { key: 'owner-delinquency', label: 'Owner Delinquency' },
  { key: 'chargeback-insights', label: 'Chargeback Insights' },
];

function parseTab(value: string | undefined): Tab {
  switch (value) {
    case 'receipts':
    case 'charges':
    case 'bank-deposits':
    case 'owner-delinquency':
    case 'chargeback-insights':
      return value;
    default:
      return 'charges';
  }
}

export default async function ChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; filter?: string; association_id?: string }>;
}) {
  await requireStaff();
  const { tab: tabParam, q = '', filter = '', association_id = '' } = await searchParams;
  const tab = parseTab(tabParam);
  const supabase = await createClient();
  const db = supabase as any;

  // ── PARALLEL: fetch all tab data + reference lists ──
  const [
    { data: receipts },
    { data: charges },
    { data: lockboxBatches },
    { data: delinquentUnits },
    { data: violations },
    { data: associations },
    { data: bankAccounts },
    { data: vChargesByCategory },
  ] = await Promise.all([
    // Receipts tab: payments ledger
    db.from('receivable_payments_ledger')
      .select('*')
      .order('payment_date', { ascending: false })
      .limit(500),
    // Charges tab: aged receivables
    db.from('aged_receivables')
      .select('*')
      .order('due_date')
      .limit(500),
    // Bank Deposits tab: lockbox batches
    db.from('lockbox_batches')
      .select('id, batch_date, deposit_reference, deposited_at, status, total_amount_cents, total_items, bank_account_id, provider, notes, bank_accounts!inner(name, bank_name)')
      .order('batch_date', { ascending: false })
      .limit(200),
    // Owner Delinquency tab
    db.from('delinquent_units')
      .select('*')
      .order('balance', { ascending: false })
      .limit(500),
    // Chargeback Insights tab: violations with dispute_status
    db.from('violations')
      .select('id, dispute_status, status, fine_amount, created_at, units(unit_number, associations(name)), violation_type')
      .not('dispute_status', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
    // Associations for filters
    db.from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    // Bank accounts for deposit tab
    db.from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .order('name'),
    // Charges by category for metrics
    db.from('v_charges_by_category')
      .select('*')
      .order('outstanding_balance', { ascending: false }),
  ]);

  // ── FILTER RECEIPTS ──
  let filteredReceipts = (receipts ?? []);
  if (q && tab === 'receipts') {
    const ql = q.toLowerCase();
    filteredReceipts = filteredReceipts.filter(
      (r: any) =>
        (r.owner_name ?? '').toLowerCase().includes(ql) ||
        (r.unit_number ?? '').toLowerCase().includes(ql) ||
        (r.reference ?? '').toLowerCase().includes(ql) ||
        (r.association_name ?? '').toLowerCase().includes(ql),
    );
  }

  // ── FILTER CHARGES ──
  let filteredCharges = (charges ?? []);
  if (q && tab === 'charges') {
    const ql = q.toLowerCase();
    filteredCharges = filteredCharges.filter(
      (c: any) =>
        (c.unit_number ?? '').toLowerCase().includes(ql) ||
        (c.association_name ?? '').toLowerCase().includes(ql) ||
        (c.description ?? '').toLowerCase().includes(ql),
    );
  }
  if (filter && tab === 'charges') {
    // filter can be aging bucket: current, 1_30, 31_60, 61_90, 90_plus
    filteredCharges = filteredCharges.filter((c: any) => c.aging_bucket === filter);
  }

  // ── FILTER BANK DEPOSITS ──
  let filteredDeposits = (lockboxBatches ?? []);
  if (q && tab === 'bank-deposits') {
    const ql = q.toLowerCase();
    filteredDeposits = filteredDeposits.filter(
      (d: any) =>
        (d.provider ?? '').toLowerCase().includes(ql) ||
        (d.deposit_reference ?? '').toLowerCase().includes(ql) ||
        (d.bank_accounts?.name ?? '').toLowerCase().includes(ql),
    );
  }

  // ── FILTER DELINQUENCY ──
  let filteredDelinquent = (delinquentUnits ?? []);
  if (q && tab === 'owner-delinquency') {
    const ql = q.toLowerCase();
    filteredDelinquent = filteredDelinquent.filter(
      (u: any) => (u.unit_number ?? '').toLowerCase().includes(ql),
    );
  }

  // ── METRICS ──
  const totalReceipts = (receipts ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const totalOutstanding = (charges ?? []).reduce((s: number, c: any) => s + Number(c.balance_due ?? 0), 0);
  const receiptsCount = (receipts ?? []).length;
  const depositsCount = (lockboxBatches ?? []).length;
  const delinquentCount = (delinquentUnits ?? []).length;
  const overdueBalance = (delinquentUnits ?? []).reduce((s: number, u: any) => s + Number(u.balance ?? 0), 0);
  const chargebackCount = (violations ?? []).length;

  // Charges by category outstanding
  const categoryBreakdown = (vChargesByCategory ?? []).slice(0, 5);

  const metrics = [
    { label: 'Receipts', value: receiptsCount, sublabel: `${money(totalReceipts)} total` },
    { label: 'Outstanding', value: money(totalOutstanding), sublabel: `${(charges ?? []).length} open charges` },
    { label: 'Delinquent units', value: delinquentCount, sublabel: `${money(overdueBalance)} overdue` },
    { label: 'Disputed', value: chargebackCount, sublabel: 'Active chargebacks' },
  ];

  return (
    <DataWorkspace
      title="Receivables"
      description="Receipts, open charges, bank deposits, owner delinquency, and chargeback dispute tracking."
      actions={
        <div className="flex gap-2">
          <Link href="/charges/new" className="rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            + New charge
          </Link>
          <Link href="/reports/ar-aging" className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            AR aging report
          </Link>
        </div>
      }
      rail={<ReceivablesRail />}
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── TABS ── */}
        <nav className="flex flex-wrap gap-1 border-b border-gray-200">
          {TABS.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            return (
              <Link
                key={t.key}
                href={`/charges?${params.toString()}`}
                className={`border-b-2 px-4 py-2 text-sm transition ${
                  active
                    ? 'border-brand-600 font-medium text-brand-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* ── FILTER BAR (contextual per tab) ── */}
        <FilterBar
          action="/charges"
          searchDefault={q}
          searchPlaceholder={
            tab === 'receipts'
              ? 'Search payer, unit, reference...'
              : tab === 'charges'
              ? 'Search unit, association, description...'
              : tab === 'bank-deposits'
              ? 'Search provider, bank account...'
              : 'Search unit...'
          }
        >
          <input type="hidden" name="tab" value={tab} />
          {tab === 'charges' && (
            <label className="text-xs font-medium uppercase text-gray-500">
              Aging
              <select
                name="filter"
                defaultValue={filter}
                className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900"
              >
                <option value="">All aging</option>
                <option value="current">Current</option>
                <option value="1_30">1–30 days</option>
                <option value="31_60">31–60 days</option>
                <option value="61_90">61–90 days</option>
                <option value="90_plus">90+ days</option>
              </select>
            </label>
          )}
        </FilterBar>

        {/* ── TAB: RECEIPTS ── */}
        {tab === 'receipts' && (
          <>
            {filteredReceipts.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Payer</TH>
                    <TH>Method</TH>
                    <TH>Unit</TH>
                    <TH>Association</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Reference</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredReceipts.map((r: any) => (
                    <TR key={r.payment_id}>
                      <TD className="whitespace-nowrap">{date(r.payment_date)}</TD>
                      <TD className="font-medium text-gray-900">{r.owner_name ?? '—'}</TD>
                      <TD>
                        <StatusChip
                          tone={
                            r.method === 'online' || r.method === 'ach'
                              ? 'info'
                              : r.method === 'check'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {r.method ?? '—'}
                        </StatusChip>
                      </TD>
                      <TD className="font-medium">{r.unit_number ?? '—'}</TD>
                      <TD className="text-sm text-gray-600 max-w-[180px] truncate">
                        {r.association_name ?? '—'}
                      </TD>
                      <TD className="text-right tabular-nums font-medium text-gray-900">
                        {money(r.amount)}
                      </TD>
                      <TD className="text-sm text-gray-600 max-w-[160px] truncate" title={r.reference ?? ''}>
                        {r.reference ?? '—'}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No receipts match this view.
              </p>
            )}
          </>
        )}

        {/* ── TAB: CHARGES ── */}
        {tab === 'charges' && (
          <>
            {filteredCharges.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Unit</TH>
                    <TH>Association</TH>
                    <TH>Description</TH>
                    <TH className="text-right">Balance</TH>
                    <TH>Due</TH>
                    <TH>Aging</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredCharges.map((c: any) => (
                    <TR key={c.charge_id}>
                      <TD className="font-medium">{c.unit_number ?? '—'}</TD>
                      <TD className="text-sm text-gray-600 max-w-[180px] truncate">
                        {c.association_name ?? '—'}
                      </TD>
                      <TD className="text-sm text-gray-700 max-w-[300px] truncate">
                        {c.description ?? '—'}
                      </TD>
                      <TD className="text-right tabular-nums font-medium text-red-600">
                        {money(c.balance_due)}
                      </TD>
                      <TD className="whitespace-nowrap text-sm">{date(c.due_date)}</TD>
                      <TD>
                        <StatusChip
                          tone={
                            c.aging_bucket === 'current'
                              ? 'neutral'
                              : c.aging_bucket === '1_30'
                              ? 'warning'
                              : c.aging_bucket === '31_60'
                              ? 'warning'
                              : c.aging_bucket === '61_90'
                              ? 'danger'
                              : 'danger'
                          }
                        >
                          {formatBucket(c.aging_bucket)}
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No charges match this view.
              </p>
            )}

            {/* Category breakdown */}
            {categoryBreakdown.length > 0 && (
              <section className="rounded border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4">
                  <h2 className="text-sm font-semibold text-gray-950">Charges by category</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Outstanding balance by charge category across all associations.
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {categoryBreakdown.map((cat: any) => (
                    <div key={cat.category_id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{cat.category_name ?? '—'}</span>
                        <span className="ml-2 text-xs text-gray-500">({cat.charge_count ?? 0} charges)</span>
                      </div>
                      <span className="text-sm tabular-nums font-medium text-gray-900">
                        {money(cat.outstanding_balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── TAB: BANK DEPOSITS ── */}
        {tab === 'bank-deposits' && (
          <>
            {filteredDeposits.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Batch Date</TH>
                    <TH>Bank Account</TH>
                    <TH>Provider</TH>
                    <TH className="text-right">Total Amount</TH>
                    <TH className="text-center">Items</TH>
                    <TH>Deposit Reference</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredDeposits.map((d: any) => (
                    <TR key={d.id}>
                      <TD className="whitespace-nowrap">{date(d.batch_date)}</TD>
                      <TD>
                        <div className="font-medium text-gray-900">{d.bank_accounts?.name ?? '—'}</div>
                        <div className="text-xs text-gray-500">{d.bank_accounts?.bank_name ?? ''}</div>
                      </TD>
                      <TD className="text-sm text-gray-600">{d.provider ?? '—'}</TD>
                      <TD className="text-right tabular-nums font-medium text-gray-900">
                        {money(d.total_amount_cents ? Number(d.total_amount_cents) / 100 : 0)}
                      </TD>
                      <TD className="text-center tabular-nums text-sm">{d.total_items ?? 0}</TD>
                      <TD className="text-sm text-gray-600 max-w-[140px] truncate">
                        {d.deposit_reference ?? '—'}
                      </TD>
                      <TD>
                        <StatusChip
                          tone={
                            d.status === 'deposited'
                              ? 'success'
                              : d.status === 'reconciled'
                              ? 'info'
                              : d.status === 'pending'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {d.status ?? '—'}
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No bank deposits in this view.
              </p>
            )}
          </>
        )}

        {/* ── TAB: OWNER DELINQUENCY ── */}
        {tab === 'owner-delinquency' && (
          <>
            {filteredDelinquent.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Unit</TH>
                    <TH className="text-right">Balance</TH>
                    <TH>Oldest Due</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredDelinquent.map((u: any) => (
                    <TR key={u.unit_id}>
                      <TD>
                        <span className="font-medium text-gray-900">{u.unit_number ?? '—'}</span>
                      </TD>
                      <TD className="text-right tabular-nums font-medium text-red-600">
                        {money(u.balance)}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">
                        {date(u.oldest_due)}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No delinquent units in this view.
              </p>
            )}
          </>
        )}

        {/* ── TAB: CHARGEBACK INSIGHTS ── */}
        {tab === 'chargeback-insights' && (
          <>
            {(violations ?? []).length > 0 ? (
              <>
                <Table>
                  <THead>
                    <TR>
                      <TH>Unit</TH>
                      <TH>Association</TH>
                      <TH>Violation Type</TH>
                      <TH>Dispute Status</TH>
                      <TH>Resolution Status</TH>
                      <TH className="text-right">Fine Amount</TH>
                      <TH>Created</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {(violations ?? []).map((v: any) => (
                      <TR key={v.id}>
                        <TD className="font-medium">{v.units?.unit_number ?? '—'}</TD>
                        <TD className="text-sm text-gray-600 max-w-[180px] truncate">
                          {v.units?.associations?.name ?? '—'}
                        </TD>
                        <TD className="text-sm text-gray-700">{v.violation_type ?? '—'}</TD>
                        <TD>
                          <StatusChip
                            tone={
                              v.dispute_status === 'resolved'
                                ? 'success'
                                : v.dispute_status === 'pending'
                                ? 'warning'
                                : v.dispute_status === 'escalated'
                                ? 'danger'
                                : 'info'
                            }
                          >
                            {v.dispute_status ?? '—'}
                          </StatusChip>
                        </TD>
                        <TD>
                          <StatusChip
                            tone={
                              v.status === 'resolved'
                                ? 'success'
                                : v.status === 'open'
                                ? 'warning'
                                : v.status === 'escalated'
                                ? 'danger'
                                : 'neutral'
                            }
                          >
                            {v.status ?? '—'}
                          </StatusChip>
                        </TD>
                        <TD className="text-right tabular-nums font-medium text-gray-900">
                          {money(v.fine_amount)}
                        </TD>
                        <TD className="whitespace-nowrap text-sm text-gray-600">
                          {date(v.created_at)}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>

                {/* Dispute summary */}
                <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard
                    label="Total disputes"
                    value={(violations ?? []).length}
                    tone="info"
                  />
                  <SummaryCard
                    label="Pending resolution"
                    value={(violations ?? []).filter((v: any) => v.dispute_status === 'pending').length}
                    tone="warning"
                  />
                  <SummaryCard
                    label="Resolved"
                    value={(violations ?? []).filter((v: any) => v.dispute_status === 'resolved').length}
                    tone="success"
                  />
                </section>
              </>
            ) : (
              <div className="space-y-6">
                <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                  No chargeback disputes recorded.
                </p>
                <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard label="Total disputes" value={0} tone="info" />
                  <SummaryCard label="Pending resolution" value={0} tone="warning" />
                  <SummaryCard label="Resolved" value={0} tone="success" />
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </DataWorkspace>
  );
}

function formatBucket(bucket: string): string {
  switch (bucket) {
    case 'current':
      return 'Current';
    case '1_30':
      return '1–30d';
    case '31_60':
      return '31–60d';
    case '61_90':
      return '61–90d';
    case '90_plus':
      return '90+d';
    default:
      return bucket;
  }
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone: 'info' | 'warning' | 'success' }) {
  const color = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return (
    <div className={`rounded border px-4 py-3 ${color[tone]}`}>
      <div className="text-xs font-medium uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ReceivablesRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Receipts</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/charges/new-payment?type=owner" label="Owner Receipt" />
          <RailLink href="/charges/new-payment?type=vendor" label="Vendor Receipt" />
          <RailLink href="/charges/new-payment?type=other" label="Other Receipt" />
          <RailLink href="/charges/new-payment?type=subsidy" label="Subsidy Receipts" />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Charges & Credits</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/charges/new?type=owner" label="Owner Charge" />
          <RailLink href="/charges/new?type=credit" label="Owner Credit" />
          <RailLink href="/charges/bulk" label="Bulk Charges and Credits" />
          <RailLink href="/charges/bulk-recurring" label="Bulk Recurring Charges" />
          <RailLink href="/charges/apply-credits" label="Apply Credits" />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Tools</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/charges/activity" label="Owner Receivable Activity" />
          <RailLink href="/charges/common-charge" label="Common Charge" />
          <RailLink href="/charges/late-fees" label="Charge Late Fees" />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Banking</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/bank-accounts/deposits/new" label="New Bank Deposit" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Reports</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports/aged-receivables" label="Aged Receivables" />
          <RailLink href="/reports/dues-roll" label="Dues Roll" />
          <RailLink href="/reports/delinquency" label="Homeowner Delinquency" />
          <RailLink href="/reports/deposit_register" label="Deposit Register" />
          <RailLink href="/reports/payment_register" label="Payment Register" />
        </div>
      </section>
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}
