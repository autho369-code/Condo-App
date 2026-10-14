import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/me';
import { loadOwnPortalUnitIds, unitFilter } from '@/lib/portal/own-units';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Badge, Alert } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { money, date } from '@/lib/utils';
import { LedgerActions, type LedgerChargeRow, type LedgerPaymentRow } from '@/components/portal/ledger-actions';
import { ownerTenureCutoffs, ownerVisibleCharge, tenureFilter, withinTenure } from '../_lib/tenure';
import { isLateFeeRemoval } from '@/lib/portal/ledger-rows';

export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  const me = await requireOwner();
  const supabase = await createClient();

  // Filter to the owner's own units explicitly: RLS also admits board members
  // to the whole association, which leaked every owner's ledger here.
  const ownUnits = await loadOwnPortalUnitIds(supabase, me.owner_ids);
  const myUnits = unitFilter(ownUnits.ids);
  const [{ data: chargeRows, error: chargesError }, tenure, { data: unitRows, error: unitsError }] = await Promise.all([
    (supabase as any)
      .from('v_charge_balances')
      .select('*')
      .in('unit_id', myUnits)
      .order('due_date', { ascending: false }),
    ownerTenureCutoffs(supabase, me.owner_ids),
    // Unit number + association per unit, for the Unit column and the export
    // header (v_charge_balances is a view with no foreign key to embed).
    (supabase as any)
      .from('units')
      .select('id, unit_number, buildings(associations(name))')
      .in('id', myUnits),
  ]);
  const unitInfo = new Map<string, { unit: string; association: string }>(
    ((unitRows ?? []) as any[]).map((u) => [u.id, { unit: u.unit_number ?? '', association: u.buildings?.associations?.name ?? '' }]),
  );
  const unitLabel = (unitId: string | null | undefined) => (unitId ? unitInfo.get(unitId)?.unit : '') || '—';

  // Charges show the unit's full open balance (the debt is real), but a paid
  // charge only from the owner's own move-in on; payment details likewise —
  // a buyer must not see the seller's history, payments or references.
  // Staff `notes` are internal and never shown to owners. Reversed (returned)
  // payments are listed but marked.
  const charges = ((chargeRows ?? []) as any[]).filter((c) => ownerVisibleCharge(tenure, c));
  const paymentScope = tenureFilter(tenure, 'payment_date', myUnits);
  const { data: payments, error: paymentsError } = paymentScope
    ? await (supabase as any)
        .from('payments')
        .select('id, unit_id, amount, payment_date, method, reference, reversed_at, reversal_reason, units(unit_number)')
        .or(paymentScope)
        .order('payment_date', { ascending: false })
    : { data: [], error: null };

  // Unapplied credit (payments not yet matched to a charge) reduces what is owed,
  // so the total agrees with the dashboard and the pay page.
  const { data: summaries, error: summariesError } = await (supabase as any)
    .from('v_unit_account_summary')
    .select('unit_id, unapplied_credit')
    .in('unit_id', myUnits);
  const unappliedCredit = ((summaries ?? []) as { unapplied_credit: number | string | null }[])
    .reduce((s, u) => s + Number(u.unapplied_credit ?? 0), 0);

  // The export carries one header per association (a login can own units in
  // several); each row names its association and unit.
  const associationNames = [...new Set([...unitInfo.values()].map((u) => u.association).filter(Boolean))];
  const associationName = associationNames.join(', ') || 'Association';

  const exportCharges: LedgerChargeRow[] = charges.map((c: any) => ({
    association: unitInfo.get(c.unit_id)?.association ?? '',
    unit: unitLabel(c.unit_id),
    date: c.due_date ? date(c.due_date) : '',
    description: c.description ?? '',
    amount: Number(c.charged_amount ?? 0),
    paid: Number(c.applied_amount ?? 0),
    balance: Number(c.balance_due ?? 0),
    status: String(c.payment_status ?? '').replace(/_/g, ' '),
  }));
  const exportPayments: LedgerPaymentRow[] = (payments ?? []).map((p: any) => ({
    association: unitInfo.get(p.unit_id)?.association ?? '',
    unit: p.units?.unit_number ?? unitLabel(p.unit_id),
    date: p.payment_date ? date(p.payment_date) : '',
    // A removed late fee is a credit, not a payment received.
    method: isLateFeeRemoval(p) ? 'Late fee removed' : String(p.method ?? '').toUpperCase(),
    reference: p.reference ?? '',
    amount: Number(p.amount ?? 0),
    status: p.reversed_at ? `Returned${p.reversal_reason ? ` (${p.reversal_reason})` : ''}` : '',
  }));
  const loadError = (ownUnits.error ? { message: ownUnits.error } : null)
    ?? (tenure.error ? { message: tenure.error } : null)
    ?? chargesError ?? paymentsError ?? summariesError ?? unitsError;
  // The balance counts every charge on the unit (hidden ones are paid), so it
  // still agrees with the dashboard and the pay page.
  const chargesBalance = ((chargeRows ?? []) as any[]).reduce((s, c) => s + Number(c.balance_due ?? 0), 0);
  const totalBalance = Math.round((chargesBalance - unappliedCredit) * 100) / 100;

  // Active payment plans for the owner's units (RLS: their own units; one per unit).
  // A plan made with a previous owner is theirs, not the buyer's: keep plans
  // naming this owner, or (unnamed) created during this owner's tenure.
  const { data: activePlans } = await (supabase as any)
    .from('payment_plans')
    .select('id, unit_id, owner_id, created_at, total_amount, installment_count, frequency, units(unit_number)')
    .in('unit_id', myUnits)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  const myPlans = ((activePlans ?? []) as any[]).filter((plan) =>
    plan.owner_id ? me.owner_ids.includes(plan.owner_id) : withinTenure(tenure, plan.unit_id, plan.created_at));
  const plans = await Promise.all(myPlans.map(async (plan) => {
    const { data: sched } = await (supabase as any).rpc('payment_plan_schedule', { p_plan_id: plan.id });
    const rows = (sched ?? []) as { installment_number: number; due_date: string; amount: number; covered: number; status: string }[];
    return { plan, rows, paid: rows.reduce((s, r) => s + Number(r.covered), 0) };
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Account ledger</h1>
        <LedgerActions
          ownerName={me.profile?.full_name ?? me.email ?? 'Owner'}
          companyName={me.portfolio?.company_name ?? 'Your management company'}
          associationName={associationName}
          charges={exportCharges}
          payments={exportPayments}
          totalBalance={totalBalance}
        />
      </div>

      {loadError && (
        <Alert tone="danger" title="Could not load your ledger:">{loadError.message}. The balance and history below may be incomplete — please refresh.</Alert>
      )}

      {plans.map(({ plan, rows: planRows, paid: planPaid }) => (
        <section key={plan.id}>
          <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">
            Your payment plan{plans.length > 1 && plan.units?.unit_number ? ` · Unit ${plan.units.unit_number}` : ''}
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            {money(plan.total_amount)} in {plan.installment_count} installments · {money(planPaid)} paid · {money(Math.max(Number(plan.total_amount) - planPaid, 0))} remaining.
            Your payments count toward the plan automatically.
          </p>
          <Table>
            <THead><TR>
              <TH>#</TH><TH>Due</TH><TH className="text-right">Amount</TH><TH className="text-right">Paid</TH><TH>Status</TH>
            </TR></THead>
            <tbody>
              {planRows.map((r) => (
                <TR key={r.installment_number}>
                  <TD>{r.installment_number}</TD>
                  <TD>{date(r.due_date)}</TD>
                  <TD className="text-right">{money(r.amount)}</TD>
                  <TD className="text-right">{money(r.covered)}</TD>
                  <TD><Badge status={r.status === 'paid' ? 'paid' : r.status === 'behind' ? 'overdue' : 'pending'}>{r.status === 'paid' ? 'Paid' : r.status === 'behind' ? 'Past due' : r.status === 'due' ? 'Due soon' : 'Upcoming'}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
      ))}

      <section>
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">Charges</h2>
        <Table>
          <THead><TR>
            <TH>Date</TH><TH>Unit</TH><TH>Description</TH>
            <TH className="text-right">Amount</TH><TH className="text-right">Paid</TH>
            <TH className="text-right">Balance</TH><TH>Status</TH>
          </TR></THead>
          <tbody>
            {charges.map((c: any) => (
              <TR key={c.charge_id}>
                <TD>{date(c.due_date)}</TD>
                <TD>{unitLabel(c.unit_id)}</TD>
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
          <THead><TR><TH>Date</TH><TH>Unit</TH><TH>Method</TH><TH>Reference</TH><TH className="text-right">Amount</TH><TH>Status</TH></TR></THead>
          <tbody>
            {(payments ?? []).map((p: any) => (
              <TR key={p.id}>
                <TD>{date(p.payment_date)}</TD>
                <TD>{p.units?.unit_number ?? unitLabel(p.unit_id)}</TD>
                {isLateFeeRemoval(p)
                  ? <TD>Late fee removed</TD>
                  : <TD className="uppercase">{p.method}</TD>}
                <TD className="text-gray-600">{p.reference ?? '—'}</TD>
                <TD className={p.reversed_at ? 'text-right text-gray-400 line-through' : 'text-right text-emerald-700'}>{money(p.amount)}</TD>
                <TD>{p.reversed_at ? <StatusChip tone="danger">Returned{p.reversal_reason ? ` · ${p.reversal_reason}` : ''}</StatusChip> : null}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
