import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const tabs = [
  { label: 'Receivables', href: '/charges' },
  { label: 'Receipts', href: '/accounting/receivable-payments' },
  { label: 'Bank Accounts', href: '/bank-accounts' },
  { label: 'Journal Entries', href: '/journal-entries' },
  { label: 'Bank Transfers', href: '/bank-transfers' },
  { label: 'GL Accounts', href: '/gl-accounts' },
  { label: 'Diagnostics', href: '/diagnostics' },
];

type ReceiptRow = {
  payment_id: string;
  payment_date: string | null;
  amount: number | string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string | null;
  unit_id: string | null;
  unit_number: string | null;
  association_id: string | null;
  association_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  charge_id: string | null;
  receipt_description: string | null;
  bank_account_id: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  applied_amount: number | string | null;
  unapplied_amount: number | string | null;
  application_count: number | null;
};

export default async function ReceivablePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; method?: string; association_id?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();
  const page = Math.max(Number(params.page ?? '1') || 1, 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [{ data: associations }, { data: payments, count }] = await Promise.all([
    supabase.from('associations').select('id, name').is('archived_at', null).order('name'),
    buildPaymentQuery(supabase, params).range(from, to),
  ]);

  const rows = (payments ?? []).map((payment: ReceiptRow) => normalizeReceipt(payment));
  const total = count ?? rows.length;
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="flex h-full bg-white">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <main className="mx-auto max-w-5xl px-8 py-5">
        <nav className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={tab.href === '/accounting/receivable-payments' ? 'text-blue-700 underline' : 'text-gray-900 hover:text-blue-700'}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <h1 className="text-xl font-semibold text-gray-900">Receipts</h1>

        <form action="/accounting/receivable-payments" className="mt-3">
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
            <label className="text-xs text-gray-600">
              Method
              <select name="method" defaultValue={params.method ?? ''} className="ml-2 h-8 border border-gray-300 bg-white px-2 text-sm capitalize text-gray-900">
                <option value="">All methods</option>
                <option value="ach">ACH</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
              </select>
            </label>
            <button className="h-8 border border-gray-900 px-4 text-sm font-medium text-gray-900" type="submit">Search</button>
            <Link href="/accounting/receivable-payments" className="inline-flex h-8 items-center border border-gray-900 px-4 text-sm font-medium text-gray-900">Clear</Link>
          </div>
        </form>

        <section className="mt-4 border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-100 text-left font-semibold text-gray-800">
              <tr>
                <th className="border-b border-gray-300 px-2 py-2">Date</th>
                <th className="border-b border-gray-300 px-2 py-2">Payer</th>
                <th className="border-b border-gray-300 px-2 py-2">GL Account</th>
                <th className="border-b border-gray-300 px-2 py-2">Property - Unit</th>
                <th className="border-b border-gray-300 px-2 py-2 text-right">Amount</th>
                <th className="border-b border-gray-300 px-2 py-2">Reference #</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((receipt) => (
                <tr key={receipt.id} className="border-b border-gray-200 hover:bg-blue-50/40">
                  <td className="whitespace-nowrap px-2 py-2 text-gray-900">{date(receipt.paymentDate)}</td>
                  <td className="px-2 py-2 font-medium text-gray-900">
                    <Link href={receipt.unitHref} className="hover:text-blue-700 hover:underline">{receipt.payer}</Link>
                  </td>
                  <td className="px-2 py-2 text-gray-800">
                    <div>{receipt.glAccount}</div>
                    <div className="text-[11px] text-gray-500">{receipt.bankAccount}</div>
                  </td>
                  <td className="px-2 py-2 text-gray-800">
                    <Link href={receipt.associationHref} className="font-medium text-blue-700 hover:underline">{receipt.associationName}</Link>
                    <div className="text-[11px] text-gray-600">{receipt.unitLabel}</div>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    <Link href={`/bank-accounts/activity?source=payment&q=${encodeURIComponent(receipt.reference ?? receipt.id)}`} className="text-blue-700 hover:underline">
                      {money(receipt.amount)}
                    </Link>
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-gray-800">{receipt.reference ?? '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">No receipts match this view.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-gray-200 px-2 py-2 text-xs text-gray-700">
            <span>Displaying {total === 0 ? 0 : from + 1}-{Math.min(to + 1, total)} of {total}</span>
            <div className="flex items-center gap-2">
              <PageLink page={Math.max(page - 1, 1)} disabled={page <= 1} params={params}>‹</PageLink>
              {Array.from({ length: Math.min(lastPage, 5) }, (_, index) => index + 1).map((pageNumber) => (
                <PageLink key={pageNumber} page={pageNumber} active={pageNumber === page} params={params}>{pageNumber}</PageLink>
              ))}
              <PageLink page={Math.min(page + 1, lastPage)} disabled={page >= lastPage} params={params}>›</PageLink>
            </div>
          </div>
        </section>

        <footer className="mt-5 flex gap-2 text-xs font-medium">
          <Link className="text-blue-700 hover:underline" href="/settings">Privacy</Link>
          <span>|</span>
          <Link className="text-blue-700 hover:underline" href="/reports/payment_register">Help & Training</Link>
          <span>|</span>
          <Link className="text-blue-700 hover:underline" href="/reports/unapplied_receipts">Notice Suggestions</Link>
        </footer>
        </main>
      </div>
      <ReceiptTasksPanel />
    </div>
  );
}

