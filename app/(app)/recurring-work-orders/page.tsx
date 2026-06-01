import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function RecurringWOPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('recurring_work_orders')
    .select('id, title, trade, priority, frequency, interval_count, next_due_date, auto_generate, associations(name), units(unit_number), vendors(name)')
    .is('archived_at', null)
    .order('next_due_date', { ascending: true, nullsFirst: false });

  return (
    <ModulePage title="Recurring Work Orders" description="Scheduled maintenance — landscaping, pool service, annual inspections. A nightly cron generates real work orders from these.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Title</TH><TH>Where</TH><TH>Vendor</TH><TH>Frequency</TH><TH>Next due</TH><TH>Auto-generate</TH></TR></THead>
          <tbody>
            {rows.map((r: any) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.title}</TD>
                <TD className="text-sm text-gray-700">{r.associations?.name}{r.units?.unit_number ? ` · Unit ${r.units.unit_number}` : ''}</TD>
                <TD className="text-sm text-gray-700">{r.vendors?.name ?? 'Unassigned'}</TD>
                <TD className="text-sm capitalize">{r.interval_count > 1 ? `Every ${r.interval_count} ` : ''}{r.frequency?.replace(/_/g, ' ')}</TD>
                <TD className="whitespace-nowrap text-sm">{date(r.next_due_date)}</TD>
                <TD>{r.auto_generate
                  ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">auto</span>
                  : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">manual</span>}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No recurring work orders defined.</p>
      )}
    </ModulePage>
  );
}
