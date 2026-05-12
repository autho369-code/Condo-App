import { AccountingPage } from '@/components/accounting/accounting-page';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { postRecurringUnitCharges } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BulkRecurringChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  await requireStaff();
  const { posted } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows } = await (supabase as any)
    .from('v_unit_charge_schedule')
    .select('recurring_charge_id, unit_number, association_name, category_name, amount, frequency, next_post_date, active')
    .eq('active', true)
    .lte('next_post_date', today)
    .order('next_post_date', { ascending: true })
    .limit(100);

  return (
    <AccountingPage active="receivables" title="Bulk Recurring Charges">
      <div className="space-y-4">
        {posted !== undefined && (
          <div className="border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-900">
            Posted {posted} recurring charge{posted === '1' ? '' : 's'}.
          </div>
        )}

        <form action={postRecurringUnitCharges} className="flex justify-end rounded border border-ink-100 bg-white p-4">
          <Button type="submit">Post Due Recurring Charges</Button>
        </form>

        {rows && rows.length > 0 ? (
          <Table>
            <THead>
              <TR><TH>Unit</TH><TH>Charge</TH><TH>Next Post Date</TH><TH>Frequency</TH><TH className="text-right">Amount</TH></TR>
            </THead>
            <tbody>
              {rows.map((row: any) => (
                <TR key={row.recurring_charge_id}>
                  <TD>
                    <div className="font-medium text-ink-900">{row.association_name ?? 'Association'}</div>
                    <div className="text-xs text-ink-500">Unit {row.unit_number ?? '-'}</div>
                  </TD>
                  <TD>{row.category_name ?? '-'}</TD>
                  <TD>{date(row.next_post_date)}</TD>
                  <TD><StatusChip tone="info">{row.frequency ?? '-'}</StatusChip></TD>
                  <TD className="text-right font-medium">{money(row.amount)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No recurring charges are due.</p>
        )}
      </div>
    </AccountingPage>
  );
}
