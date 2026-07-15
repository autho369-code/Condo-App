import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/shell';
import { money, date } from '@/lib/utils';
import { LedgerActions, type LedgerChargeRow, type LedgerPaymentRow } from '@/components/portal/ledger-actions';

export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  const me = await requireAuth();
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

  // Association name for the export header (owner's first current occupancy)
  let associationName = 'Association';
  if (me.owner_id) {
    const { data: occ } = await (supabase as any)
      .from('occupancies')
      .select('units(buildings(associations(name)))')
      .eq('owner_id', me.owner_id)
      .limit(1)
      .maybeSingle();
    associationName = occ?.units?.buildings?.associations?.name ?? associationName;
  }

  const exportCharges: LedgerChargeRow[] = (charges ?? []).map((c: any) => ({
    date: c.due_date ? date(c.due_date) : '',
    description: c.description ?? '',
    amount: Number(c.charged_amount ?? 0),
    paid: Number(c.applied_amount ?? 0),
    balance: Number(c.balance_due ?? 0),
    status: String(c.payment_status ?? '').replace(/_/g, ' '),
  }));
  const exportPayments: LedgerPaymentRow[] = (payments ?? []).map((p: any) => ({
    date: p.payment_date ? date(p.payment_date) : '',
    method: String(p.method ?? '').toUpperCase(),
    reference: p.reference ?? p.notes ?? '',
    amount: Number(p.amount ?? 0),
  }));
  const totalBalance = exportCharges.reduce((s, c) => s + c.balance, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Account ledger</h1>
        <LedgerActions
          ownerName={me.profile?.full_name ?? me.email ?? 'Owner'}
          companyName={me.portfolio?.company_name ?? 'Your management company'}
          associationName={associationName}
          charges={exportCharges}
          payments={exportPayments}
          totalBalance={totalBalance}
        />
      </div>

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
