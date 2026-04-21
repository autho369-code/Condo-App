import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CompliancePage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('violations')
    .select('id, title, violation_type, status, date_observed, due_date, fine_amount, associations(name), units(unit_number), owners(full_name)')
    .is('archived_at', null)
    .order('date_observed', { ascending: false })
    .limit(200);

  const open = (rows ?? []).filter((v: any) => v.status !== 'closed' && v.status !== 'resolved').length;

  return (
    <ModulePage title="Compliance / Violations" description={`${open} open · ${(rows ?? []).length} total violations tracked.`}>
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Title</TH><TH>Type</TH><TH>Association</TH><TH>Unit</TH><TH>Observed</TH><TH>Due</TH><TH className="text-right">Fine</TH><TH>Status</TH></TR></THead>
          <tbody>
            {rows.map((v: any) => (
              <TR key={v.id}>
                <TD className="font-medium">{v.title}</TD>
                <TD className="text-sm text-gray-700">{v.violation_type}</TD>
                <TD className="text-sm text-gray-700">{v.associations?.name}</TD>
                <TD className="text-sm">{v.units?.unit_number ? `Unit ${v.units.unit_number}` : '—'}</TD>
                <TD className="whitespace-nowrap text-sm">{date(v.date_observed)}</TD>
                <TD className="whitespace-nowrap text-sm text-gray-600">{date(v.due_date)}</TD>
                <TD className="text-right tabular-nums">{v.fine_amount ? money(v.fine_amount) : '—'}</TD>
                <TD><span className={`rounded px-2 py-0.5 text-xs capitalize ${
                  v.status === 'resolved' || v.status === 'closed' ? 'bg-green-100 text-green-700' :
                  v.status === 'escalated' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>{v.status}</span></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No violations on file.</p>
      )}
    </ModulePage>
  );
}
