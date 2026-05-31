import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ReceivablePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();

  const supabase = await createClient();

  // Fetch receipts — from charges where payment_status = 'paid' or direct payments
  const { data: receipts } = await (supabase as any)
    .from('charges')
    .select(`
      id,
      occurred_on,
      amount,
      reference,
      payment_status,
      owners!charges_owner_id_fkey(full_name, first_name, last_name),
      units(unit_number, buildings(name, associations(name)))
    `)
    .eq('payment_status', 'paid')
    .order('occurred_on', { ascending: false })
    .limit(50);

  const rows = (receipts ?? []).map((r: any) => {
    const owner = r.owners;
    const unit = r.units;
    const association = unit?.buildings?.associations;
    return {
      id: r.id,
      date: r.occurred_on,
      payer: owner ? `${owner.last_name ?? ''}, ${owner.first_name ?? ''}`.replace(/^, /, '') : owner?.full_name ?? '—',
      glAccount: '2300: Prepaid Assessment',
      propertyUnit: association?.name ? `${association.name} Unit ${unit?.unit_number ?? '—'}` : '—',
      amount: r.amount,
      reference: r.reference ?? '—',
    };
  });

  if (q) {
    // filter
  }

  const accountingTabs = [
    { label: 'Receivables', href: '/receivable-payments', active: true },
    { label: 'Payables', href: '/bills', active: false },
    { label: 'Bank Accounts', href: '/bank-accounts', active: false },
    { label: 'Journal Entries', href: '/journal-entries', active: false },
    { label: 'Bank Transfers', href: '/bank-transfers', active: false },
    { label: 'GL Accounts', href: '/gl-accounts', active: false },
    { label: 'Diagnostics', href: '/diagnostics', active: false },
  ];

  const subTabs = [
    { label: 'Receipts', href: '/receivable-payments', active: true },
    { label: 'Charges', href: '/charges', active: false },
    { label: 'Bank Deposits', href: '/bank-accounts/deposits/new', active: false },
    { label: 'Owner Delinquencies', href: '/reports?slug=delinquency', active: false },
  ];

  return (
    <DataWorkspace
      title="Receipts"
      description="Record and review owner payments, online receipts, and manual deposits."
    >
      {/* Accounting sub-navigation */}
      <nav className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 pb-2 text-sm">
        {accountingTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-t px-3 py-1.5 ${tab.active ? 'border-b-2 border-brand-600 font-semibold text-brand-700 bg-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Secondary tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200 pb-2 text-sm">
        {subTabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`px-3 py-1.5 rounded-t ${tab.active ? 'border-b-2 border-blue-600 font-semibold text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <form action="/receivable-payments" method="get" className="relative">
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Click here to search"
            className="w-full rounded border border-gray-300 bg-white px-4 py-2 pr-10 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7 1a6 6 0 100 12 6 6 0 000-12zm0 1a5 5 0 11.001 10.001A5 5 0 017 2zm4.146 8.854l3.5 3.5-.708.708-3.5-3.5.708-.708z" fill="currentColor"/></svg>
          </button>
        </form>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Payer</th>
              <th className="px-4 py-3">GL Account</th>
              <th className="px-4 py-3">Property - Unit</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">No receipts found.</td>
              </tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{row.date ? new Date(row.date).toLocaleDateString('en-US') : '—'}</td>
                  <td className="px-4 py-3 text-gray-900">{row.payer}</td>
                  <td className="px-4 py-3 text-gray-600">{row.glAccount}</td>
                  <td className="px-4 py-3 text-gray-900">{row.propertyUnit}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">${(row.amount ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.reference}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DataWorkspace>
  );
}
