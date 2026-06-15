import Link from 'next/link';
import { Plus, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type OwnerPayableTab = 'open' | 'paid' | 'all';
type OwnerPayableTypeFilter = 'all' | 'refund' | 'settlement' | 'distribution' | 'other';

const TABS: Array<{ key: OwnerPayableTab; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
];

const TYPE_FILTERS: Array<{ key: OwnerPayableTypeFilter; label: string }> = [
  { key: 'all', label: 'All Types' },
  { key: 'refund', label: 'Refunds' },
  { key: 'settlement', label: 'Settlements' },
  { key: 'distribution', label: 'Distributions' },
  { key: 'other', label: 'Other' },
];

function parseTab(value: string | undefined): OwnerPayableTab {
  switch (value) {
    case 'open': case 'paid': case 'all': return value;
    default: return 'open';
  }
}

function parseType(value: string | undefined): OwnerPayableTypeFilter {
  switch (value) {
    case 'all': case 'refund': case 'settlement': case 'distribution': case 'other':
      return value;
    default: return 'all';
  }
}

export default async function OwnerPayablePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; q?: string; error?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const { tab: tabParam, type: typeParam, q = '' } = sp;
  const tab = parseTab(tabParam);
  const typeFilter = parseType(typeParam);
  const supabase = await createClient();
  const db = supabase as any;

  // PARALLEL: fetch data
  const [
    { data: payables },
    { data: owners },
    { data: associations },
    { data: glAccounts },
    { data: bankAccounts },
  ] = await Promise.all([
    db.from('owner_payables')
      .select('id, payable_number, payable_type, payable_date, due_date, amount, memo, status, paid_at, approved_at, association_id, owner_id, gl_account_id, bank_account_id, owners(full_name, email), associations(name), gl_accounts(number, name), bank_accounts(name)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(500),
    db.from('owners')
      .select('id, full_name')
      .order('full_name'),
    db.from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    db.from('gl_accounts')
      .select('id, number, name')
      .eq('active', true)
      .order('number'),
    db.from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .order('name'),
  ]);

  let items = (payables ?? []);

  // Filter by tab
  if (tab === 'open') {
    items = items.filter((p: any) => p.status !== 'paid' && p.status !== 'void');
  } else if (tab === 'paid') {
    items = items.filter((p: any) => p.status === 'paid');
  }

  // Filter by type
  if (typeFilter !== 'all') {
    items = items.filter((p: any) => p.payable_type === typeFilter);
  }

  // Search
  if (q) {
    const ql = q.toLowerCase();
    items = items.filter(
      (p: any) =>
        (p.owners?.full_name ?? '').toLowerCase().includes(ql) ||
        (p.associations?.name ?? '').toLowerCase().includes(ql) ||
        (p.memo ?? '').toLowerCase().includes(ql) ||
        (p.payable_number ?? '').toLowerCase().includes(ql),
    );
  }

  // Metrics
  const today = new Date().toISOString().slice(0, 10);
  const allItems = (payables ?? []);
  const openItems = allItems.filter((p: any) => p.status !== 'paid' && p.status !== 'void');
  const paidItems = allItems.filter((p: any) => p.status === 'paid');
  const pendingApproval = allItems.filter((p: any) => p.status === 'pending_approval');
  const overdue = openItems.filter((p: any) => p.due_date && p.due_date < today);

  const metrics: Metric[] = [
    { label: 'Open', value: openItems.length, sublabel: `${money(openItems.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0))}` },
    { label: 'Pending approval', value: pendingApproval.length, sublabel: `${money(pendingApproval.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0))}` },
    { label: 'Paid', value: paidItems.length, sublabel: `${money(paidItems.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0))}` },
    { label: 'Overdue', value: overdue.length, sublabel: `${money(overdue.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0))}` },
  ];

  return (
    <DataWorkspace
      title="Owner Payables"
      description="Owner refunds, settlements, and distributions — tracked separately from vendor payables."
      actions={
        <Link href="/bills/owner-payable/new">
          <Button><Plus className="h-4 w-4" /> New owner payable</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {sp.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span className="font-semibold">Could not update owner payable:</span> {sp.error}
          </div>
        )}

        <MetricStrip metrics={metrics} />

        {/* TABS */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            if (typeFilter !== 'all') params.set('type', typeFilter);
            return (
              <Link
                key={t.key}
                href={`/bills/owner-payable?${params.toString()}`}
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

        {/* TYPE SUB-FILTERS */}
        <nav className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((f) => {
            const active = f.key === typeFilter;
            const params = new URLSearchParams();
            params.set('tab', tab);
            if (f.key !== 'all') params.set('type', f.key);
            if (q) params.set('q', q);
            return (
              <Link
                key={f.key}
                href={`/bills/owner-payable?${params.toString()}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100'
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>

        {/* FILTER BAR */}
        <FilterBar
          action="/bills/owner-payable"
          searchDefault={q}
          searchPlaceholder="Search owner, association, memo, payable #..."
        >
          <input type="hidden" name="tab" value={tab} />
          {typeFilter !== 'all' && <input type="hidden" name="type" value={typeFilter} />}
        </FilterBar>

        {/* TABLE */}
        {items.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Payable #</TH>
                <TH>Owner</TH>
                <TH>Type</TH>
                <TH>Association</TH>
                <TH>GL Account</TH>
                <TH>Due Date</TH>
                <TH className="text-right">Amount</TH>
                <TH>Status</TH>
                <TH>Cash Account</TH>
              </TR>
            </THead>
            <tbody>
              {items.map((p: any) => (
                <TR key={p.id}>
                  <TD className="text-sm text-gray-600 tabular-nums">
                    {p.payable_number ?? '—'}
                  </TD>
                  <TD className="font-medium">
                    {p.owners?.full_name ?? '—'}
                    {p.owners?.email && (
                      <span className="ml-1 text-xs text-gray-400">{p.owners.email}</span>
                    )}
                  </TD>
                  <TD>
                    <PayableTypeChip type={p.payable_type} />
                  </TD>
                  <TD className="max-w-[180px] truncate text-sm text-gray-700">
                    {p.associations?.name ?? '—'}
                  </TD>
                  <TD className="text-sm text-gray-600">
                    {p.gl_accounts ? `${p.gl_accounts.number}: ${p.gl_accounts.name}` : '—'}
                  </TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">
                    {date(p.due_date)}
                  </TD>
                  <TD className="text-right tabular-nums font-medium text-gray-900">
                    {money(p.amount)}
                  </TD>
                  <TD>
                    <OwnerPayableStatusChip status={p.status} />
                  </TD>
                  <TD className="text-sm text-gray-600">
                    {p.bank_accounts?.name ?? '—'}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Wallet}
              title={
                tab === 'open'
                  ? 'No open owner payables'
                  : tab === 'paid'
                    ? 'No paid owner payables in this view'
                    : 'No owner payables found'
              }
              description="Owner refunds, settlements, and distributions will appear here once created."
              action={
                <Link href="/bills/owner-payable/new">
                  <Button><Plus className="h-4 w-4" /> New owner payable</Button>
                </Link>
              }
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

function PayableTypeChip({ type }: { type: string }) {
  const labels: Record<string, string> = {
    refund: 'Refund',
    settlement: 'Settlement',
    distribution: 'Distribution',
    other: 'Other',
  };
  return <StatusChip tone="neutral">{labels[type] ?? type}</StatusChip>;
}

function OwnerPayableStatusChip({ status }: { status: string }) {
  switch (status) {
    case 'paid':      return <StatusChip tone="success">Paid</StatusChip>;
    case 'approved':  return <StatusChip tone="info">Approved</StatusChip>;
    case 'pending_approval': return <StatusChip tone="warning">Pending Approval</StatusChip>;
    case 'draft':     return <StatusChip tone="neutral">On Hold</StatusChip>;
    case 'void':      return <StatusChip tone="neutral">Void</StatusChip>;
    default:           return <StatusChip tone="neutral">{status}</StatusChip>;
  }
}

