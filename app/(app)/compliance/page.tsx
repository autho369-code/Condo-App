import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Badge, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CompliancePage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('violations')
    .select('id, title, violation_type, status, date_observed, due_date, fine_amount, associations(name), units(unit_number), owners(full_name)')
    .is('archived_at', null)
    .order('date_observed', { ascending: false })
    .limit(200);

  const open = (rows ?? []).filter((v: any) => v.status !== 'closed' && v.status !== 'resolved').length;

  return (
    <DataWorkspace
      title="Compliance / Violations"
      description={`${open} open · ${(rows ?? []).length} total violations tracked.`}
    >
      {rows && rows.length > 0 ? (
        <Table>
          <THead><tr><TH>Title</TH><TH>Type</TH><TH>Association</TH><TH>Unit</TH><TH>Observed</TH><TH>Due</TH><TH className="text-right">Fine</TH><TH>Status</TH></tr></THead>
          <tbody>
            {rows.map((v: any) => (
              <TR key={v.id}>
                <TD className="font-medium">{v.title}</TD>
                <TD>{v.violation_type}</TD>
                <TD>{v.associations?.name}</TD>
                <TD>{v.units?.unit_number ? `Unit ${v.units.unit_number}` : '—'}</TD>
                <TD className="whitespace-nowrap">{date(v.date_observed)}</TD>
                <TD className="whitespace-nowrap text-gray-600">{date(v.due_date)}</TD>
                <TD className="text-right tabular-nums">{v.fine_amount ? money(v.fine_amount) : '—'}</TD>
                <TD><Badge status={v.status} /></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <EmptyState
            icon={ShieldAlert}
            title="No violations on file"
            description="Violations reported across your associations will appear here."
          />
        </div>
      )}
    </DataWorkspace>
  );
}