function ReceiptTasksPanel() {
  return (
    <ContextPanel title="Tasks">
      <PanelSection title="My Tasks">
        <PanelLink href="/charges/new?type=resident_refund">Resident Refund</PanelLink>
        <PanelLink href="/charges/new?type=owner_refund">Owner Refund</PanelLink>
        <PanelLink href="/charges/new?type=security_deposit">Security Deposits</PanelLink>
        <PanelLink href="/charges/new?type=insurance">Insurance Charge</PanelLink>
        <PanelLink href="/charges/new?type=late_fee">Late Charge</PanelLink>
        <PanelLink href="/charges/new?type=nsf_fee">NSF Charge</PanelLink>
        <PanelLink href="/charges/new?type=interest">Interest Charge</PanelLink>
      </PanelSection>
      <PanelSection title="Help Topics">
        <PanelLink href="/accounting/receivable-payments">Receipts</PanelLink>
        <PanelLink href="/charges">Receivables</PanelLink>
        <PanelLink href="/bank-accounts/activity">Bank Account Activity</PanelLink>
        <PanelLink href="/reports?q=receipt">Receipt Reports</PanelLink>
      </PanelSection>
      <PanelSection title="Useful Links">
        <PanelLink href="/reports/payment_register">Payment Register</PanelLink>
        <PanelLink href="/reports/deposit_register">Deposit Register</PanelLink>
        <PanelLink href="/reports/unapplied_receipts">Unapplied Receipts</PanelLink>
        <PanelLink href="/bank-accounts/activity">Bank Account Activity</PanelLink>
        <PanelLink href="/reports/cash_flow">Cash Flow</PanelLink>
      </PanelSection>
    </ContextPanel>
  );
}

function buildPaymentQuery(supabase: Awaited<ReturnType<typeof createClient>>, params: { q?: string; method?: string; association_id?: string }) {
  let query = supabase
    .from('receivable_payments_ledger')
    .select('*', { count: 'exact' })
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (params.method) query = query.eq('method', params.method);
  if (params.association_id) query = query.eq('association_id', params.association_id);
  if (params.q) {
    const term = `%${params.q}%`;
    query = query.or(`reference.ilike.${term},notes.ilike.${term},method.ilike.${term},owner_name.ilike.${term},association_name.ilike.${term},unit_number.ilike.${term},receipt_description.ilike.${term}`);
  }

  return query;
}

function normalizeReceipt(payment: ReceiptRow) {
  return {
    id: payment.payment_id,
    paymentDate: payment.payment_date,
    payer: payment.owner_name ?? receiptPayerFromNotes(payment.notes) ?? 'Unassigned payer',
    glAccount: payment.receipt_description ?? 'Receipt',
    bankAccount: [payment.bank_account_name, payment.bank_name].filter(Boolean).join(' - ') || 'Undeposited funds',
    associationName: payment.association_name ?? 'Unassigned association',
    associationHref: payment.association_id ? `/associations/${payment.association_id}` : '/associations',
    unitLabel: payment.unit_number ? `Unit ${payment.unit_number}` : 'No unit assigned',
    unitHref: payment.unit_id ? `/units/${payment.unit_id}` : '/units',
    amount: payment.amount,
    reference: payment.reference,
  };
}

function receiptPayerFromNotes(notes: string | null) {
  if (!notes) return null;
  return notes.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b.*$/i, '').trim() || notes;
}

function PageLink({
  page,
  params,
  active,
  disabled,
  children,
}: {
  page: number;
  params: { q?: string; method?: string; association_id?: string };
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const query = new URLSearchParams();
  query.set('page', String(page));
  if (params.q) query.set('q', params.q);
  if (params.method) query.set('method', params.method);
  if (params.association_id) query.set('association_id', params.association_id);
  return (
    <Link
      href={`/accounting/receivable-payments?${query.toString()}`}
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
