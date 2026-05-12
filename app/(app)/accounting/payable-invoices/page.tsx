import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const tabs = [
  { label: 'Receivables', href: '/charges' },
  { label: 'Payables', href: '/accounting/payable-invoices' },
  { label: 'Bank Accounts', href: '/bank-accounts' },
  { label: 'Journal Entries', href: '/journal-entries' },
  { label: 'Bank Transfers', href: '/bank-transfers' },
  { label: 'GL Accounts', href: '/gl-accounts' },
  { label: 'Diagnostics', href: '/diagnostics' },
];

const statusTabs = [
  { key: 'all', label: 'All' },
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'draft', label: 'Draft' },
  { key: 'paid', label: 'Paid' },
];

type PayableInvoice = {
  bill_id: string;
  bill_number: string | null;
  bill_date: string | null;
  due_date: string | null;
  occurred_on: string | null;
  created_at: string | null;
  amount: number | string | null;
  memo: string | null;
  status: string | null;
  status_label: string | null;
  task_label: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_payment_type: string | null;
  vendor_hold_payments: boolean | null;
  association_id: string | null;
  association_name: string | null;
  gl_account_number: string | null;
  gl_account_name: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  work_order_id: string | null;
  work_order_number: string | null;
  work_order_title: string | null;
};

export default async function PayableInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; association_id?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();
  const page = Math.max(Number(params.page ?? '1') || 1, 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const selectedStatus = statusTabs.some((tab) => tab.key === params.status) ? params.status! : 'all';

  const [{ data: associations }, { data: allStatuses }, { data: invoices, count }] = await Promise.all([
    supabase.from('associations').select('id, name').is('archived_at', null).order('name'),
    supabase.from('payable_invoices_ledger').select('status'),
    buildInvoiceQuery(supabase, { ...params, status: selectedStatus }).range(from, to),
  ]);

  const rows = (invoices ?? []) as PayableInvoice[];
  const total = count ?? rows.length;
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  const statusCounts = statusTabs.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.key] = tab.key === 'all'
      ? (allStatuses ?? []).length
      : (allStatuses ?? []).filter((row: any) => row.status === tab.key).length;
    return acc;
  }, {});

  return (
    <div className="flex h-full bg-white">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <main className="mx-auto max-w-5xl px-8 py-5">
        <nav className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={tab.href === '/accounting/payable-invoices' ? 'text-blue-700 underline' : 'text-gray-900 hover:text-blue-700'}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <nav className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
          <Link className="text-blue-700 underline" href="/accounting/payable-invoices">Bills</Link>
          <Link className="text-gray-900 hover:text-blue-700" href="/bills/check-run">Payments</Link>
          <Link className="text-gray-900 hover:text-blue-700" href="/vendors">Vendors</Link>
          <Link className="text-gray-900 hover:text-blue-700" href="/reports/bill_detail">Bill Templates</Link>
        </nav>

        <h1 className="text-xl font-semibold text-gray-900">Bills</h1>

        <form action="/accounting/payable-invoices" className="mt-3">
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Click here to search"
            className="h-9 w-full border border-blue-500 px-3 text-center text-sm outline-none focus:ring-1 focus:ring-blue-600"
          />
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-600">
              Association
              <select name="association_id" defaultValue={params.association_id ?? ''} className="ml-2 h-8 border border-gray-300 bg-white px-2 text-sm text-gray-900">
                <option value="">All associations</option>
                {(associations ?? []).map((association: any) => (
                  <option key={association.id} value={association.id}>{association.name}</option>
                ))}
              </select>
            </label>
            <button className="h-8 border border-gray-900 px-4 text-sm font-medium text-gray-900" type="submit">Search</button>
            <Link href="/accounting/payable-invoices" className="inline-flex h-8 items-center border border-gray-900 px-4 text-sm font-medium text-gray-900">Clear</Link>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-1 text-xs">
          {statusTabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/accounting/payable-invoices?status=${tab.key}`}
              className={[
                'border px-3 py-1.5 font-medium',
                selectedStatus === tab.key ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 bg-white text-gray-900 hover:border-blue-700',
              ].join(' ')}
            >
              {tab.label} ({statusCounts[tab.key] ?? 0})
            </Link>
          ))}
        </div>

        <section className="mt-3 border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-100 text-left font-semibold text-gray-800">
              <tr>
                <th className="border-b border-gray-300 px-2 py-2">Payee</th>
                <th className="border-b border-gray-300 px-2 py-2">Ref #</th>
                <th className="border-b border-gray-300 px-2 py-2">Memo</th>
                <th className="border-b border-gray-300 px-2 py-2">GL Account</th>
                <th className="border-b border-gray-300 px-2 py-2">Due Date</th>
                <th className="border-b border-gray-300 px-2 py-2 text-right">Amount</th>
                <th className="border-b border-gray-300 px-2 py-2">Status</th>
                <th className="border-b border-gray-300 px-2 py-2">Cash Account</th>
                <th className="border-b border-gray-300 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((invoice) => (
                <tr key={invoice.bill_id} className="border-b border-gray-200 hover:bg-blue-50/40">
                  <td className="px-2 py-2 font-medium text-gray-900">
                    <Link href={invoice.vendor_id ? `/vendors` : '/vendors'} className="hover:text-blue-700 hover:underline">
                      {invoice.vendor_name ?? 'Unassigned vendor'}
                    </Link>
                    <div className="text-[11px] text-gray-500">{invoice.vendor_payment_type ?? 'standard payment'}</div>
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-gray-800">{invoice.bill_number ?? '-'}</td>
                  <td className="max-w-48 px-2 py-2 text-gray-800">
                    <Link href={`/bills/${invoice.bill_id}`} className="hover:text-blue-700 hover:underline">{invoice.memo ?? 'No memo'}</Link>
                    <div className="text-[11px] text-gray-500">{invoice.work_order_number ?? invoice.work_order_title ?? ''}</div>
                  </td>
                  <td className="px-2 py-2 text-gray-800">
                    <div>{[invoice.gl_account_number, invoice.gl_account_name].filter(Boolean).join(' - ') || 'Unassigned'}</div>
                    <Link href={invoice.association_id ? `/associations/${invoice.association_id}` : '/associations'} className="text-[11px] text-blue-700 hover:underline">
                      {invoice.association_name ?? 'Unassigned association'}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-gray-900">{date(invoice.due_date)}</td>
                  <td className="px-2 py-2 text-right font-semibold">
                    <Link href={`/bills/${invoice.bill_id}`} className="text-blue-700 hover:underline">{money(invoice.amount)}</Link>
                  </td>
                  <td className="px-2 py-2">
                    <span className={statusClass(invoice.status)}>{invoice.status_label ?? invoice.status ?? 'Review'}</span>
                  </td>
                  <td className="px-2 py-2 text-gray-800">
                    {[invoice.bank_account_name, invoice.bank_name].filter(Boolean).join(' - ') || 'Held for check run'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link href={`/bills/${invoice.bill_id}`} className="text-blue-700 hover:underline">›</Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">No bills match this view.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-gray-200 px-2 py-2 text-xs text-gray-700">
            <span>Displaying {total === 0 ? 0 : from + 1}-{Math.min(to + 1, total)} of {total}</span>
            <div className="flex items-center gap-2">
              <PageLink page={Math.max(page - 1, 1)} disabled={page <= 1} params={{ ...params, status: selectedStatus }}>‹</PageLink>
              {Array.from({ length: Math.min(lastPage, 5) }, (_, index) => index + 1).map((pageNumber) => (
                <PageLink key={pageNumber} page={pageNumber} active={pageNumber === page} params={{ ...params, status: selectedStatus }}>{pageNumber}</PageLink>
              ))}
              <PageLink page={Math.min(page + 1, lastPage)} disabled={page >= lastPage} params={{ ...params, status: selectedStatus }}>›</PageLink>
            </div>
          </div>
        </section>

        <footer className="mt-5 flex gap-2 text-xs font-medium">
          <Link className="text-blue-700 hover:underline" href="/settings">Privacy</Link>
          <span>|</span>
          <Link className="text-blue-700 hover:underline" href="/reports/bill_detail">Help & Training</Link>
          <span>|</span>
          <Link className="text-blue-700 hover:underline" href="/reports/ap_aging">Notice Suggestions</Link>
        </footer>
        </main>
      </div>
      <PayableTasksPanel />
    </div>
  );
}

function PayableTasksPanel() {
  return (
    <ContextPanel title="Tasks">
      <PanelSection title="My Tasks">
        <PanelLink href="/bills/new">New Bill</PanelLink>
        <PanelLink href="/accounting/payable-invoices?status=pending_approval">Review Bills</PanelLink>
        <PanelLink href="/bills/check-run">Payments</PanelLink>
        <PanelLink href="/bills/check-run">Print Checks</PanelLink>
        <PanelLink href="/vendors/new">New Vendor</PanelLink>
        <PanelLink href="/purchase-orders">Purchase Orders</PanelLink>
      </PanelSection>
      <PanelSection title="Help Topics">
        <PanelLink href="/accounting/payable-invoices">Bills</PanelLink>
        <PanelLink href="/bills/check-run">Check Runs</PanelLink>
        <PanelLink href="/vendors">Vendors</PanelLink>
        <PanelLink href="/reports?q=payable">Payable Reports</PanelLink>
      </PanelSection>
      <PanelSection title="Useful Links">
        <PanelLink href="/reports/bill_detail">Bill Detail</PanelLink>
        <PanelLink href="/reports/ap_aging">A/P Aging</PanelLink>
        <PanelLink href="/reports/check_register">Check Register</PanelLink>
        <PanelLink href="/reports/vendor_1099_summary">Vendor 1099 Summary</PanelLink>
        <PanelLink href="/bank-accounts/activity">Bank Account Activity</PanelLink>
      </PanelSection>
    </ContextPanel>
  );
}

function buildInvoiceQuery(supabase: Awaited<ReturnType<typeof createClient>>, params: { q?: string; status?: string; association_id?: string }) {
  let query = supabase
    .from('payable_invoices_ledger')
    .select('*', { count: 'exact' })
    .order('occurred_on', { ascending: false, nullsFirst: false })
    .order('due_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.association_id) query = query.eq('association_id', params.association_id);
  if (params.q) {
    const term = `%${params.q}%`;
    query = query.or(`bill_number.ilike.${term},memo.ilike.${term},vendor_name.ilike.${term},association_name.ilike.${term},gl_account_name.ilike.${term},bank_account_name.ilike.${term}`);
  }

  return query;
}

function statusClass(status: string | null) {
  const base = 'inline-flex rounded px-2 py-0.5 text-[11px] font-medium';
  if (status === 'paid') return `${base} bg-green-100 text-green-700`;
  if (status === 'approved') return `${base} bg-blue-100 text-blue-700`;
  if (status === 'pending_approval') return `${base} bg-amber-100 text-amber-800`;
  if (status === 'draft') return `${base} bg-gray-100 text-gray-700`;
  return `${base} bg-gray-100 text-gray-500`;
}

function PageLink({
  page,
  params,
  active,
  disabled,
  children,
}: {
  page: number;
  params: { q?: string; status?: string; association_id?: string };
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const query = new URLSearchParams();
  query.set('page', String(page));
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.association_id) query.set('association_id', params.association_id);
  return (
    <Link
      href={`/accounting/payable-invoices?${query.toString()}`}
      aria-disabled={disabled}
      className={[
        'inline-flex h-5 min-w-5 items-center justify-center px-1',
        active ? 'bg-blue-100 font-semibold text-blue-800' : 'text-gray-700 hover:text-blue-700',
        disabled ? 'pointer-events-none text-gray-300' : '',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
