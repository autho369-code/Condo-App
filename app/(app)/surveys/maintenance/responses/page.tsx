import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MaintenanceSurveyResponsesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireStaff();
  const { type = 'Maintenance' } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('survey_responses')
    .select(`
      id, rating, comments, submitted_by_name, submitted_by_email, submitted_at, created_at,
      surveys(name, survey_type),
      owners(full_name),
      work_orders(id, number, title, assigned_to, completed_date, associations(name), vendors(name))
    `)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(500);

  const responses = (rows ?? []).filter((row: any) =>
    String(row.surveys?.survey_type ?? row.surveys?.name ?? '').toLowerCase().includes(type.toLowerCase()),
  );

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-8 py-6">
      <nav className="mb-3 flex gap-4 text-xs font-semibold">
        {[
          ['Reports', '/reports'],
          ['Scheduled Reports', '/scheduled-reports'],
          ['Metrics', '/metrics'],
          ['Surveys', '/surveys'],
          ['Compliance', '/compliance'],
        ].map(([label, href]) => (
          <Link key={href} href={href} className={href === '/surveys' ? 'text-brand-700 underline' : 'text-gray-600 hover:text-brand-700'}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Surveys</h1>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">Type</span>
          <select defaultValue={type} className="h-8 rounded border border-gray-300 bg-white px-2 text-sm">
            <option>Maintenance</option>
            <option>Community</option>
            <option>Custom</option>
          </select>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Maintenance Surveys</h2>
        <div className="mt-2 flex gap-2">
          <Link href="/surveys/maintenance/responses" className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-900">Responses</Link>
          <Link href="/surveys" className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">Analysis</Link>
          <Link href="/surveys" className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">Settings</Link>
        </div>
      </div>

      <div className="mb-4 rounded border border-brand-500 bg-white px-4 py-3 text-center text-sm font-medium text-gray-900">
        Click here to search
      </div>

      {responses.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>Survey</TH>
              <TH>Work Order</TH>
              <TH className="text-right">Rating</TH>
              <TH>Submitted</TH>
              <TH>Resident</TH>
              <TH>Assigned Team</TH>
              <TH>Association</TH>
              <TH>Completed</TH>
            </TR>
          </THead>
          <tbody>
            {responses.map((response: any) => (
              <TR key={response.id}>
                <TD className="font-medium">{response.surveys?.name ?? 'Maintenance'}</TD>
                <TD>
                  {response.work_orders?.id ? (
                    <Link href={`/work-orders/${response.work_orders.id}`} className="text-blue-700 hover:underline">
                      {response.work_orders.number ?? response.work_orders.title ?? 'Work order'}
                    </Link>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </TD>
                <TD className="text-right tabular-nums font-medium">{response.rating ?? '-'}</TD>
                <TD className="whitespace-nowrap text-sm">{date(response.submitted_at ?? response.created_at)}</TD>
                <TD className="text-sm text-gray-700">{response.owners?.full_name ?? response.submitted_by_name ?? response.submitted_by_email ?? '-'}</TD>
                <TD className="text-sm text-gray-700">{response.work_orders?.vendors?.name ?? response.work_orders?.assigned_to ?? '-'}</TD>
                <TD className="text-sm text-gray-700">{response.work_orders?.associations?.name ?? '-'}</TD>
                <TD className="whitespace-nowrap text-sm text-gray-600">{date(response.work_orders?.completed_date)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
          No maintenance survey responses found in Supabase yet.
        </div>
      )}

      <div className="mt-4 text-xs font-semibold">
        <Link href="/settings" className="text-brand-700 hover:underline">Privacy</Link>
        <span className="mx-1 text-gray-400">|</span>
        <Link href="/settings" className="text-brand-700 hover:underline">Help & Training</Link>
        <span className="mx-1 text-gray-400">|</span>
        <Link href="/surveys" className="text-brand-700 hover:underline">Notice Suggestions</Link>
      </div>
    </div>
  );
}
