import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InspectionsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('inspections')
    .select('id, inspection_type, scheduled_date, completed_date, status, associations(name), units(unit_number)')
    .is('archived_at', null)
    .order('scheduled_date', { ascending: false })
    .limit(100);

  return (
    <ModulePage title="Inspections" description="Annual walkthroughs, move-in/move-out, common-area audits.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Type</TH><TH>Scheduled</TH><TH>Completed</TH><TH>Where</TH><TH>Status</TH></TR></THead>
          <tbody>
            {rows.map((i: any) => (
              <TR key={i.id}>
                <TD className="font-medium capitalize">{i.inspection_type?.replace(/_/g, ' ') ?? '—'}</TD>
                <TD className="whitespace-nowrap text-sm">{date(i.scheduled_date)}</TD>
                <TD className="whitespace-nowrap text-sm">{i.completed_date ? date(i.completed_date) : '—'}</TD>
                <TD className="text-sm text-gray-700">{i.associations?.name}{i.units?.unit_number ? ` · Unit ${i.units.unit_number}` : ''}</TD>
                <TD><span className="rounded bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700">{i.status}</span></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No inspections scheduled.</p>
      )}
    </ModulePage>
  );
}
