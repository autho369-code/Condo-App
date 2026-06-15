import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
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
  question_count: number;
  response_count: number;
  sent_date: string | null;
};

export default async function SurveysPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch surveys with response counts
  const { data: surveys } = await db
    .from('surveys')
    .select('id, name, survey_type, description, active, created_at, questions')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  // Fetch response counts per survey
  const surveyIds = (surveys ?? []).map((s: any) => s.id);
  let responseCounts: Record<string, number> = {};

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

    return {
      id: s.id,
      name: s.name,
      survey_type: s.survey_type ?? 'general',
      description: s.description,
      active: s.active,
      created_at: s.created_at,
      questions: s.questions,
      question_count: questionCount,
      response_count: responses,
      sent_date: s.created_at,
    };
  });

  const activeCount = rows.filter((r) => r.active).length;
  const totalResponses = rows.reduce((sum, r) => sum + r.response_count, 0);

  return (
    <DataWorkspace
      title="Surveys"
      description="Create and manage community surveys, maintenance satisfaction polls, and feedback forms. Track responses and completion rates."
      actions={
        <Link href="/surveys/new">
          <Button><Plus className="h-4 w-4" /> New survey</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* ── KPI Strip ── */}
        <MetricStrip
          metrics={[
            { label: 'Total surveys', value: rows.length, sublabel: `${activeCount} active` },
            { label: 'Total responses', value: totalResponses, sublabel: 'Across all surveys' },
            { label: 'Survey types', value: [...new Set(rows.map((r) => r.survey_type))].length, sublabel: 'Categories in use' },
          ]}
        />

        {/* ── Surveys Table ── */}
        {rows.length > 0 ? (
          <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-950">All surveys</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {rows.length} survey{rows.length !== 1 ? 's' : ''} configured
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Survey Name</TH>
                    <TH>Scope</TH>
                    <TH>Type</TH>
                    <TH>Created</TH>
                    <TH className="text-right">Questions</TH>
                    <TH className="text-right">Responses</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {rows.map((row) => (
                    <TR key={row.id}>
                      <TD className="font-medium text-gray-950">
                        {row.name}
                        {row.description && (
                          <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{row.description}</p>
                        )}
                      </TD>
                      <TD className="text-gray-600">Portfolio-wide</TD>
                      <TD className="capitalize">{row.survey_type.replace(/_/g, ' ')}</TD>
                      <TD className="whitespace-nowrap text-gray-600">{date(row.sent_date)}</TD>
                      <TD className="text-right tabular-nums font-medium text-gray-700">{row.question_count}</TD>
                      <TD className="text-right tabular-nums font-medium text-gray-950">{row.response_count}</TD>
                      <TD>
                        <StatusChip tone={row.active ? 'success' : 'neutral'}>
                          {row.active ? 'Active' : 'Paused'}
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-gray-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <p className="text-sm text-gray-500">No surveys configured yet.</p>
            <p className="mt-1 text-xs text-gray-400">Create a survey to start collecting owner feedback and community input.</p>
            <div className="mt-4">
              <Link href="/surveys/new">
                <Button><Plus className="h-4 w-4" /> Create first survey</Button>
              </Link>
            </div>
          </section>
        )}

        {/* ── Survey Types Quick Links ── */}
        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Survey types</h2>
            <p className="mt-0.5 text-xs text-gray-500">Create different survey types for different needs</p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Maintenance</div>
              <p className="mt-1 text-xs text-gray-500">Post-service satisfaction surveys tied to work orders</p>
              <Link href="/surveys/new?type=maintenance" className="mt-2 inline-block text-xs font-medium text-gray-600 transition-colors hover:text-gray-950">
                Create maintenance survey →
              </Link>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Leasing</div>
              <p className="mt-1 text-xs text-gray-500">Tenant experience and move-in/move-out feedback</p>
              <Link href="/surveys/new?type=leasing" className="mt-2 inline-block text-xs font-medium text-gray-600 transition-colors hover:text-gray-950">
                Create leasing survey →
              </Link>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">General</div>
              <p className="mt-1 text-xs text-gray-500">Community polls, board elections, and general feedback</p>
              <Link href="/surveys/new?type=general" className="mt-2 inline-block text-xs font-medium text-gray-600 transition-colors hover:text-gray-950">
                Create general survey →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Related Links ── */}
        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Go deeper</h2>
          </div>
          <div className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2 xl:grid-cols-3">
            <Link href="/reports/survey_results" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Survey Results report →
            </Link>
            <Link href="/reports" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Reports workspace →
            </Link>
            <Link href="/owners" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Owner directory →
            </Link>
            <Link href="/communication-center" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Communication Center →
            </Link>
            <Link href="/metrics" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Metrics dashboard →
            </Link>
          </div>
        </section>
      </div>
    </DataWorkspace>
  );
}
