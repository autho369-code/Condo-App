import Link from 'next/link';
import { ReportingTabs } from '@/components/reports/reporting-tabs';
import { Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { readQuestions } from '@/lib/surveys/questions';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH = 100;

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; association?: string; removed?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = sp.status === 'open' || sp.status === 'closed' ? sp.status : '';
  const association = UUID.test(sp.association ?? '') ? sp.association! : '';
  const db = (await createClient()) as any;

  const [surveys, associations] = await Promise.all([
    fetchAllRows<any>(() => db
      .from('surveys')
      .select('id, name, survey_type, description, active, created_at, questions, association_id, associations(name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .order('id')),
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
  ]);

  // Response counts and last response per survey, counted from every response.
  const ids = surveys.rows.map((s) => s.id);
  const responseCount = new Map<string, number>();
  const lastResponse = new Map<string, string>();
  let responseError: string | null = null;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { rows, error, truncated } = await fetchAllRows<any>(() => db
      .from('survey_responses').select('id, survey_id, submitted_at').in('survey_id', chunk).order('id'), { maxRows: 100000 });
    if (error || truncated) responseError = error ?? 'There are more responses than this page can count.';
    for (const r of rows) {
      responseCount.set(r.survey_id, (responseCount.get(r.survey_id) ?? 0) + 1);
      if (!lastResponse.has(r.survey_id) || r.submitted_at > lastResponse.get(r.survey_id)!) lastResponse.set(r.survey_id, r.submitted_at);
    }
  }

  const ql = q.toLowerCase();
  const rows = surveys.rows.filter((s) =>
    (!status || (status === 'open' ? s.active : !s.active)) &&
    (!association || s.association_id === association) &&
    (!ql || [s.name, s.description, s.associations?.name].some((v) => String(v ?? '').toLowerCase().includes(ql))));
  const loadError = surveys.error ?? associations.error ?? responseError;

  return (
    <DataWorkspace
      title="Surveys"
      description="Ask owners questions and see their answers. Owners answer open surveys from their portal."
      actions={
        <>
          <Link href="/reports/survey_results"><Button variant="secondary">Survey Results report</Button></Link>
          <Link href="/surveys/new"><Button><Plus className="h-4 w-4" /> New survey</Button></Link>
        </>
      }
    >
      <ReportingTabs current="surveys" />
      <div className="space-y-4">
        {loadError && <Alert tone="danger" title="Could not load every survey or response">{loadError}</Alert>}
        {sp.removed && <Alert tone="success">Survey removed.</Alert>}

        <FilterBar action="/surveys" searchDefault={q} searchPlaceholder="Search surveys...">
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </FilterSelect>
          <FilterSelect label="Association" name="association" defaultValue={association}>
            <option value="">All associations</option>
            {associations.rows.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>

        {rows.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Survey</TH>
                <TH>Who can answer</TH>
                <TH>Type</TH>
                <TH>Created</TH>
                <TH className="text-right">Questions</TH>
                <TH className="text-right">Responses</TH>
                <TH>Last response</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium text-gray-950">
                    <Link href={`/surveys/${s.id}`} className="underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">{s.name}</Link>
                    {s.description && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{s.description}</p>}
                  </TD>
                  <TD className="text-sm text-gray-600">{s.associations?.name ?? 'Every association'}</TD>
                  <TD className="text-sm capitalize text-gray-700">{String(s.survey_type ?? 'general').replace(/_/g, ' ')}</TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{date(s.created_at)}</TD>
                  <TD className="text-right tabular-nums text-gray-700">{readQuestions(s.questions).length}</TD>
                  <TD className="text-right tabular-nums font-medium text-gray-950">{responseError ? '—' : responseCount.get(s.id) ?? 0}</TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{lastResponse.has(s.id) ? date(lastResponse.get(s.id)!) : '—'}</TD>
                  <TD><StatusChip tone={s.active ? 'success' : 'neutral'}>{s.active ? 'Open' : 'Closed'}</StatusChip></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              title={q || status || association ? 'No surveys match this filter' : 'No surveys yet'}
              description="Create a survey; owners answer it in their portal."
              action={<Link href="/surveys/new"><Button><Plus className="h-4 w-4" /> New survey</Button></Link>}
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
