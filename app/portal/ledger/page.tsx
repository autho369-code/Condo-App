import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  await requireAuth();
  const supabase = await createClient();

  // RLS scopes charges + payments to the resident's own unit
  const { data: charges } = await (supabase as any)
    .from('v_charge_balances')
    .select('*')
    .order('due_date', { ascending: false });

  const { data: payments } = await (supabase as any)
    .from('payments')
    .select('id, amount, payment_date, method, reference, notes')
    .order('payment_date', { ascending: false });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Account ledger</h1>

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
