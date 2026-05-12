import { AccountingPage } from '@/components/accounting/accounting-page';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { chargeLateFees } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ChargeLateFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  await requireStaff();
  const { posted } = await searchParams;
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('v_charge_balances')
    .select('charge_id, unit_id, description, due_date, charged_amount, applied_amount, balance_due, is_past_due, payment_status')
    .eq('is_past_due', true)
    .gt('balance_due', 0)
    .order('due_date', { ascending: true })
    .limit(100);

  return (
    <AccountingPage active="receivables" title="Charge Late Fees">
      <div className="space-y-4">
        {posted !== undefined && (
          <div className="border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-900">
            Posted {posted} late fee{posted === '1' ? '' : 's'}.
          </div>
        )}

        <form action={chargeLateFees} className="flex justify-end rounded border border-ink-100 bg-white p-4">
          <Button type="submit">Charge Late Fees</Button>
        </form>

        {rows && rows.length > 0 ? (
          <Table>
            <THead>
              <TR><TH>Charge</TH><TH>Due Date</TH><TH>Status</TH><TH className="text-right">Balance</TH></TR>
            </THead>
            <tbody>
              {rows.map((row: any) => (
                <TR key={row.charge_id}>
                  <TD>
                    <div className="font-medium text-ink-900">{row.description}</div>
                    <div className="font-mono text-xs text-ink-500">{row.unit_id}</div>
                  </TD>
                  <TD>{date(row.due_date)}</TD>
                  <TD><StatusChip tone="warning">{row.payment_status ?? 'Past due'}</StatusChip></TD>
                  <TD className="text-right font-medium">{money(row.balance_due)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No past-due balances found.</p>
        )}
      </div>
    </AccountingPage>
  );
}
