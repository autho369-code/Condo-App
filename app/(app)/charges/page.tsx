import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ExportActions, type ExportTable } from '@/components/export/export-actions';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionTitle, Surface } from '@/components/ui/shell';
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
  const me = await requireStaff();
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

  // ── EXPORT (mirrors the active tab's on-screen table, same filters) ──
  const companyName = me.portfolio?.company_name ?? 'Management company';
  const exportStamp = new Date().toISOString().slice(0, 10);
  let exportTable: ExportTable;
  let exportFooter: string | undefined;
  if (tab === 'receipts') {
    exportTable = {
      title: 'Receipts',
      columns: [
        { header: 'Date' },
        { header: 'Payer' },
        { header: 'Method' },
        { header: 'Unit' },
        { header: 'Association' },
        { header: 'Amount', align: 'right' },
        { header: 'Reference' },
      ],
      rows: filteredReceipts.map((r: any) => [
        date(r.payment_date),
        r.owner_name ?? '—',
        r.method ?? '—',
        r.unit_number ?? '—',
        r.association_name ?? '—',
        money(r.amount),
        r.reference ?? '—',
      ]),
    };
  } else if (tab === 'bank-deposits') {
    exportTable = {
      title: 'Bank Deposits',
      columns: [
        { header: 'Batch Date' },
        { header: 'Bank Account' },
        { header: 'Provider' },
        { header: 'Total Amount', align: 'right' },
        { header: 'Items' },
        { header: 'Deposit Reference' },
        { header: 'Status' },
      ],
      rows: filteredDeposits.map((d: any) => [
        date(d.batch_date),
        d.bank_accounts?.name ?? '—',
        d.provider ?? '—',
        money(d.total_amount_cents ? Number(d.total_amount_cents) / 100 : 0),
        d.total_items ?? 0,
        d.deposit_reference ?? '—',
        d.status ?? '—',
      ]),
    };
  } else if (tab === 'owner-delinquency') {
    const filteredDelinquentTotal = filteredDelinquent.reduce(
      (s: number, u: any) => s + Number(u.balance ?? 0),
      0,
    );
    exportTable = {
      title: 'Owner Delinquency',
      columns: [
        { header: 'Unit' },
        { header: 'Balance', align: 'right' },
        { header: 'Oldest Due' },
      ],
      rows: filteredDelinquent.map((u: any) => [
        u.unit_number ?? '—',
        money(u.balance),
        date(u.oldest_due),
      ]),
    };
    exportFooter = `Total balance due: ${money(filteredDelinquentTotal)}`;
  } else if (tab === 'chargeback-insights') {
    exportTable = {
      title: 'Chargeback Insights',
      columns: [
        { header: 'Unit' },
        { header: 'Association' },
        { header: 'Violation Type' },
        { header: 'Dispute Status' },
        { header: 'Resolution Status' },
        { header: 'Fine Amount', align: 'right' },
        { header: 'Created' },
      ],
      rows: (violations ?? []).map((v: any) => [
        v.units?.unit_number ?? '—',
        v.units?.associations?.name ?? '—',
        v.violation_type ?? '—',
        v.dispute_status ?? '—',
        v.status ?? '—',
        money(v.fine_amount),
        date(v.created_at),
      ]),
    };
  } else {
    const filteredChargesTotal = filteredCharges.reduce(
      (s: number, c: any) => s + Number(c.balance_due ?? 0),
      0,
    );
    exportTable = {
      title: 'Charges',
      columns: [
        { header: 'Unit' },
        { header: 'Association' },
        { header: 'Description' },
        { header: 'Balance', align: 'right' },
        { header: 'Due' },
        { header: 'Aging' },
      ],
      rows: filteredCharges.map((c: any) => [
        c.unit_number ?? '—',
        c.association_name ?? '—',
        c.description ?? '—',
        money(c.balance_due),
        date(c.due_date),
        formatBucket(c.aging_bucket),
      ]),
    };
    exportFooter = `Total balance due: ${money(filteredChargesTotal)}`;
  }

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
        <>
          <ExportActions
            documentTitle="Receivables"
            companyName={companyName}
            filename={`receivables-${tab}-${exportStamp}`}
            tables={[exportTable]}
            footerLine={exportFooter}
          />
          <Link href="/charges/new">
            <Button><Plus className="h-4 w-4" /> New charge</Button>
          </Link>
          <Link href="/reports/ar-aging">
            <Button variant="secondary">AR aging report</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── TABS ── */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            return (
              <Link
                key={t.key}
                href={`/charges?${params.toString()}`}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-gray-950 text-gray-950'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
            <FilterSelect label="Aging" name="filter" defaultValue={filter}>
              <option value="">All aging</option>
              <option value="current">Current</option>
              <option value="1_30">1–30 days</option>
              <option value="31_60">31–60 days</option>
              <option value="61_90">61–90 days</option>
              <option value="90_plus">90+ days</option>
            </FilterSelect>
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
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState icon={Receipt} title="No receipts match this view" />
              </div>
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
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState icon={Receipt} title="No charges match this view" />
              </div>
            )}

            {/* Category breakdown */}
            {categoryBreakdown.length > 0 && (
              <Surface padded={false}>
                <div className="border-b border-gray-100 px-5 py-4">
                  <SectionTitle
                    title="Charges by category"
                    description="Outstanding balance by charge category across all associations."
                    className="mb-0"
                  />
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
              </Surface>
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
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState icon={Receipt} title="No bank deposits in this view" />
              </div>
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
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState icon={Receipt} title="No delinquent units in this view" />
              </div>
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
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={Receipt}
                  title="No chargeback disputes recorded"
                  description="Disputed violations and their resolution status will appear here."
                />
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

function SummaryCard({ label, value }: { label: string; value: string | number; tone?: 'info' | 'warning' | 'success' }) {
  return (
    <Surface padded={false} className="px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
    </Surface>
  );
}
