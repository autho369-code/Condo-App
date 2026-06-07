import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';
import type { Database } from '@/lib/types/database';

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
      .select('id, bill_number, bill_date, due_date, amount, memo, status, paid_at, approved_at, association_id, vendor_id, gl_account_id, bank_account_id, vendors(name, payment_type), associations(name), gl_accounts(code, name), bank_accounts(name)')
      .is('archived_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(500),
    // Payments tab: paid bills
    db.from('payable_bills')
      .select('id, bill_number, bill_date, due_date, amount, memo, status, paid_at, association_id, vendor_id, vendors(name, payment_type), associations(name)')
      .is('archived_at', null)
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
      .select('id, code, name')
      .is('archived_at', null)
      .order('code'),
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
        <div className="flex gap-2">
          <Link href="/bills/new">
            <Button>+ New bill</Button>
          </Link>
          <Link href="/bills/check-run">
            <Button variant="secondary">Run checks</Button>
          </Link>
        </div>
      }
      rail={<PayablesRail />}
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── MAIN TABS (Bills, Payments, Recurring, Loans, Online Payables) ── */}
        <nav className="flex flex-wrap gap-1 border-b border-gray-200">
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
                        <Link href={`/bills/${b.id}`} className="text-blue-700 hover:underline">
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
                        {b.gl_accounts ? `${b.gl_accounts.code}: ${b.gl_accounts.name}` : '—'}
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
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No bills in this view.
              </p>
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
                        <Link href={`/bills/${b.id}`} className="text-blue-700 hover:underline">
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
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No paid bills in this view.
              </p>
            )}
          </>
        )}

        {/* ── TAB: RECURRING ── */}
        {tab === 'recurring' && (
          <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            Recurring bills module coming soon. Use this section to manage automatically recurring vendor bills.
          </p>
        )}

        {/* ── TAB: LOANS ── */}
        {tab === 'loans' && (
          <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            Loans and loan payables tracking coming soon. This section will track association loan balances, payment schedules, and amortization.
          </p>
        )}

        {/* ── TAB: ONLINE PAYABLES ── */}
        {tab === 'online-payables' && (
          <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            Online payables coming soon. This section will manage eCheck, ACH, and online vendor payments.
          </p>
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

function PayablesRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/bills/new" label="Enter Bill" />
          <RailLink href="/bills/new?smart=true" label="Smart Bill Entry" placeholder />
          <RailLink href="/settings/email" label="User Email Settings" placeholder />
          <RailLink href="/bills/new?type=credit" label="Enter Credit" placeholder />
          <RailLink href="/bills/check-run" label="Pay Bills" />
          <RailLink href="/bills/pay-management-fees" label="Pay Management Fees" placeholder />
          <RailLink href="/bills/owner-payable" label="Owner Payable" placeholder />
          <RailLink href="/bank-transfers/new" label="Transfer Funds Between Cash Accounts" placeholder />
          <RailLink href="/bills/new?recurring=true" label="New Recurring Bill" placeholder />
          <RailLink href="/bills/manual-post" label="Manually Post Bills" placeholder />
          <RailLink href="/bills/bulk-upload" label="Upload Bulk Bills" placeholder />
          <RailLink href="/bills/bulk-board-approval" label="Bulk Board Approval" placeholder />
        </div>
      </section>

      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Reports</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports/aged_payables_summary" label="Aged Payables Summary" placeholder />
          <RailLink href="/reports/check_register" label="Check Register" placeholder />
          <RailLink href="/reports/bill_detail" label="Bill Detail" placeholder />
          <RailLink href="/reports/vendor_ledger" label="Vendor Ledger" placeholder />
          <RailLink href="/reports/vendor_ledger_enhanced" label="Vendor Ledger Enhanced" placeholder />
        </div>
      </section>
    </div>
  );
}

function RailLink({ href, label, placeholder }: { href: string; label: string; placeholder?: boolean }) {
  if (placeholder) {
    return (
      <span className="rounded border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {label}
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Placeholder</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}
