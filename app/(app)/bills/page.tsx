import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
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

type PayableTab = 'bills' | 'payments' | 'recurring' | 'loans' | 'online-payables';
type BillStatusFilter = 'all' | 'pending_approval' | 'on_hold' | 'approved';

const PAYABLE_TABS: Array<{ key: PayableTab; label: string }> = [
  { key: 'bills', label: 'Bills' },
  { key: 'payments', label: 'Payments' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'loans', label: 'Loans' },
  { key: 'online-payables', label: 'Online Payables' },
];

const STATUS_FILTERS: Array<{ key: BillStatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'approved', label: 'Approved' },
];

function parseTab(value: string | undefined): PayableTab {
  switch (value) {
    case 'bills':
    case 'payments':
    case 'recurring':
    case 'loans':
    case 'online-payables':
      return value;
    default:
      return 'bills';
  }
}

function parseStatus(value: string | undefined): BillStatusFilter {
  switch (value) {
    case 'all':
    case 'pending_approval':
    case 'on_hold':
    case 'approved':
      return value;
    default:
      return 'all';
  }
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; q?: string }>;
}) {
  await requireStaff();
  const { tab: tabParam, status: statusParam, q = '' } = await searchParams;
  const tab = parseTab(tabParam);
  const statusFilter = parseStatus(statusParam);
  const supabase = await createClient();
  const db = supabase as any;

  // ── PARALLEL: fetch all tab data ──
  const [
    { data: allBills },
    { data: paidBills },
    { data: vendors },
    { data: associations },
    { data: glAccounts },
    { data: bankAccounts },
  ] = await Promise.all([
    // Bills tab: all non-archived bills
    db.from('payable_bills')
      .select('id, bill_number, bill_date, due_date, amount, memo, status, paid_at, approved_at, association_id, vendor_id, gl_account_id, bank_account_id, vendors(name, payment_type), associations(name), gl_accounts(number, name), bank_accounts(name)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(500),
    // Payments tab: paid bills
    db.from('payable_bills')
      .select('id, bill_number, bill_date, due_date, amount, memo, status, paid_at, association_id, vendor_id, vendors(name, payment_type), associations(name)')
      .eq('status', 'paid')
      .order('paid_at', { ascending: false, nullsFirst: false })
      .limit(500),
    // Vendors for filter
    db.from('vendors')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    // Associations for filter
    db.from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    // GL accounts for context
    db.from('gl_accounts')
      .select('id, number, name')
      .order('number'),
    // Bank accounts for context
    db.from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .order('name'),
  ]);

  // ── FILTER BILLS by status ──
  let filteredBills = (allBills ?? []);
  if (statusFilter !== 'all') {
    if (statusFilter === 'on_hold') {
      // "On Hold" maps to draft status in the DB
      filteredBills = filteredBills.filter((b: any) => b.status === 'draft');
    } else {
      filteredBills = filteredBills.filter((b: any) => b.status === statusFilter);
    }
  }

  // ── SEARCH within bills ──
  if (q && tab === 'bills') {
    const ql = q.toLowerCase();
    filteredBills = filteredBills.filter(
      (b: any) =>
        (b.vendors?.name ?? '').toLowerCase().includes(ql) ||
        (b.memo ?? '').toLowerCase().includes(ql) ||
        (b.associations?.name ?? '').toLowerCase().includes(ql) ||
        (b.bill_number ?? '').toLowerCase().includes(ql) ||
        (b.gl_accounts?.name ?? '').toLowerCase().includes(ql),
    );
  }

  // ── FILTER PAID BILLS by search ──
  let filteredPayments = (paidBills ?? []);
  if (q && tab === 'payments') {
    const ql = q.toLowerCase();
    filteredPayments = filteredPayments.filter(
      (b: any) =>
        (b.vendors?.name ?? '').toLowerCase().includes(ql) ||
        (b.memo ?? '').toLowerCase().includes(ql) ||
        (b.associations?.name ?? '').toLowerCase().includes(ql),
    );
  }

  // ── METRICS ──
  const today = new Date().toISOString().slice(0, 10);

  const openCount = (allBills ?? []).filter(
    (b: any) => b.status !== 'paid' && b.status !== 'void',
  ).length;

  const pendingApprovalBills = (allBills ?? []).filter(
    (b: any) => b.status === 'pending_approval',
  );
  const pendingApprovalCount = pendingApprovalBills.length;
  const pendingApprovalTotal = pendingApprovalBills.reduce(
    (s: number, b: any) => s + Number(b.amount ?? 0),
    0,
  );

  const approvedBills = (allBills ?? []).filter(
    (b: any) => b.status === 'approved',
  );
  const approvedCount = approvedBills.length;
  const approvedTotal = approvedBills.reduce(
    (s: number, b: any) => s + Number(b.amount ?? 0),
    0,
  );

  const overdueBills = (allBills ?? []).filter(
    (b: any) =>
      b.status !== 'paid' &&
      b.status !== 'void' &&
      b.due_date &&
      b.due_date < today,
  );
  const overdueCount = overdueBills.length;
  const overdueTotal = overdueBills.reduce(
    (s: number, b: any) => s + Number(b.amount ?? 0),
    0,
  );

  const metrics: Metric[] = [
    { label: 'Open bills', value: openCount, sublabel: `${(allBills ?? []).length} total` },
    { label: 'Pending approval', value: pendingApprovalCount, sublabel: `${money(pendingApprovalTotal)}` },
    { label: 'Approved', value: approvedCount, sublabel: `${money(approvedTotal)}` },
    { label: 'Overdue', value: overdueCount, sublabel: `${money(overdueTotal)}` },
  ];

  return (
    <DataWorkspace
      title="Payables"
      description="Vendor bills, payments, recurring payables, loans, and online payment tracking."
      actions={
        <>
          <Link href="/bills/new">
            <Button><Plus className="h-4 w-4" /> New bill</Button>
          </Link>
          <Link href="/bills/check-run">
            <Button variant="secondary">Run checks</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── MAIN TABS (Bills, Payments, Recurring, Loans, Online Payables) ── */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {PAYABLE_TABS.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            if (t.key === 'bills' && statusFilter !== 'all') {
              params.set('status', statusFilter);
            }
            return (
              <Link
                key={t.key}
                href={`/bills?${params.toString()}`}
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

        {/* ── STATUS SUB-FILTERS (only for Bills tab) ── */}
        {tab === 'bills' && (
          <nav className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => {
              const active = f.key === statusFilter;
              const params = new URLSearchParams();
              params.set('tab', 'bills');
              if (f.key !== 'all') params.set('status', f.key);
              if (q) params.set('q', q);
              return (
                <Link
                  key={f.key}
                  href={`/bills?${params.toString()}`}
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
        )}

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/bills"
          searchDefault={q}
          searchPlaceholder={
            tab === 'bills'
              ? 'Search vendor, memo, association, bill #...'
              : tab === 'payments'
              ? 'Search vendor, memo, association...'
              : 'Search...'
          }
        >
          <input type="hidden" name="tab" value={tab} />
          {statusFilter !== 'all' && <input type="hidden" name="status" value={statusFilter} />}
        </FilterBar>

        {/* ── TAB: BILLS ── */}
        {tab === 'bills' && (
          <>
            {filteredBills.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Payee</TH>
                    <TH>Ref #</TH>
                    <TH>Bill Date</TH>
                    <TH>For</TH>
                    <TH>GL Account</TH>
                    <TH>Due Date</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Status</TH>
                    <TH>Cash Account</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredBills.map((b: any) => (
                    <TR key={b.id}>
                      <TD className="font-medium">
                        <Link href={`/bills/${b.id}`} className="text-gray-900 hover:text-gray-950 hover:underline">
                          {b.vendors?.name ?? '—'}
                        </Link>
                        {b.vendors?.payment_type && (
                          <span className="ml-1 text-xs text-gray-400">
                            - {b.vendors.payment_type}
                          </span>
                        )}
                      </TD>
                      <TD className="text-sm text-gray-600 tabular-nums">
                        {b.bill_number ?? '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">
                        {date(b.bill_date)}
                      </TD>
                      <TD className="max-w-[180px] truncate text-sm text-gray-700">
                        {b.associations?.name ?? '—'}
                      </TD>
                      <TD className="text-sm text-gray-600">
                        {b.gl_accounts ? `${b.gl_accounts.number}: ${b.gl_accounts.name}` : '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">
                        {date(b.due_date)}
                      </TD>
                      <TD className="text-right tabular-nums font-medium text-gray-900">
                        {money(b.amount)}
                      </TD>
                      <TD>
                        <BillStatusChip status={b.status} />
                      </TD>
                      <TD className="text-sm text-gray-600">
                        {b.bank_accounts?.name ?? '—'}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={Receipt}
                  title="No bills in this view"
                  description="Adjust the filters or enter a new vendor bill."
                  action={
                    <Link href="/bills/new">
                      <Button><Plus className="h-4 w-4" /> New bill</Button>
                    </Link>
                  }
                />
              </div>
            )}
          </>
        )}

        {/* ── TAB: PAYMENTS ── */}
        {tab === 'payments' && (
          <>
            {filteredPayments.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Payee</TH>
                    <TH>For</TH>
                    <TH>Memo</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Bill Date</TH>
                    <TH>Paid</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredPayments.map((b: any) => (
                    <TR key={b.id}>
                      <TD className="font-medium">
                        <Link href={`/bills/${b.id}`} className="text-gray-900 hover:text-gray-950 hover:underline">
                          {b.vendors?.name ?? '—'}
                        </Link>
                      </TD>
                      <TD className="max-w-[180px] truncate text-sm text-gray-700">
                        {b.associations?.name ?? '—'}
                      </TD>
                      <TD className="max-w-sm truncate text-sm text-gray-600" title={b.memo ?? ''}>
                        {b.memo ?? '—'}
                      </TD>
                      <TD className="text-right tabular-nums font-medium text-gray-900">
                        {money(b.amount)}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">
                        {date(b.bill_date)}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">
                        {date(b.paid_at)}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState icon={Receipt} title="No paid bills in this view" />
              </div>
            )}
          </>
        )}

        {/* ── TAB: RECURRING ── */}
        {tab === 'recurring' && (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Receipt}
              title="Recurring bills coming soon"
              description="Use this section to manage automatically recurring vendor bills."
            />
          </div>
        )}

        {/* ── TAB: LOANS ── */}
        {tab === 'loans' && (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Receipt}
              title="Loans coming soon"
              description="This section will track association loan balances, payment schedules, and amortization."
            />
          </div>
        )}

        {/* ── TAB: ONLINE PAYABLES ── */}
        {tab === 'online-payables' && (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Receipt}
              title="Online payables coming soon"
              description="This section will manage eCheck, ACH, and online vendor payments."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

function BillStatusChip({ status }: { status: string }) {
  switch (status) {
    case 'paid':
      return <StatusChip tone="success">Paid</StatusChip>;
    case 'approved':
      return <StatusChip tone="info">Approved</StatusChip>;
    case 'pending_approval':
      return <StatusChip tone="warning">Pending Approval</StatusChip>;
    case 'draft':
      return <StatusChip tone="neutral">On Hold</StatusChip>;
    case 'void':
      return <StatusChip tone="neutral">Void</StatusChip>;
    default:
      return <StatusChip tone="neutral">{status}</StatusChip>;
  }
}

