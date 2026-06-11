import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/shell';
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
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Account ledger</h1>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">Charges</h2>
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
                <TD className="text-right text-emerald-700">{money(c.applied_amount)}</TD>
                <TD className={`text-right ${Number(c.balance_due) > 0 ? 'text-red-700' : ''}`}>{money(c.balance_due)}</TD>
                <TD><Badge status={c.payment_status} /></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">Payments</h2>
        <Table>
          <THead><TR><TH>Date</TH><TH>Method</TH><TH>Reference</TH><TH className="text-right">Amount</TH></TR></THead>
          <tbody>
            {(payments ?? []).map((p: any) => (
              <TR key={p.id}>
                <TD>{date(p.payment_date)}</TD>
                <TD className="uppercase">{p.method}</TD>
                <TD className="text-gray-600">{p.reference ?? p.notes ?? '—'}</TD>
                <TD className="text-right text-emerald-700">{money(p.amount)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
