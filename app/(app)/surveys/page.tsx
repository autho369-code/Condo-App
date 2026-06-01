import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function SurveysPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('surveys')
    .select('id, name, survey_type, active, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  return (
    <ModulePage title="Surveys" description="Maintenance satisfaction, community feedback, and custom surveys.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Name</TH><TH>Type</TH><TH>Active</TH><TH>Created</TH></TR></THead>
          <tbody>
            {rows.map((s: any) => (
              <TR key={s.id}>
                <TD className="font-medium">{s.name}</TD>
                <TD className="text-sm capitalize text-gray-700">{s.survey_type}</TD>
                <TD>{s.active
                  ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">active</span>
                  : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-slate-400">paused</span>}</TD>
                <TD className="whitespace-nowrap text-sm">{date(s.created_at)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-slate-400">No surveys configured.</p>
      )}
    </ModulePage>
  );
}
