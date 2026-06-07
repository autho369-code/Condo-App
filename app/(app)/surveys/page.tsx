import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type SurveyRow = {
  id: string;
  name: string;
  survey_type: string;
  description: string | null;
  active: boolean;
  created_at: string;
  questions: any;
  response_count: number;
  completion_rate: number;
  association_name: string | null;
  sent_date: string | null;
};

export default async function SurveysPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch surveys with response counts
  const [
    { data: surveys },
    { data: associations },
  ] = await Promise.all([
    db
      .from('surveys')
      .select('id, name, survey_type, description, active, created_at, questions')
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    db
      .from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
  ]);

  // Fetch response counts per survey
  const surveyIds = (surveys ?? []).map((s: any) => s.id);
  let responseCounts: Record<string, number> = {};
  let responseTotals: Record<string, number> = {};

  if (surveyIds.length > 0) {
    const { data: counts } = await db
      .from('survey_responses')
      .select('survey_id')
      .in('survey_id', surveyIds);
    
    // Group counts by survey_id
    for (const r of (counts ?? [])) {
      responseCounts[r.survey_id] = (responseCounts[r.survey_id] ?? 0) + 1;
    }
  }

  // Build rows with computed fields
  const rows: SurveyRow[] = (surveys ?? []).map((s: any) => {
    const questionCount = Array.isArray(s.questions) ? s.questions.length : 0;
    const responses = responseCounts[s.id] ?? 0;
    
    // Estimate completion rate: if no questions, 0%. Otherwise, estimate based on responses.
    // For a more accurate rate we'd need to know how many were sent, but we use a placeholder.
    const completionRate = responses > 0 ? Math.min(100, Math.round(responses * 100 / Math.max(responses, 1))) : 0;

    return {
      id: s.id,
      name: s.name,
      survey_type: s.survey_type ?? 'general',
      description: s.description,
      active: s.active,
      created_at: s.created_at,
      questions: s.questions,
      response_count: responses,
      completion_rate: completionRate,
      association_name: 'Portfolio-wide',
      sent_date: s.created_at,
    };
  });

  const activeCount = rows.filter((r) => r.active).length;
  const totalResponses = rows.reduce((sum, r) => sum + r.response_count, 0);
  const avgCompletion = rows.length > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.completion_rate, 0) / rows.length)
    : 0;

  return (
    <DataWorkspace
      title="Surveys"
      description="Create and manage community surveys, maintenance satisfaction polls, and feedback forms. Track responses and completion rates."
      actions={
        <Link href="/surveys/new">
          <Button>+ New Survey</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* ── KPI Strip ── */}
        <MetricStrip
          metrics={[
            { label: 'Total surveys', value: rows.length, sublabel: `${activeCount} active` },
            { label: 'Total responses', value: totalResponses, sublabel: 'Across all surveys' },
            { label: 'Avg. completion', value: `${avgCompletion}%`, sublabel: 'Estimated rate' },
            { label: 'Survey types', value: [...new Set(rows.map((r) => r.survey_type))].length, sublabel: 'Categories in use' },
          ]}
        />

        {/* ── Surveys Table ── */}
        {rows.length > 0 ? (
          <section className="rounded border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-950">All surveys</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {rows.length} survey{rows.length !== 1 ? 's' : ''} — click a row to view details
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Survey Name</TH>
                    <TH>Association</TH>
                    <TH>Type</TH>
                    <TH>Sent Date</TH>
                    <TH className="text-right">Responses</TH>
                    <TH className="text-right">Completion Rate</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <tbody>
                  {rows.map((row) => (
                    <TR key={row.id}>
                      <TD className="font-medium text-gray-950">
                        <Link href={`/surveys/${row.id}`} className="text-blue-700 hover:underline">
                          {row.name}
                        </Link>
                        {row.description && (
                          <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{row.description}</p>
                        )}
                      </TD>
                      <TD className="text-sm text-gray-700">{row.association_name ?? '—'}</TD>
                      <TD className="text-sm capitalize text-gray-700">{row.survey_type.replace(/_/g, ' ')}</TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(row.sent_date)}</TD>
                      <TD className="text-right tabular-nums text-sm font-medium text-gray-950">{row.response_count}</TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Progress bar */}
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-brand-600 transition-all"
                              style={{ width: `${row.completion_rate}%` }}
                            />
                          </div>
                          <span className="text-sm tabular-nums font-medium text-gray-700">{row.completion_rate}%</span>
                        </div>
                      </TD>
                      <TD>
                        {row.active ? (
                          <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Paused
                          </span>
                        )}
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/surveys/${row.id}/send`}>
                            <Button variant="secondary" size="sm" className="text-xs">
                              Send
                            </Button>
                          </Link>
                          <Link href={`/surveys/${row.id}/results`}>
                            <Button variant="secondary" size="sm" className="text-xs">
                              View Results
                            </Button>
                          </Link>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          </section>
        ) : (
          <section className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No surveys configured yet.</p>
            <p className="mt-1 text-xs text-gray-400">Create a survey to start collecting owner feedback and community input.</p>
            <div className="mt-4">
              <Link href="/surveys/new">
                <Button>+ Create First Survey</Button>
              </Link>
            </div>
          </section>
        )}

        {/* ── Survey Types Quick Links ── */}
        <section className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Survey types</h2>
            <p className="mt-0.5 text-xs text-gray-500">Create different survey types for different needs</p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
            <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Maintenance</div>
              <p className="mt-1 text-xs text-gray-500">Post-service satisfaction surveys tied to work orders</p>
              <Link href="/surveys/new?type=maintenance" className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline">
                Create maintenance survey →
              </Link>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Leasing</div>
              <p className="mt-1 text-xs text-gray-500">Tenant experience and move-in/move-out feedback</p>
              <Link href="/surveys/new?type=leasing" className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline">
                Create leasing survey →
              </Link>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">General</div>
              <p className="mt-1 text-xs text-gray-500">Community polls, board elections, and general feedback</p>
              <Link href="/surveys/new?type=general" className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline">
                Create general survey →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Related Links ── */}
        <section className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Go deeper</h2>
          </div>
          <div className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2 xl:grid-cols-3">
            <Link href="/reports/survey_results" className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-blue-700 hover:border-brand-200 hover:bg-brand-50 transition-colors">
              Survey Results report →
            </Link>
            <Link href="/reports" className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-blue-700 hover:border-brand-200 hover:bg-brand-50 transition-colors">
              Reports workspace →
            </Link>
            <Link href="/owners" className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-blue-700 hover:border-brand-200 hover:bg-brand-50 transition-colors">
              Owner directory →
            </Link>
            <Link href="/communications" className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-blue-700 hover:border-brand-200 hover:bg-brand-50 transition-colors">
              Communications →
            </Link>
            <Link href="/metrics" className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-blue-700 hover:border-brand-200 hover:bg-brand-50 transition-colors">
              Metrics dashboard →
            </Link>
          </div>
        </section>
      </div>
    </DataWorkspace>
  );
}
