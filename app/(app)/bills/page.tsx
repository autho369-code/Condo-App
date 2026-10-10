import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { ExportActions, type ExportTable } from '@/components/export/export-actions';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { bulkBillAction } from '@/lib/rpcs/bills';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { PayablesTabs } from '@/components/accounting/payables-tabs';
import { vendorAssociationLabel } from '@/lib/vendors/options';

export const dynamic = 'force-dynamic';

type PayableTab = 'bills' | 'payments';
type BillStatusFilter = 'all' | 'pending_approval' | 'my_approval' | 'on_hold' | 'approved';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_FILTERS: Array<{ key: BillStatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'my_approval', label: 'Pending My Approval' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'approved', label: 'Approved' },
];

function parseTab(value: string | undefined): PayableTab {
  switch (value) {
    case 'bills':
    case 'payments':
      return value;
    default:
      return 'bills';
  }
}

function parseStatus(value: string | undefined): BillStatusFilter {
  switch (value) {
    case 'all':
    case 'pending_approval':
    case 'my_approval':
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
  searchParams: Promise<{ tab?: string; status?: string; q?: string; association_id?: string; vendor_id?: string; bulk?: string; done?: string; failed?: string; reason?: string; error?: string; recorded?: string }>;
}) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const { tab: tabParam, status: statusParam, q = '' } = sp;
  const tab = parseTab(tabParam);
  const statusFilter = parseStatus(statusParam);
  const assoc = UUID.test(sp.association_id ?? '') ? sp.association_id! : '';
  const vendor = UUID.test(sp.vendor_id ?? '') ? sp.vendor_id! : '';
  const term = q.trim();
  // A double-quoted PostgREST value keeps commas, dots and brackets intact.
  const quoted = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const likeTerm = term.replace(/\*/g, ' ');
  const supabase = await createClient();
  const db = supabase as any;

  // Bills tab: every open (not paid/void), non-archived bill. Paid bills are on
  // the Payments tab. A 500-row window ordered by due date filled up with old
  // paid/void bills and dropped new open ones from the list and the metrics.
  const billsQuery = fetchAllRows(() => {
    let q = db.from('payable_bills')
      .select('id, bill_number, bill_date, due_date, amount, credit_applied, memo, status, paid_at, approved_at, approval_request_id, association_id, vendor_id, gl_account_id, bank_account_id, vendors(name, payment_type), associations(name), gl_accounts(number, name), bank_accounts(name)')
      .is('archived_at', null)
      .not('status', 'in', '("paid","void")');
    // Every status is loaded so the metrics stay complete; the status chips
    // filter the list below.
    if (assoc) q = q.eq('association_id', assoc);
    if (vendor) q = q.eq('vendor_id', vendor);
    return q.order('due_date', { ascending: true, nullsFirst: false }).order('id');
  }).then((r) => ({ data: r.rows, error: r.error }));

  // ── PARALLEL: fetch all tab data ──
  const [
    { data: allBills, error: billsError },
    { data: paidBills, count: paidMatching, error: paymentsError },
    { data: vendors },
    { data: associations },
    { data: glAccounts },
    { data: bankAccounts },
  ] = await Promise.all([
    // Bills tab: all non-archived bills
    billsQuery,
    // Payments tab: paid bills, filtered and searched in the database.
    (async () => {
      const clauses: string[] = [];
      if (term) {
        // Every matching vendor and association (no cap), so payments that
        // match only by name are never dropped.
        const [{ rows: vMatch }, { rows: aMatch }] = await Promise.all([
          fetchAllRows<any>(() => db.from('vendors').select('id').ilike('name', `%${term}%`).order('id')),
          fetchAllRows<any>(() => db.from('associations').select('id').ilike('name', `%${term}%`).order('id')),
        ]);
        clauses.push(`memo.ilike.${quoted(`*${likeTerm}*`)}`, `bill_number.ilike.${quoted(`*${likeTerm}*`)}`);
        if (/^\d+$/.test(term)) clauses.push(`check_number.eq.${term}`);
        const vIds = vMatch.map((v) => v.id);
        const aIds = aMatch.map((a) => a.id);
        if (vIds.length) clauses.push(`vendor_id.in.(${vIds.join(',')})`);
        if (aIds.length) clauses.push(`association_id.in.(${aIds.join(',')})`);
      }
      let p = db.from('payable_bills')
        .select('id, bill_number, bill_date, due_date, amount, credit_applied, memo, status, paid_at, check_number, association_id, vendor_id, vendors(name, payment_type), associations(name)', { count: 'exact' })
        .eq('status', 'paid')
        .is('archived_at', null);
      if (assoc) p = p.eq('association_id', assoc);
      if (vendor) p = p.eq('vendor_id', vendor);
      if (clauses.length) p = p.or(clauses.join(','));
      return p.order('paid_at', { ascending: false, nullsFirst: false }).order('id').limit(500);
    })(),
    // Vendors for filter
    fetchAllRows<any>(() => db.from('vendors')
      .select('id, name, is_management_company, associations(name)')
      .is('archived_at', null)
      .order('name').order('id')).then((r) => ({ data: r.rows })),
    // Associations for filter
    fetchAllRows<any>(() => db.from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name').order('id')).then((r) => ({ data: r.rows })),
    // GL accounts for context
    db.from('gl_accounts')
      .select('id, number, name')
      .order('number'),
    // Bank accounts for context
    fetchAllRows<any>(() => db.from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .order('name').order('id')).then((r) => ({ data: r.rows })),
  ]);

  // ── FILTER BILLS by status ──
  let filteredBills = (allBills ?? []);
  if (statusFilter !== 'all') {
    if (statusFilter === 'on_hold') {
      // "On Hold" maps to draft status in the DB
      filteredBills = filteredBills.filter((b: any) => b.status === 'draft');
    } else if (statusFilter === 'my_approval') {
      // Waiting on management's own approval: bills not routed to the board.
      filteredBills = filteredBills.filter((b: any) => b.status === 'pending_approval' && !b.approval_request_id);
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

  const actionableCount = filteredBills.filter((b: any) => b.status === 'draft' || b.status === 'pending_approval').length;

  const filteredPayments = (paidBills ?? []) as any[];

  // ── METRICS ──
  const today = todayInZone();

  const openCount = (allBills ?? []).filter(
    (b: any) => b.status !== 'paid' && b.status !== 'void',
  ).length;

  const pendingApprovalBills = (allBills ?? []).filter(
    (b: any) => b.status === 'pending_approval',
  );
  const pendingApprovalCount = pendingApprovalBills.length;
  const pendingApprovalTotal = pendingApprovalBills.reduce(
    (s: number, b: any) => s + Number(b.amount ?? 0) - Number(b.credit_applied ?? 0),
    0,
  );

  const approvedBills = (allBills ?? []).filter(
    (b: any) => b.status === 'approved',
  );
  const approvedCount = approvedBills.length;
  const approvedTotal = approvedBills.reduce(
    (s: number, b: any) => s + Number(b.amount ?? 0) - Number(b.credit_applied ?? 0),
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
    (s: number, b: any) => s + Number(b.amount ?? 0) - Number(b.credit_applied ?? 0),
    0,
  );

  const metrics: Metric[] = [
    { label: 'Open bills', value: openCount, sublabel: 'Not yet paid' },
    { label: 'Pending approval', value: pendingApprovalCount, sublabel: `${money(pendingApprovalTotal)}` },
    { label: 'Approved', value: approvedCount, sublabel: `${money(approvedTotal)}` },
    { label: 'Overdue', value: overdueCount, sublabel: `${money(overdueTotal)}` },
  ];

  // ── EXPORT (mirrors the active tab's on-screen table, same filters) ──
  const companyName = me.portfolio?.company_name ?? 'Management company';
  const exportStamp = today;
  const exportTable: ExportTable | null =
    tab === 'bills'
      ? {
          title: 'Bills',
          columns: [
            { header: 'Payee' },
            { header: 'Ref #' },
            { header: 'Bill Date' },
            { header: 'For' },
            { header: 'GL Account' },
            { header: 'Due Date' },
            { header: 'Amount owed', align: 'right' },
            { header: 'Status' },
            { header: 'Cash Account' },
          ],
          rows: filteredBills.map((b: any) => [
            `${b.vendors?.name ?? '—'}${b.vendors?.payment_type ? ` - ${b.vendors.payment_type}` : ''}`,
            b.bill_number ?? '—',
            date(b.bill_date),
            b.associations?.name ?? '—',
            b.gl_accounts ? `${b.gl_accounts.number}: ${b.gl_accounts.name}` : '—',
            date(b.due_date),
            money(Number(b.amount ?? 0) - Number(b.credit_applied ?? 0)),
            billStatusLabel(b.status),
            b.bank_accounts?.name ?? '—',
          ]),
        }
      : tab === 'payments'
      ? {
          title: 'Payments',
          columns: [
            { header: 'Payee' },
            { header: 'For' },
            { header: 'Memo' },
            { header: 'Cash paid', align: 'right' },
            { header: 'Bill Date' },
            { header: 'Paid' },
          ],
          rows: filteredPayments.map((b: any) => [
            b.vendors?.name ?? '—',
            b.associations?.name ?? '—',
            b.memo ?? '—',
            money(Number(b.amount ?? 0) - Number(b.credit_applied ?? 0)),
            date(b.bill_date),
            date(b.paid_at),
          ]),
        }
      : null;

  return (
    <DataWorkspace
      title="Payables"
      description="Vendor bills, payments, recurring payables, loans, and online payment tracking."
      actions={
        <>
          {exportTable && (
            <ExportActions
              documentTitle="Vendor Bills"
              companyName={companyName}
              filename={`vendor-bills-${tab}-${exportStamp}`}
              tables={[exportTable]}
            />
          )}
          <Link href="/bills/new">
            <Button><Plus className="h-4 w-4" /> New bill</Button>
          </Link>
          <Link href="/bills/check-run">
            <Button variant="secondary">Pay bills</Button>
          </Link>
          <Link href="/bills/recurring">
            <Button variant="secondary">Recurring bills</Button>
          </Link>
          <Link href="/bills/credits">
            <Button variant="secondary">Vendor credits</Button>
          </Link>
          <Link href="/bills/upload">
            <Button variant="secondary">Upload bills</Button>
          </Link>
          <Link href="/accounting/management-fees">
            <Button variant="secondary">Pay management fees</Button>
          </Link>
          <Link href="/bills/owner-payable">
            <Button variant="secondary">Homeowner payable</Button>
          </Link>
          <Link href="/bank-transfers/new">
            <Button variant="secondary">Transfer between accounts</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        <PayablesTabs
          current={tab}
          filters={new URLSearchParams([...(assoc ? [['association_id', assoc]] : []), ...(vendor ? [['vendor_id', vendor]] : [])])}
        />

        {/* ── STATUS SUB-FILTERS (only for Bills tab) ── */}
        {tab === 'bills' && (
          <nav className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => {
              const active = f.key === statusFilter;
              const params = new URLSearchParams();
              params.set('tab', 'bills');
              if (f.key !== 'all') params.set('status', f.key);
              if (q) params.set('q', q);
              if (assoc) params.set('association_id', assoc);
              if (vendor) params.set('vendor_id', vendor);
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
          <FilterSelect label="Association" name="association_id" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Vendor" name="vendor_id" defaultValue={vendor}>
            <option value="">All vendors</option>
            {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name} · {vendorAssociationLabel(v)}</option>)}
          </FilterSelect>
        </FilterBar>

        {sp.bulk && (
          <Alert tone={sp.failed ? 'danger' : 'success'} title={`${sp.done ?? 0} bill${sp.done === '1' ? '' : 's'} ${sp.bulk === 'submit' ? 'submitted for approval' : 'approved'}${sp.failed ? ` · ${sp.failed} could not be` : ''}`}>
            {sp.reason}
          </Alert>
        )}
        {sp.error && <Alert tone="danger" title="Could not update bills">{sp.error}</Alert>}
        {billsError && <Alert tone="danger" title="Could not load bills">{billsError}</Alert>}
        {paymentsError && <Alert tone="danger" title="Could not load payments">{paymentsError.message ?? String(paymentsError)}</Alert>}
        {sp.recorded && <Alert tone="success" title={`${Number(sp.recorded) || 0} payment${sp.recorded === '1' ? '' : 's'} recorded`} />}

        {/* ── TAB: BILLS ── */}
        {tab === 'bills' && (
          <>
            {filteredBills.length > 0 ? (
              <form action={bulkBillAction} className="space-y-3">
              <input type="hidden" name="back" value={`/bills?tab=bills${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`} />
              {actionableCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <p className="text-sm text-gray-600">Select draft or pending bills, then send them to the board or approve them together.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="op" value="submit" variant="secondary" size="sm">Submit selected for approval</Button>
                    <Button type="submit" name="op" value="approve" size="sm">Approve selected</Button>
                  </div>
                </div>
              )}
              <Table>
                <THead>
                  <TR>
                    <TH className="w-10">{actionableCount > 0 && <SelectAllCheckbox targetName="bill_id" defaultChecked={false} />}</TH>
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
                      <TD>
                        {(b.status === 'draft' || b.status === 'pending_approval') && (
                          <input type="checkbox" name="bill_id" value={b.id} aria-label={`Select bill from ${b.vendors?.name ?? 'vendor'}`} className="h-4 w-4 rounded border-gray-300" />
                        )}
                      </TD>
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
                        {money(Number(b.amount ?? 0) - Number(b.credit_applied ?? 0))}
                        {Number(b.credit_applied ?? 0) > 0 && (
                          <span className="block text-xs font-normal text-gray-500">of {money(b.amount)} after {money(b.credit_applied)} credit</span>
                        )}
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
              </form>
            ) : (
              <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
                        {money(Number(b.amount ?? 0) - Number(b.credit_applied ?? 0))}
                        {Number(b.credit_applied ?? 0) > 0 && (
                          <span className="block text-xs font-normal text-gray-500">+ {money(b.credit_applied)} vendor credit</span>
                        )}
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
              <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState icon={Receipt} title="No paid bills in this view" />
              </div>
            )}
            {(paidMatching ?? 0) > filteredPayments.length && (
              <p className="text-[13px] text-gray-500">
                Showing the latest {filteredPayments.length} of {paidMatching} payments. Narrow with search, an association or a vendor to see older ones.
              </p>
            )}
          </>
        )}

      </div>
    </DataWorkspace>
  );
}

function billStatusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'approved':
      return 'Approved';
    case 'pending_approval':
      return 'Pending Approval';
    case 'draft':
      return 'On Hold';
    case 'void':
      return 'Void';
    default:
      return status;
  }
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

