import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function SurveysPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('surveys')
    .select('id, name, survey_type, active, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  return (
    <ModulePage title="Surveys" description="Maintenance satisfaction, community feedback, and custom surveys.">
      <div className="flex gap-2">
        <Link href="/surveys/maintenance/responses" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50">
          Maintenance responses
        </Link>
        <Link href="/reports/survey_results" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Survey results report
        </Link>
      </div>
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
                  : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">paused</span>}</TD>
                <TD className="whitespace-nowrap text-sm">{date(s.created_at)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No surveys configured.</p>
      )}
    </ModulePage>
  );
}
