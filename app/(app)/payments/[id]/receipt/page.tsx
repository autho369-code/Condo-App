import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from '@/components/ui/print-button';
import { Button } from '@/components/ui/button';
import { receiptMethodLabel } from '@/lib/payments/methods';
import { money } from '@/lib/utils';
import { displayTimeZone } from '@/lib/time/display-zone';

export const dynamic = 'force-dynamic';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';

// Printable payment receipt (for cash, money orders and checks taken at the
// office). RLS limits the payment to staff who can see the unit.
export default async function PaymentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const db = (await createClient()) as any;
  const { data: p } = await db.from('payments')
    .select('id, amount, payment_date, method, reference, notes, created_at, unit_id, units(unit_number, buildings(associations(name, address, city, state, zip, portfolios(company_name, support_email))))')
    .eq('id', id).maybeSingle();
  if (!p) notFound();

  const [{ data: owners }, { data: applied }, { data: balance }] = await Promise.all([
    db.from('occupancies').select('owners(full_name)').eq('unit_id', p.unit_id).eq('status', 'current').eq('occupancy_type', 'owner'),
    db.from('payment_applications').select('amount_applied, charges(description, due_date)').eq('payment_id', id),
    db.from('v_unit_account_summary').select('*').eq('unit_id', p.unit_id).maybeSingle(),
  ]);
  const assoc = p.units?.buildings?.associations;
  const company = assoc?.portfolios?.company_name ?? 'Management office';
  const ownerNames = ((owners ?? []) as any[]).map((o) => o.owners?.full_name).filter(Boolean).join(' & ');
  const balanceDue = balance ? Number(balance.outstanding_balance ?? 0) - Number(balance.unapplied_credit ?? 0) : null;
  const receiptNo = String(p.id).slice(0, 8).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link href={`/units/${p.unit_id}`}><Button variant="secondary">Back to unit</Button></Link>
        <PrintButton label="Print receipt" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-8 print:rounded-none print:border-0">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <div className="text-lg font-semibold text-gray-950">{company}</div>
            <div className="text-sm text-gray-500">on behalf of {assoc?.name ?? 'the association'}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">{p.method === 'credit' ? 'Credit memo' : 'Payment receipt'}</div>
            <div className="mt-1 font-mono text-sm text-gray-900">#{receiptNo}</div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-gray-500">{p.method === 'credit' ? 'Credited to' : 'Received from'}</dt><dd className="font-medium text-gray-900">{ownerNames || 'Owner of record'}</dd></div>
          <div><dt className="text-gray-500">Unit</dt><dd className="font-medium text-gray-900">{p.units?.unit_number ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Date received</dt><dd className="font-medium text-gray-900">{fmtDate(p.payment_date)}</dd></div>
          <div><dt className="text-gray-500">Method</dt><dd className="font-medium text-gray-900">{receiptMethodLabel(p.method)}{p.reference ? ` · ${p.reference}` : ''}</dd></div>
        </dl>

        <div className="mt-6 flex items-baseline justify-between rounded-xl bg-gray-50 px-5 py-4 print:bg-white print:ring-1 print:ring-gray-300">
          <span className="text-sm font-medium text-gray-600">Amount received</span>
          <span className="text-2xl font-semibold tabular-nums text-gray-950">{money(p.amount)}</span>
        </div>

        {(applied ?? []).length > 0 && (
          <table className="mt-6 w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr><th className="py-2 font-medium">Applied to</th><th className="py-2 font-medium">Due</th><th className="py-2 text-right font-medium">Amount</th></tr>
            </thead>
            <tbody>
              {(applied as any[]).map((a, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 text-gray-800">{a.charges?.description ?? 'Charge'}</td>
                  <td className="py-2 tabular-nums text-gray-600">{fmtDate(a.charges?.due_date)}</td>
                  <td className="py-2 text-right tabular-nums text-gray-900">{money(a.amount_applied)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {balanceDue !== null && Number.isFinite(balanceDue) && (
          <p className="mt-4 text-sm text-gray-600">Account balance after this payment: <span className="font-medium tabular-nums text-gray-900">{money(balanceDue)}</span></p>
        )}
        {p.notes && <p className="mt-2 text-sm text-gray-600">Note: {p.notes}</p>}

        <p className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-400">
          Recorded {new Date(p.created_at).toLocaleString('en-US', { timeZone: displayTimeZone(), dateStyle: 'medium', timeStyle: 'short' })}. Keep this receipt for your records.
          {assoc?.portfolios?.support_email ? ` Questions: ${assoc.portfolios.support_email}` : ''}
        </p>
      </div>
    </div>
  );
}
