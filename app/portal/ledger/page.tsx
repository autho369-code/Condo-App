import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  const me = await requireAuth();
  const supabase = await createClient();
  const unitIds = me.resident_unit_ids ?? [];

  // RLS scopes charges + payments to the resident's own unit
  const { data: charges } = unitIds.length > 0
    ? await (supabase as any)
        .from('v_charge_balances')
        .select('*')
        .in('unit_id', unitIds)
        .order('due_date', { ascending: false })
    : { data: [] };

  const { data: payments } = unitIds.length > 0
    ? await (supabase as any)
        .from('payments')
        .select('id, amount, payment_date, method, reference, notes')
        .in('unit_id', unitIds)
        .order('payment_date', { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-100 pb-7">
        <div>
          <div className="eyebrow">Resident</div>
          <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900">Account ledger</h1>
          <p className="mt-2 text-[15px] text-ink-500">Charges and payments on your unit, oldest hidden behind newest.</p>
        </div>
        <a
          href="/portal/statement"
          className="inline-flex h-10 items-center rounded-md border border-ink-200 bg-white px-5 text-sm font-medium text-ink-800 hover:border-ink-300 hover:bg-cream-50 transition-colors"
        >
          View printable statement →
        </a>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Charges</h2>
        <Table>
          <THead><TR>
            <TH>Date</TH><TH>Description</TH>
            <TH className="text-right">Amount</TH><TH className="text-right">Paid</TH>
            <TH className="text-right">Balance</TH><TH>Status</TH>
          </TR></THead>
          <tbody>
            {(charges ?? []).map((c: any) => (
              <TR key={c.charge_id}>
                <TD>{date(c.due_date)}</TD>
                <TD>{c.description}</TD>
                <TD className="text-right">{money(c.charged_amount)}</TD>
                <TD className="text-right text-green-600">{money(c.applied_amount)}</TD>
                <TD className={`text-right ${Number(c.balance_due) > 0 ? 'text-red-600' : ''}`}>{money(c.balance_due)}</TD>
                <TD>{c.payment_status}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Payments</h2>
        <Table>
          <THead><TR><TH>Date</TH><TH>Method</TH><TH>Reference</TH><TH className="text-right">Amount</TH></TR></THead>
          <tbody>
            {(payments ?? []).map((p: any) => (
              <TR key={p.id}>
                <TD>{date(p.payment_date)}</TD>
                <TD className="uppercase">{p.method}</TD>
                <TD className="text-gray-600">{p.reference ?? p.notes ?? '—'}</TD>
                <TD className="text-right text-green-600">{money(p.amount)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
